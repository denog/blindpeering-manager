"""
Core models for the BPM application.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from core import email_templates


class ParticipantStatus(models.TextChoices):
    REGISTERED = 'registered', 'Registered'
    CANCELLED = 'cancelled', 'Cancelled'
    LATE_JOINER = 'late_joiner', 'Late Joiner'


class WorkflowState(models.TextChoices):
    SETUP = 'setup', 'Setup'
    CAPTAINS_ASSIGNED = 'captains_assigned', 'Captains Assigned'
    PARTICIPANTS_ASSIGNED = 'participants_assigned', 'Participants Assigned'
    FINALIZED = 'finalized', 'Finalized'


class EmailType(models.TextChoices):
    INITIAL_ASSIGNMENT = 'initial_assignment', 'Initial Assignment'
    FINAL_ASSIGNMENT = 'final_assignment', 'Final Assignment'
    INDIVIDUAL_UPDATE = 'individual_update', 'Individual Update'
    CAPTAIN_OVERVIEW = 'captain_overview', 'Captain Overview'


class TimestampedModel(models.Model):
    """Abstract base class with auto timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Participant(TimestampedModel):
    """Event participant/attendee."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pretix_id = models.IntegerField(unique=True, null=True, blank=True)
    given_name = models.CharField(max_length=255)
    family_name = models.CharField(max_length=255)
    attendee_name = models.CharField(max_length=255)
    attendee_email = models.EmailField()
    is_table_captain = models.BooleanField(default=False)
    captain_phone = models.CharField(max_length=50, null=True, blank=True)
    captain_preferred_contact = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ParticipantStatus.choices,
        default=ParticipantStatus.REGISTERED
    )
    manual_status_override = models.BooleanField(
        default=False,
        help_text='True if status was manually set and should not be overridden by Pretix sync'
    )
    manual_email_override = models.BooleanField(
        default=False,
        help_text='True if email was manually changed and should not be overridden by Pretix sync'
    )

    class Meta:
        db_table = 'participants'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.attendee_name} ({self.attendee_email})"


class Restaurant(TimestampedModel):
    """Restaurant/venue for event dinner."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    address = models.TextField()
    phone = models.CharField(max_length=50, null=True, blank=True)
    taxi_time = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Travel time by taxi in minutes'
    )
    public_transport_time = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Travel time by public transport in minutes'
    )
    public_transport_lines = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Public transport lines/routes'
    )
    max_seats = models.PositiveIntegerField(help_text='Maximum seating capacity')
    assigned_captain = models.ForeignKey(
        Participant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='captained_restaurants'
    )
    reservation_channel = models.CharField(max_length=255, null=True, blank=True)
    reservation_name = models.CharField(max_length=255, null=True, blank=True)
    reservation_confirmed = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'restaurants'
        ordering = ['name']

    def __str__(self):
        return self.name


class Assignment(models.Model):
    """Participant to restaurant assignment."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.OneToOneField(
        Participant,
        on_delete=models.CASCADE,
        related_name='assignment'
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assignments'
        indexes = [
            models.Index(fields=['restaurant']),
        ]

    def __str__(self):
        return f"{self.participant} -> {self.restaurant}"


class EventStatus(models.Model):
    """Singleton model for tracking event workflow state and settings."""
    id = models.CharField(max_length=50, primary_key=True, default='default')
    state = models.CharField(
        max_length=30,
        choices=WorkflowState.choices,
        default=WorkflowState.SETUP
    )
    event_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date of the event (e.g., 2025-11-09)'
    )
    arrival_time = models.TimeField(
        null=True,
        blank=True,
        help_text='Time guests should arrive (e.g., 19:00)'
    )
    event_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Name of the event, available in email templates as {event_name}'
    )
    assignment_email_subject = models.CharField(
        max_length=255,
        default=email_templates.DEFAULT_ASSIGNMENT_EMAIL_SUBJECT,
        help_text='Subject line for the participant restaurant assignment email'
    )
    assignment_email_body = models.TextField(
        default=email_templates.DEFAULT_ASSIGNMENT_EMAIL_BODY,
        help_text='Body for the participant restaurant assignment email'
    )
    captain_overview_email_subject = models.CharField(
        max_length=255,
        default=email_templates.DEFAULT_CAPTAIN_OVERVIEW_EMAIL_SUBJECT,
        help_text='Subject line for the table captain guest list email'
    )
    captain_overview_email_body = models.TextField(
        default=email_templates.DEFAULT_CAPTAIN_OVERVIEW_EMAIL_BODY,
        help_text='Body for the table captain guest list email'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'event_status'

    def __str__(self):
        return f"Event Status: {self.state}"

    @classmethod
    def get_current(cls):
        """Get or create the current event status."""
        status, _ = cls.objects.get_or_create(
            id='default',
            defaults={'state': WorkflowState.SETUP}
        )
        return status


class EmailLog(models.Model):
    """Log of sent emails."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='email_logs'
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='email_logs'
    )
    email_type = models.CharField(max_length=30, choices=EmailType.choices)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=500)
    body_text = models.TextField()
    sent_at = models.DateTimeField(default=timezone.now)
    sent_by = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['participant']),
            models.Index(fields=['-sent_at']),
        ]

    def __str__(self):
        return f"Email to {self.recipient_email}: {self.subject[:30]}"


class RestaurantComment(TimestampedModel):
    """Comment on a restaurant."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    comment_text = models.TextField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='restaurant_comments'
    )

    class Meta:
        db_table = 'restaurant_comments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['restaurant']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Comment on {self.restaurant.name}"


class ParticipantComment(TimestampedModel):
    """Comment on a participant."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    comment_text = models.TextField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='participant_comments'
    )

    class Meta:
        db_table = 'participant_comments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['participant']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Comment on {self.participant.attendee_name}"
