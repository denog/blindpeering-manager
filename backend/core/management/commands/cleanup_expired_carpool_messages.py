"""
Management command for hard-deleting carpool messages past their retention window.

No scheduler runs inside this app (same as sync_pretix) -- invoke this
periodically via external cron. Each message carries its own immutable
``expires_at`` (stamped at post time), so this works regardless of the current
singleton event date, including after the date is cleared or the installation
is reused for another event. The 410 expiry check in the carpool views is the
real access-control backstop; this command is data minimization.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import CarpoolMessage


class Command(BaseCommand):
    help = 'Hard-delete carpool messages once they are past their retention window'

    def handle(self, *args, **options):
        deleted, _ = CarpoolMessage.objects.filter(
            expires_at__lte=timezone.now()
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(f'Deleted {deleted} expired carpool message(s).')
        )
