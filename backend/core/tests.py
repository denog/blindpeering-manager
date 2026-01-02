from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Participant, Restaurant, Assignment

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
