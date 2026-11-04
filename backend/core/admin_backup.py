"""
Superuser-only admin page for exporting / importing event data as JSON.

Mounted at /admin/backup/ (see bpm/urls.py). Lets you pull a snapshot from
production and push a corrected one back purely through the browser.
"""

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.utils import timezone

from core.services import backup


def backup_view(request):
    if not request.user.is_superuser:
        raise PermissionDenied

    if request.method == 'POST' and request.POST.get('action') == 'export':
        tables = request.POST.getlist('tables')
        try:
            body = backup.export_backup_json(tables)
        except backup.BackupError as exc:
            messages.error(request, str(exc))
            return redirect(request.path)
        filename = f"bpm-backup-{timezone.now():%Y%m%d-%H%M%S}.json"
        response = HttpResponse(body, content_type='application/json; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    result = None
    if request.method == 'POST' and request.POST.get('action') == 'import':
        upload = request.FILES.get('file')
        if upload is None:
            messages.error(request, 'Choose a backup file to import.')
            return redirect(request.path)
        mode = request.POST.get('mode', 'merge')
        dry_run = request.POST.get('dry_run') == 'on'
        tables = request.POST.getlist('tables')
        try:
            payload = backup.parse_backup(upload.read())
            result = backup.import_backup(payload, mode=mode, tables=tables, dry_run=dry_run)
        except backup.BackupError as exc:
            messages.error(request, str(exc))
        except Exception as exc:  # DB integrity errors etc.; transaction already rolled back
            messages.error(request, f'Import failed and was rolled back: {exc.__class__.__name__}: {exc}')
        else:
            verb = 'Dry run OK (nothing was changed)' if dry_run else 'Import complete'
            messages.success(request, f"{verb}: {sum(result['loaded'].values())} rows loaded.")

    context = {
        **admin.site.each_context(request),
        'title': 'Backup: export / import data',
        'tables': list(backup.TABLES),
        'result': result,
        'result_rows': [
            (name, result['deleted'].get(name, '-'), loaded)
            for name, loaded in result['loaded'].items()
        ] if result else [],
    }
    return TemplateResponse(request, 'admin/core/backup.html', context)
