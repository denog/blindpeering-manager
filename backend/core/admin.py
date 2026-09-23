"""
Django Admin configuration for core models.
"""

from django.contrib import admin
from .models import (
    Participant, Restaurant, Assignment, EventStatus, CarpoolMessage,
    EmailLog, RestaurantComment, ParticipantComment
)


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = [
        'attendee_name', 'attendee_email', 'is_table_captain',
        'status', 'created_at'
    ]
    list_filter = ['status', 'is_table_captain']
    search_fields = ['attendee_name', 'attendee_email', 'given_name', 'family_name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ['name', 'address', 'max_seats', 'assigned_captain', 'created_at']
    list_filter = ['reservation_confirmed']
    search_fields = ['name', 'address']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['participant', 'restaurant', 'assigned_at', 'created_at']
    list_filter = ['restaurant']
    search_fields = ['participant__attendee_name', 'restaurant__name']
    readonly_fields = ['id', 'created_at']


@admin.register(EventStatus)
class EventStatusAdmin(admin.ModelAdmin):
    list_display = ['id', 'state', 'event_name', 'event_date', 'arrival_time', 'updated_at']
    fields = [
        'state', 'event_name', 'event_date', 'arrival_time',
        'assignment_email_subject', 'assignment_email_body',
        'captain_overview_email_subject', 'captain_overview_email_body',
        'updated_at',
    ]
    readonly_fields = ['id', 'updated_at']


@admin.register(CarpoolMessage)
class CarpoolMessageAdmin(admin.ModelAdmin):
    list_display = ['restaurant', 'sender', 'body', 'created_at', 'expires_at']
    list_filter = ['restaurant']
    search_fields = ['body', 'sender__attendee_name', 'restaurant__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'expires_at']

    def has_add_permission(self, request):
        # Carpool messages are only ever authored by participants through the
        # token-authenticated API, which stamps the immutable expires_at. There
        # is no sensible value for that field in a manual admin form, so adding
        # here is disabled -- staff moderation is view/delete only.
        return False


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['recipient_email', 'subject', 'email_type', 'sent_at', 'sent_by']
    list_filter = ['email_type', 'sent_at']
    search_fields = ['recipient_email', 'subject']
    readonly_fields = ['id', 'sent_at', 'created_at']


@admin.register(RestaurantComment)
class RestaurantCommentAdmin(admin.ModelAdmin):
    list_display = ['restaurant', 'comment_text', 'created_by', 'created_at']
    list_filter = ['restaurant']
    search_fields = ['comment_text']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ParticipantComment)
class ParticipantCommentAdmin(admin.ModelAdmin):
    list_display = ['participant', 'comment_text', 'created_by', 'created_at']
    list_filter = ['participant']
    search_fields = ['comment_text']
    readonly_fields = ['id', 'created_at', 'updated_at']
