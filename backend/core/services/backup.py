"""
Export / import of the core event tables as a single JSON document.

Used by the superuser-only admin page (/admin/backup/), so data can be
moved in and out of production through the browser when there is no shell or
file-copy access to the host.

Two import modes:

* ``restore`` -- full replace: every selected table is emptied and refilled
  from the file. Use this with a complete export to roll the whole event back.
* ``merge`` -- upsert: rows from the file overwrite rows with the same primary
  key and missing rows are inserted. Nothing is deleted. Use this to fix a
  subset (e.g. only ``event_status``) without touching anything else.

Every import runs in a single transaction: any error rolls everything back.
"""

import datetime
import decimal
import json
import uuid
from collections import Counter

from django.contrib.auth.models import User
from django.core import serializers
from django.db import transaction
from django.db.migrations.recorder import MigrationRecorder
from django.utils import timezone

from core.models import (
    Assignment, CarpoolMessage, EmailLog, EventStatus, Participant,
    ParticipantComment, Restaurant, RestaurantComment,
)

BACKUP_FORMAT = 'bpm-backup'
BACKUP_VERSION = 1

# Ordered parents-before-children so inserts satisfy foreign keys.
TABLES = {
    'event_status': EventStatus,
    'participants': Participant,
    'restaurants': Restaurant,
    'assignments': Assignment,
    'participant_comments': ParticipantComment,
    'restaurant_comments': RestaurantComment,
    'email_logs': EmailLog,
    'carpool_messages': CarpoolMessage,
}

MODES = ('restore', 'merge')

_LABEL_TO_TABLE = {model._meta.label_lower: name for name, model in TABLES.items()}


class BackupError(ValueError):
    """Raised for invalid backup files or import options."""


def _resolve_tables(tables):
    if not tables:
        return list(TABLES)
    unknown = sorted(set(tables) - set(TABLES))
    if unknown:
        raise BackupError(
            f"Unknown table(s): {', '.join(unknown)}. Valid: {', '.join(TABLES)}."
        )
    # Keep dependency order regardless of the order given.
    return [name for name in TABLES if name in tables]


def _latest_core_migration():
    row = (
        MigrationRecorder.Migration.objects.filter(app='core')
        .order_by('-applied', '-id')
        .values_list('name', flat=True)
        .first()
    )
    return row


def _json_default(value):
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, (uuid.UUID, decimal.Decimal)):
        return str(value)
    raise TypeError(f'Cannot serialise {type(value).__name__}')


def export_backup(tables=None):
    """Return the selected tables as a JSON-serialisable dict."""
    names = _resolve_tables(tables)
    objects = []
    counts = {}
    for name in names:
        model = TABLES[name]
        queryset = model.objects.order_by('pk')
        # Natural keys make comment authors portable (username instead of a
        # numeric user id). Round-trip through JSON with full-precision
        # timestamps (Django's own JSON encoder truncates to milliseconds).
        serialized = json.loads(json.dumps(
            serializers.serialize('python', queryset, use_natural_foreign_keys=True),
            default=_json_default,
        ))
        counts[name] = len(serialized)
        objects.extend(serialized)

    return {
        'format': BACKUP_FORMAT,
        'version': BACKUP_VERSION,
        'exported_at': timezone.now().isoformat(),
        'core_migration': _latest_core_migration(),
        'tables': names,
        'counts': counts,
        'objects': objects,
    }


def export_backup_json(tables=None):
    return json.dumps(export_backup(tables), indent=2, ensure_ascii=False)


def parse_backup(raw):
    """Parse and validate raw JSON (str/bytes) into a backup dict."""
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError) as exc:
        raise BackupError(f'File is not valid JSON: {exc}') from exc
    if not isinstance(payload, dict) or payload.get('format') != BACKUP_FORMAT:
        raise BackupError('File is not a BPM backup (missing "format": "bpm-backup").')
    if payload.get('version') != BACKUP_VERSION:
        raise BackupError(
            f"Unsupported backup version {payload.get('version')!r}; expected {BACKUP_VERSION}."
        )
    if not isinstance(payload.get('objects'), list):
        raise BackupError('Backup has no "objects" list.')
    return payload


def _strip_unknown_users(objects):
    """Null out comment authors that don't exist in this database.

    Users aren't part of the backup, so a comment written by an account that
    only exists on the source system would otherwise fail to load.
    """
    usernames = {
        obj['fields']['created_by'][0]
        for obj in objects
        if isinstance(obj.get('fields', {}).get('created_by'), list)
    }
    existing = set(
        User.objects.filter(username__in=usernames).values_list('username', flat=True)
    )
    dropped = 0
    for obj in objects:
        author = obj.get('fields', {}).get('created_by')
        if isinstance(author, list) and author[0] not in existing:
            obj['fields']['created_by'] = None
            dropped += 1
    return dropped


def import_backup(payload, mode='restore', tables=None, dry_run=False):
    """Load a parsed backup into the database.

    ``tables`` limits the import to those tables (default: every table present
    in the file). Returns a summary dict. Raises ``BackupError`` on invalid
    input; database errors propagate after the transaction is rolled back.
    """
    if mode not in MODES:
        raise BackupError(f"Invalid mode {mode!r}; expected one of {', '.join(MODES)}.")

    objects = payload['objects']
    for obj in objects:
        if obj.get('model') not in _LABEL_TO_TABLE:
            raise BackupError(f"Backup contains unsupported model {obj.get('model')!r}.")

    in_file = {_LABEL_TO_TABLE[obj['model']] for obj in objects} | set(payload.get('tables') or [])
    names = _resolve_tables(tables) if tables else [n for n in TABLES if n in in_file]
    missing = sorted(set(names) - in_file)
    if missing:
        raise BackupError(f"Backup file does not contain: {', '.join(missing)}.")

    selected_labels = {TABLES[n]._meta.label_lower for n in names}
    selected = [obj for obj in objects if obj['model'] in selected_labels]

    deleted = {}
    loaded = Counter()
    with transaction.atomic():
        dropped_authors = _strip_unknown_users(selected)

        if mode == 'restore':
            # Children first so cascades don't hide what was removed.
            for name in reversed(names):
                count, _ = TABLES[name].objects.all().delete()
                deleted[name] = count

        for deserialized in serializers.deserialize('python', selected):
            # raw save: keeps created_at/updated_at/expires_at from the file
            # and updates in place when the primary key already exists.
            deserialized.save()
            loaded[_LABEL_TO_TABLE[deserialized.object._meta.label_lower]] += 1

        if dry_run:
            transaction.set_rollback(True)

    return {
        'mode': mode,
        'dry_run': dry_run,
        'tables': names,
        'deleted': deleted,
        'loaded': {name: loaded.get(name, 0) for name in names},
        'authors_cleared': dropped_authors,
        'source_exported_at': payload.get('exported_at'),
        'source_core_migration': payload.get('core_migration'),
        'current_core_migration': _latest_core_migration(),
    }
