"""
Pretix sync service for syncing participants from Pretix ticketing system.
"""

import requests
import logging
from django.conf import settings
from django.db import transaction
from core.models import Participant

logger = logging.getLogger(__name__)


class PretixSyncService:
    """Service for syncing participants from Pretix API."""

    def __init__(self):
        self.api_token = settings.PRETIX_API_TOKEN
        self.event = settings.PRETIX_EVENT
        self.organizer = settings.PRETIX_ORGANIZER
        self.local_list_id = settings.PRETIX_CHECKIN_LIST_ID_LOCAL
        self.global_list_id = settings.PRETIX_CHECKIN_LIST_ID_GLOBAL

    def _fetch_positions(self, checkin_list_id):
        """Fetch all positions from a checkin list with pagination."""
        positions = []
        page = 1

        while True:
            url = (
                f'https://pretix.eu/api/v1/organizers/{self.organizer}/'
                f'events/{self.event}/checkinlists/{checkin_list_id}/positions/'
                f'?page={page}'
            )

            response = requests.get(
                url,
                headers={
                    'Authorization': f'Token {self.api_token}',
                    'Content-Type': 'application/json'
                },
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            positions.extend(data['results'])

            if not data['next']:
                break
            page += 1

        return positions

    def sync(self):
        """
        Sync participants from Pretix to database.
        Wrapped in transaction.atomic to ensure consistent state.
        """
        missing = []
        if not self.api_token:
            missing.append('PRETIX_API_TOKEN')
        if not self.event:
            missing.append('PRETIX_EVENT')
        if not self.local_list_id:
            missing.append('PRETIX_CHECKIN_LIST_ID_LOCAL')
        if not self.global_list_id:
            missing.append('PRETIX_CHECKIN_LIST_ID_GLOBAL')

        if missing:
            logger.error(f'Missing Pretix configuration: {missing}')
            raise ValueError(f'Missing Pretix configuration: {", ".join(missing)}')

        result = {
            'newParticipants': 0,
            'updatedParticipants': 0,
            'cancelledParticipants': 0,
            'errors': []
        }

        # Fetch existing participants from DB
        existing = {
            p.pretix_id: p
            for p in Participant.objects.filter(pretix_id__isnull=False)
        }
        existing_pretix_ids = set(existing.keys())

        try:
            logger.info('Fetching positions from GLOBAL checkin list...')
            global_positions = self._fetch_positions(self.global_list_id)
            logger.info(f'Found {len(global_positions)} positions in GLOBAL list')

            logger.info('Fetching positions from LOCAL checkin list...')
            local_positions = self._fetch_positions(self.local_list_id)
            logger.info(f'Found {len(local_positions)} positions in LOCAL list')
        except Exception as e:
            logger.exception('Failed to fetch data from Pretix API')
            raise

        # Build email lookup maps from both lists
        email_by_order = {}
        email_by_position = {}

        for pos in global_positions + local_positions:
            if pos.get('attendee_email'):
                email_by_order[pos['order']] = pos['attendee_email']
                email_by_position[pos['id']] = pos['attendee_email']

        # Determine which main tickets to sync based on LOCAL list
        main_tickets_to_sync = set()
        for pos in local_positions:
            main_ticket_id = pos.get('addon_to') or pos['id']
            main_tickets_to_sync.add(main_ticket_id)

        logger.info(f'Found {len(main_tickets_to_sync)} unique main tickets to sync from LOCAL list')

        # Process main tickets in an atomic transaction
        pretix_ids_from_pretix = set()

        with transaction.atomic():
            for pos in global_positions:
                # Skip add-ons (we only sync main tickets)
                if pos.get('addon_to') is not None:
                    continue

                # Skip if not in LOCAL list (which defines the subset for this event)
                if pos['id'] not in main_tickets_to_sync:
                    continue

                pretix_ids_from_pretix.add(pos['id'])

                # Get email using multiple strategies (sometimes it's only on the order)
                email = (
                    pos.get('attendee_email') or
                    email_by_position.get(pos['id']) or
                    email_by_order.get(pos['order'])
                )

                if not email:
                    logger.warning(f"No email found for Pretix ID {pos['id']} (order: {pos['order']})")
                    result['errors'].append({
                        'pretixId': pos['id'],
                        'reason': f"No email found (order: {pos['order']})"
                    })
                    continue

                participant_data = {
                    'pretix_id': pos['id'],
                    'given_name': pos['attendee_name_parts'].get('given_name', ''),
                    'family_name': pos['attendee_name_parts'].get('family_name', ''),
                    'attendee_name': pos['attendee_name'],
                    'attendee_email': email,
                }

                existing_participant = existing.get(pos['id'])

                if existing_participant:
                    # Update existing participant
                    update_fields = ['given_name', 'family_name', 'attendee_name', 'updated_at']

                    existing_participant.given_name = participant_data['given_name']
                    existing_participant.family_name = participant_data['family_name']
                    existing_participant.attendee_name = participant_data['attendee_name']

                    # Only update email if not manually overridden
                    if not existing_participant.manual_email_override:
                        if existing_participant.attendee_email != email:
                            existing_participant.attendee_email = email
                            update_fields.append('attendee_email')

                    # Restore to registered if was cancelled and not manually overridden
                    if (not existing_participant.manual_status_override and
                            existing_participant.status == 'cancelled'):
                        existing_participant.status = 'registered'
                        update_fields.append('status')

                    try:
                        existing_participant.save(update_fields=update_fields)
                        result['updatedParticipants'] += 1
                    except Exception as e:
                        logger.error(f"Failed to update participant {pos['id']}: {e}")
                        result['errors'].append({
                            'pretixId': pos['id'],
                            'reason': f'Update failed: {str(e)}'
                        })
                else:
                    # Create new participant
                    try:
                        Participant.objects.create(**participant_data)
                        result['newParticipants'] += 1
                    except Exception as e:
                        logger.error(f"Failed to create participant {pos['id']}: {e}")
                        result['errors'].append({
                            'pretixId': pos['id'],
                            'reason': f'Insert failed: {str(e)}'
                        })

            # Mark removed participants as cancelled
            # (Those that are in our DB but no longer in the Pretix sync subset)
            for pretix_id in existing_pretix_ids - pretix_ids_from_pretix:
                participant = existing[pretix_id]
                if (participant.status != 'cancelled' and
                        not participant.manual_status_override):
                    try:
                        participant.status = 'cancelled'
                        participant.save(update_fields=['status', 'updated_at'])
                        result['cancelledParticipants'] += 1
                    except Exception as e:
                        logger.error(f"Failed to cancel participant {pretix_id}: {e}")
                        result['errors'].append({
                            'pretixId': pretix_id,
                            'reason': f'Failed to mark as cancelled: {str(e)}'
                        })

        logger.info(f'Sync completed: {result}')
        return result
