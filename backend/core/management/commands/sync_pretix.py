"""
Management command for syncing participants from Pretix.
"""

from django.core.management.base import BaseCommand
from core.services.pretix import PretixSyncService


class Command(BaseCommand):
    help = 'Sync participants from Pretix ticketing system'

    def handle(self, *args, **options):
        self.stdout.write('Starting Pretix sync...')

        try:
            service = PretixSyncService()
            result = service.sync()

            self.stdout.write(
                self.style.SUCCESS(
                    f'Sync complete: '
                    f'{result["newParticipants"]} new, '
                    f'{result["updatedParticipants"]} updated, '
                    f'{result["cancelledParticipants"]} cancelled'
                )
            )

            if result['errors']:
                self.stdout.write(self.style.WARNING(f'Errors: {len(result["errors"])}'))
                for error in result['errors']:
                    self.stdout.write(f'  - Pretix ID {error["pretixId"]}: {error["reason"]}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Sync failed: {e}'))
            raise
