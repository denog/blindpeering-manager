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
class AssignmentApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw')
        )
        self.first = Restaurant.objects.create(name='A', address='1', max_seats=4)
        self.second = Restaurant.objects.create(name='B', address='2', max_seats=4)
        self.guest = Participant.objects.create(
            given_name='G', family_name='X', attendee_name='G',
            attendee_email='g@example.com',
        )

    def _assign(self, participant, restaurant):
        return self.client.post(
            reverse('assignment-list'),
            {'participant': str(participant.pk), 'restaurant': str(restaurant.pk)},
            format='json',
        )

    def test_reassigning_participant_moves_them(self):
        self.assertEqual(self._assign(self.guest, self.first).status_code,
                         status.HTTP_201_CREATED)
        response = self._assign(self.guest, self.second)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Assignment.objects.count(), 1)
        self.assertEqual(Assignment.objects.get().restaurant, self.second)

    def test_captain_cannot_be_assigned(self):
        self.guest.is_table_captain = True
        self.guest.save()
        response = self._assign(self.guest, self.first)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('participant', response.data)
        self.assertFalse(Assignment.objects.exists())


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

        # Soft delete: row stays as a placeholder, but the text is gone.
        message.refresh_from_db()
        self.assertIsNotNone(message.deleted_at)
        self.assertEqual(message.body, '')

        cache.clear()
        board = self.client.get(self._board_url(self.bob)).json()
        [shown] = board['messages']
        self.assertTrue(shown['is_deleted'])
        self.assertEqual(shown['body'], '')

        # Deleting again is a 404, not a second "delete".
        cache.clear()
        again = self.client.delete(
            reverse('carpool-delete-message', args=[self.alice.carpool_token, message.id])
        )
        self.assertEqual(again.status_code, status.HTTP_404_NOT_FOUND)

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


