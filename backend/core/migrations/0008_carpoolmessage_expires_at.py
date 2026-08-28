from datetime import timedelta

from django.conf import settings
from django.db import migrations, models


def backfill_expires_at(apps, schema_editor):
    """Give pre-existing messages a finite, immutable deadline.

    They were posted around their event, so base the deadline on ``created_at``
    plus the configured retention window rather than the current event date.
    """
    CarpoolMessage = apps.get_model('core', 'CarpoolMessage')
    retention = timedelta(days=settings.CARPOOL_MESSAGE_RETENTION_DAYS)
    for message in CarpoolMessage.objects.filter(expires_at__isnull=True):
        message.expires_at = message.created_at + retention
        message.save(update_fields=['expires_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_carpoolmessage'),
    ]

    operations = [
        migrations.AddField(
            model_name='carpoolmessage',
            name='expires_at',
            field=models.DateTimeField(
                null=True,
                help_text=(
                    'Immutable hard-delete / hide deadline, stamped from the '
                    'event date plus the retention window at the moment the '
                    'message is posted. Deliberately not recomputed when the '
                    'singleton event date later changes, so editing or clearing '
                    'that date cannot resurface or leak messages from a previous '
                    'event into a reused installation.'
                ),
            ),
        ),
        migrations.RunPython(backfill_expires_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='carpoolmessage',
            name='expires_at',
            field=models.DateTimeField(
                editable=False,
                help_text=(
                    'Immutable hard-delete / hide deadline, stamped from the '
                    'event date plus the retention window at the moment the '
                    'message is posted. Deliberately not recomputed when the '
                    'singleton event date later changes, so editing or clearing '
                    'that date cannot resurface or leak messages from a previous '
                    'event into a reused installation.'
                ),
            ),
        ),
        migrations.AddIndex(
            model_name='carpoolmessage',
            index=models.Index(fields=['expires_at'], name='carpool_mes_expires_1b75a2_idx'),
        ),
    ]
