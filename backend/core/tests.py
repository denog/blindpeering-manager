from datetime import timedelta
from unittest import mock

from django.core import management
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import (
    Assignment, CarpoolMessage, EventStatus, Participant, ParticipantStatus,
    Restaurant,
)

class BasicTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='password'
        )
        self.client.force_authenticate(user=self.user)

    def test_health_check(self):
        """Test the health check endpoint."""
        url = reverse('health-check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')

    def test_create_participant(self):
        """Test creating a participant via API."""
        url = reverse('participant-list')
        data = {
            'given_name': 'John',
            'family_name': 'Doe',
            'attendee_name': 'John Doe',
            'attendee_email': 'john@example.com'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Participant.objects.count(), 1)
        self.assertEqual(Participant.objects.first().attendee_name, 'John Doe')

    def test_create_restaurant(self):
        """Test creating a restaurant via API."""
        url = reverse('restaurant-list')
        data = {
            'name': 'Great Pasta',
            'address': '123 Italian Way',
            'max_seats': 20
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Restaurant.objects.count(), 1)

    def test_bulk_import_participants(self):
        """Test bulk import of participants."""
        url = reverse('participant-bulk-import')
        data = [
            {'attendee_name': 'User 1', 'attendee_email': 'u1@example.com', 'given_name': 'U', 'family_name': '1'},
            {'attendee_name': 'User 2', 'attendee_email': 'u2@example.com', 'given_name': 'U', 'family_name': '2'}
        ]
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['succeeded'], 2)
        self.assertEqual(Participant.objects.count(), 2)