class BackupTests(TestCase):
    def setUp(self):
        from core.models import EmailLog, ParticipantComment
        self.admin = User.objects.create_superuser('admin', 'a@example.com', 'pw')
        status_obj = EventStatus.get_current()
        status_obj.event_name = 'Original'
        status_obj.save()
        self.captain = Participant.objects.create(
            given_name='C', family_name='Cap', attendee_name='C Cap',
            attendee_email='c@example.com', is_table_captain=True,
        )
        self.guest = Participant.objects.create(
            given_name='G', family_name='Guest', attendee_name='G Guest',
            attendee_email='g@example.com',
        )
        self.restaurant = Restaurant.objects.create(
            name='R', address='A', max_seats=4, assigned_captain=self.captain,
        )
        Assignment.objects.create(participant=self.guest, restaurant=self.restaurant)
        ParticipantComment.objects.create(
            participant=self.guest, comment_text='hi', created_by=self.admin,
        )
        EmailLog.objects.create(
            participant=self.guest, restaurant=self.restaurant,
            email_type='initial_assignment', recipient_email='g@example.com',
            subject='s', body_text='b',
        )

    def _roundtrip(self, payload):
        import json
        from core.services import backup
        return backup.parse_backup(json.dumps(payload))

    def test_restore_roundtrip_preserves_rows_and_timestamps(self):
        from core.services import backup
        payload = self._roundtrip(backup.export_backup())
        created = Participant.objects.get(pk=self.guest.pk).created_at
        token = Participant.objects.get(pk=self.guest.pk).carpool_token

        Participant.objects.all().delete()
        EventStatus.objects.update(event_name='Broken')

        result = backup.import_backup(payload, mode='restore')
        self.assertEqual(result['loaded']['participants'], 2)
        guest = Participant.objects.get(pk=self.guest.pk)
        self.assertEqual(guest.created_at, created)
        self.assertEqual(guest.carpool_token, token)
        self.assertEqual(guest.assignment.restaurant_id, self.restaurant.pk)
        self.assertEqual(Restaurant.objects.get().assigned_captain_id, self.captain.pk)
        self.assertEqual(EventStatus.get_current().event_name, 'Original')
        self.assertEqual(guest.comments.get().created_by, self.admin)

    def test_merge_single_table_leaves_others_untouched(self):
        from core.services import backup
        payload = self._roundtrip(backup.export_backup(['event_status']))
        EventStatus.objects.update(event_name='Broken')
        extra = Participant.objects.create(
            given_name='N', family_name='New', attendee_name='N New',
            attendee_email='n@example.com',
        )
        backup.import_backup(payload, mode='merge')
        self.assertEqual(EventStatus.get_current().event_name, 'Original')
        self.assertTrue(Participant.objects.filter(pk=extra.pk).exists())
        self.assertEqual(Assignment.objects.count(), 1)

    def test_dry_run_changes_nothing(self):
        from core.services import backup
        payload = self._roundtrip(backup.export_backup())
        EventStatus.objects.update(event_name='Broken')
        backup.import_backup(payload, mode='restore', dry_run=True)
        self.assertEqual(EventStatus.get_current().event_name, 'Broken')

    def test_unknown_comment_author_is_cleared(self):
        from core.services import backup
        payload = self._roundtrip(backup.export_backup(['participant_comments']))
        for obj in payload['objects']:
            obj['fields']['created_by'] = ['ghost']
        result = backup.import_backup(payload, mode='merge')
        self.assertEqual(result['authors_cleared'], 1)

    def test_rejects_foreign_file(self):
        from core.services import backup
        with self.assertRaises(backup.BackupError):
            backup.parse_backup('[{"model": "auth.user"}]')

    def test_admin_page_export_and_import(self):
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        url = reverse('admin-backup')
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(url).status_code, 200)

        resp = self.client.post(url, {'action': 'export', 'tables': ['event_status']})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('attachment', resp['Content-Disposition'])
        body = resp.content

        EventStatus.objects.update(event_name='Broken')
        resp = self.client.post(url, {
            'action': 'import', 'mode': 'merge',
            'file': SimpleUploadedFile('b.json', body, 'application/json'),
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(EventStatus.get_current().event_name, 'Original')
        self.assertEqual(json.loads(body)['counts'], {'event_status': 1})

    def test_admin_page_requires_superuser(self):
        staff = User.objects.create_user('staff', 's@example.com', 'pw', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get(reverse('admin-backup')).status_code, 403)


class AdminCsvTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', 'a@example.com', 'pw')
        self.client.force_login(self.admin)
        self.alice = Participant.objects.create(
            given_name='Alice', family_name='A', attendee_name='Alice A',
            attendee_email='alice@example.com',
        )
        self.restaurant = Restaurant.objects.create(name='R', address='A', max_seats=4)
        self.other = Restaurant.objects.create(name='S', address='B', max_seats=4)
        Assignment.objects.create(participant=self.alice, restaurant=self.restaurant)

    def test_admin_lives_under_dj_admin(self):
        self.assertEqual(reverse('admin:index'), '/dj-admin/')
        self.assertEqual(reverse('admin-backup'), '/dj-admin/backup/')

    def _export(self, model_name):
        url = reverse(f'admin:core_{model_name}_export')
        resp = self.client.post(url, {'format': '0', **self._all_fields(url)})
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        self.assertIn('attachment', resp['Content-Disposition'])
        return resp.content.decode('utf-8-sig')

    def _all_fields(self, url):
        # The v4 export form has one checkbox per resource field; tick them all.
        form = self.client.get(url).context['form']
        return {name: 'on' for name in form.fields if name not in ('format', 'resource', 'export_items')}

    def _import(self, model_name, csv_text):
        from django.core.files.uploadedfile import SimpleUploadedFile
        url = reverse(f'admin:core_{model_name}_import')
        resp = self.client.post(url, {
            'format': '0',
            'import_file': SimpleUploadedFile('x.csv', csv_text.encode(), 'text/csv'),
        })
        self.assertEqual(resp.status_code, 200)
        confirm = resp.context.get('confirm_form')
        self.assertIsNotNone(confirm, resp.content.decode()[:2000])
        resp = self.client.post(
            reverse(f'admin:core_{model_name}_process_import'), confirm.initial,
        )
        self.assertEqual(resp.status_code, 302)

    def test_changelists_show_import_export(self):
        for name in ['participant', 'restaurant', 'assignment', 'carpoolmessage']:
            resp = self.client.get(reverse(f'admin:core_{name}_changelist'))
            self.assertContains(resp, reverse(f'admin:core_{name}_import'))
            self.assertContains(resp, reverse(f'admin:core_{name}_export'))

    def test_participant_export_omits_carpool_token(self):
        body = self._export('participant')
        self.assertIn('alice@example.com', body)
        self.assertNotIn('carpool_token', body)
        self.assertNotIn(self.alice.carpool_token, body)

    def test_participant_round_trip_updates_and_creates(self):
        body = self._export('participant')
        header, row = body.strip().splitlines()[:2]
        body = body.replace('Alice A', 'Alice Changed')
        cols = header.split(',')
        new = dict.fromkeys(cols, '')
        new.update(given_name='Bob', family_name='B', attendee_name='Bob B',
                   attendee_email='bob@example.com', status='registered',
                   is_table_captain='0', manual_status_override='0',
                   manual_email_override='0')
        body = body.strip() + '\n' + ','.join(new[c] for c in cols) + '\n'
        token = self.alice.carpool_token
        self._import('participant', body)

        self.alice.refresh_from_db()
        self.assertEqual(self.alice.attendee_name, 'Alice Changed')
        self.assertEqual(self.alice.carpool_token, token)
        bob = Participant.objects.get(attendee_email='bob@example.com')
        self.assertTrue(bob.carpool_token)

    def test_assignment_import_moves_participant(self):
        self._import(
            'assignment',
            f'participant,restaurant\n{self.alice.id},{self.other.id}\n',
        )
        self.assertEqual(Assignment.objects.get().restaurant, self.other)

    def test_restaurant_and_carpool_export(self):
        self.assertIn('R', self._export('restaurant'))
        EventStatus.objects.update_or_create(id='default', defaults={})
        CarpoolMessage.objects.create(
            restaurant=self.restaurant, sender=self.alice, body='lift?',
            expires_at=timezone.now() + timedelta(days=1),
        )
        body = self._export('carpoolmessage')
        self.assertIn('lift?', body)
        self.assertIn('Alice A', body)
