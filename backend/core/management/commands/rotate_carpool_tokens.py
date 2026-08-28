"""
Management command for regenerating every participant's carpool magic-link token.

Run this when reusing the installation for a new event: participant rows (and
therefore their carpool tokens) survive a Pretix re-sync, so without rotation a
token leaked or shared for the previous event would keep working against the new
event's board once that participant is reassigned to a table.

Pass --purge-messages to also delete every existing carpool message in the same
step -- messages carry an immutable expiry, but a new event configured before
the old window elapses could otherwise still surface old messages at a reused
restaurant. Rotating + purging closes that gap for the reuse case.
"""

from django.core.management.base import BaseCommand

from core.models import CarpoolMessage, Participant, generate_carpool_token


class Command(BaseCommand):
    help = "Regenerate every participant's carpool token, invalidating all existing magic links"

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip the confirmation prompt (for non-interactive use).',
        )
        parser.add_argument(
            '--purge-messages',
            action='store_true',
            help='Also delete all existing carpool messages (use when reusing '
                 'the installation for a new event).',
        )

    def handle(self, *args, **options):
        count = Participant.objects.count()
        if count == 0:
            self.stdout.write('No participants; nothing to rotate.')
            return

        purge = options['purge_messages']
        if not options['yes']:
            extra = ' and delete ALL carpool messages' if purge else ''
            confirm = input(
                f'Rotate carpool tokens for {count} participant(s){extra}? '
                'Every existing carpool link stops working. [y/N] '
            )
            if confirm.strip().lower() != 'y':
                self.stdout.write('Aborted.')
                return

        if purge:
            deleted, _ = CarpoolMessage.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} carpool message(s).'))

        updated = 0
        for participant in Participant.objects.all().iterator():
            participant.carpool_token = generate_carpool_token()
            participant.save(update_fields=['carpool_token'])
            updated += 1

        self.stdout.write(self.style.SUCCESS(f'Rotated {updated} carpool token(s).'))