@override_settings(CARPOOL_MESSAGE_RETENTION_DAYS=3)
class CarpoolBoardTests(APITestCase):
    """Public, token-authenticated carpool board (finding #1 and #2 hardening)."""

    def setUp(self):
        cache.clear()  # DRF throttles use the default cache
        self.event = EventStatus.get_current()
        self.event.event_date = timezone.now().date()
        self.event.save()

        self.restaurant = Restaurant.objects.create(
            name='Trattoria', address='1 Main St', max_seats=10,
        )
        self.other_restaurant = Restaurant.objects.create(
            name='Bistro', address='2 Side St', max_seats=10,
        )
        self.alice = self._participant('Alice')
        self.bob = self._participant('Bob')
        self.carol = self._participant('Carol')  # different table
        Assignment.objects.create(participant=self.alice, restaurant=self.restaurant)
        Assignment.objects.create(participant=self.bob, restaurant=self.restaurant)
        Assignment.objects.create(participant=self.carol, restaurant=self.other_restaurant)

    def _participant(self, name):
        return Participant.objects.create(
            given_name=name, family_name='X', attendee_name=name,
            attendee_email=f'{name.lower()}@example.com',
        )

    def _board_url(self, participant):
        return reverse('carpool-board', args=[participant.carpool_token])

    def _post_url(self, participant):
        return reverse('carpool-post-message', args=[participant.carpool_token])

    def test_board_lists_only_own_table_messages(self):
        self.client.post(self._post_url(self.alice), {'body': 'I can drive 3'}, format='json')
        self.client.post(self._post_url(self.carol), {'body': 'other table'}, format='json')

        response = self.client.get(self._board_url(self.bob))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bodies = [m['body'] for m in response.data['messages']]
        self.assertEqual(bodies, ['I can drive 3'])

    def test_is_mine_flag_is_per_viewer(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        cache.clear()

        alice_view = self.client.get(self._board_url(self.alice)).data['messages'][0]
        bob_view = self.client.get(self._board_url(self.bob)).data['messages'][0]
        self.assertTrue(alice_view['is_mine'])
        self.assertFalse(bob_view['is_mine'])

    def test_posted_message_expiry_is_stamped_from_event_date(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        message = CarpoolMessage.objects.get()
        expected_day = self.event.event_date + timedelta(days=3)
        self.assertEqual(timezone.localtime(message.expires_at).date(), expected_day)

    def test_message_expiry_not_moved_by_later_event_date_change(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        original = CarpoolMessage.objects.get().expires_at

        self.event.event_date = self.event.event_date + timedelta(days=30)
        self.event.save()

        self.assertEqual(CarpoolMessage.objects.get().expires_at, original)

    def test_board_hides_expired_messages(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        CarpoolMessage.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        cache.clear()

        response = self.client.get(self._board_url(self.bob))
        self.assertEqual(response.data['messages'], [])

    def test_access_fails_closed_without_event_date(self):
        self.event.event_date = None
        self.event.save()
        cache.clear()

        self.assertEqual(
            self.client.get(self._board_url(self.alice)).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                self._post_url(self.alice), {'body': 'ride'}, format='json'
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_access_gone_after_retention_window(self):
        self.event.event_date = timezone.now().date() - timedelta(days=4)
        self.event.save()
        cache.clear()

        self.assertEqual(
            self.client.get(self._board_url(self.alice)).status_code,
            status.HTTP_410_GONE,
        )

    def test_invalid_cancelled_and_unassigned_tokens_are_rejected(self):
        self.assertEqual(
            self.client.get(reverse('carpool-board', args=['nope'])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.alice.status = ParticipantStatus.CANCELLED
        self.alice.save()
        cache.clear()
        self.assertEqual(
            self.client.get(self._board_url(self.alice)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        dangling = self._participant('Dave')
        self.assertEqual(
            self.client.get(self._board_url(dangling)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_is_limited_to_own_messages(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        message = CarpoolMessage.objects.get()
        cache.clear()

        bob_delete = self.client.delete(
            reverse('carpool-delete-message', args=[self.bob.carpool_token, message.id])
        )
        self.assertEqual(bob_delete.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(CarpoolMessage.objects.filter(id=message.id).exists())

        cache.clear()
        alice_delete = self.client.delete(
            reverse('carpool-delete-message', args=[self.alice.carpool_token, message.id])
        )
        self.assertEqual(alice_delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CarpoolMessage.objects.filter(id=message.id).exists())

    @mock.patch.dict(
        'rest_framework.throttling.SimpleRateThrottle.THROTTLE_RATES',
        {'carpool-read': '4/hour'},
    )
    def test_read_throttle_is_scoped_per_token_not_per_ip(self):
        for _ in range(4):
            self.assertEqual(
                self.client.get(self._board_url(self.alice)).status_code,
                status.HTTP_200_OK,
            )
        # 5th request on the same token is throttled...
        self.assertEqual(
            self.client.get(self._board_url(self.alice)).status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )
        # ...but a different participant's token has its own bucket (same IP).
        self.assertEqual(
            self.client.get(self._board_url(self.bob)).status_code,
            status.HTTP_200_OK,
        )

    def test_carpool_token_not_exposed_by_staff_serializer(self):
        staff = User.objects.create_superuser('admin', 'admin@example.com', 'pw')
        self.client.force_authenticate(user=staff)
        response = self.client.get(reverse('assignment-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('carpool_token', str(response.data))

    def test_cleanup_command_deletes_only_expired(self):
        self.client.post(self._post_url(self.alice), {'body': 'live'}, format='json')
        self.client.post(self._post_url(self.bob), {'body': 'dead'}, format='json')
        CarpoolMessage.objects.filter(sender=self.bob).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        management.call_command('cleanup_expired_carpool_messages')

        remaining = list(CarpoolMessage.objects.values_list('body', flat=True))
        self.assertEqual(remaining, ['live'])

    def test_rotate_tokens_command_invalidates_existing_links(self):
        old_url = self._board_url(self.alice)
        management.call_command('rotate_carpool_tokens', '--yes')

        cache.clear()
        self.assertEqual(
            self.client.get(old_url).status_code, status.HTTP_404_NOT_FOUND
        )
        self.alice.refresh_from_db()
        cache.clear()
        self.assertEqual(
            self.client.get(self._board_url(self.alice)).status_code,
            status.HTTP_200_OK,
        )

    def test_table_captain_can_access_their_board_without_an_assignment(self):
        # Captains are linked via Restaurant.assigned_captain, not an Assignment.
        captain = self._participant('Kim')
        captain.is_table_captain = True
        captain.save()
        self.restaurant.assigned_captain = captain
        self.restaurant.save()

        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        cache.clear()

        response = self.client.get(self._board_url(captain))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['restaurant_name'], self.restaurant.name)
        self.assertEqual([m['body'] for m in response.data['messages']], ['ride'])

        cache.clear()
        posted = self.client.post(
            self._post_url(captain), {'body': 'I have room for 2'}, format='json'
        )
        self.assertEqual(posted.status_code, status.HTTP_201_CREATED)

    def test_rotate_tokens_purge_messages_flag(self):
        self.client.post(self._post_url(self.alice), {'body': 'ride'}, format='json')
        self.assertEqual(CarpoolMessage.objects.count(), 1)

        management.call_command('rotate_carpool_tokens', '--yes', '--purge-messages')

        self.assertEqual(CarpoolMessage.objects.count(), 0)

    def test_admin_disallows_adding_carpool_messages(self):
        from django.contrib.admin.sites import site

        from .admin import CarpoolMessageAdmin

        model_admin = CarpoolMessageAdmin(CarpoolMessage, site)
        self.assertFalse(model_admin.has_add_permission(request=None))
