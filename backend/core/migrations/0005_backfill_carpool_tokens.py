import secrets

from django.db import migrations


def backfill_carpool_tokens(apps, schema_editor):
    """Step 2/3: assign each existing participant their own unique token."""
    Participant = apps.get_model('core', 'Participant')
    for participant in Participant.objects.filter(carpool_token__isnull=True):
        participant.carpool_token = secrets.token_urlsafe(32)
        participant.save(update_fields=['carpool_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_participant_carpool_token'),
    ]

    operations = [
        migrations.RunPython(backfill_carpool_tokens, migrations.RunPython.noop),
    ]
