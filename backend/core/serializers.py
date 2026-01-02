"""
DRF serializers for core models.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Participant, Restaurant, Assignment, EventStatus,
    EmailLog, RestaurantComment, ParticipantComment,
    EmailType
)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for Django User model."""
    class Meta:
        model = User
        fields = ['id', 'email', 'username']


class ParticipantSerializer(serializers.ModelSerializer):
    """Serializer for Participant model."""
    class Meta:
        model = Participant
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RestaurantListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for restaurant lists."""
    assigned_captain_id = serializers.PrimaryKeyRelatedField(
        source='assigned_captain',
        queryset=Participant.objects.all(),
        required=False,
        allow_null=True
    )
    assignment_count = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_captain']

    def get_assignment_count(self, obj):
        return obj.assignments.count()


class RestaurantSerializer(serializers.ModelSerializer):
    """Full serializer for Restaurant model with nested captain."""
    assigned_captain_data = ParticipantSerializer(
        source='assigned_captain',
        read_only=True
    )
    assigned_captain_id = serializers.PrimaryKeyRelatedField(
        source='assigned_captain',
        queryset=Participant.objects.all(),
        required=False,
        allow_null=True
    )
    assignment_count = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_captain']

    def get_assignment_count(self, obj):
        return obj.assignments.count()


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Assignment model with nested relations."""
    participant_id = serializers.PrimaryKeyRelatedField(
        source='participant',
        queryset=Participant.objects.all()
    )
    restaurant_id = serializers.PrimaryKeyRelatedField(
        source='restaurant',
        queryset=Restaurant.objects.all()
    )
    participant_data = ParticipantSerializer(source='participant', read_only=True)
    restaurant_data = RestaurantListSerializer(source='restaurant', read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'participant_id', 'restaurant_id', 'participant_data',
            'restaurant_data', 'assigned_at', 'created_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'created_at']


class AssignmentWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating assignments."""
    class Meta:
        model = Assignment
        fields = ['participant', 'restaurant']


class EventStatusSerializer(serializers.ModelSerializer):
    """Serializer for EventStatus model."""
    class Meta:
        model = EventStatus
        fields = ['id', 'state', 'event_date', 'arrival_time', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class EmailLogSerializer(serializers.ModelSerializer):
    """Serializer for EmailLog model."""
    participant_name = serializers.CharField(
        source='participant.attendee_name',
        read_only=True
    )
    restaurant_name = serializers.CharField(
        source='restaurant.name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = EmailLog
        fields = '__all__'
        read_only_fields = ['id', 'sent_at', 'created_at']


class RestaurantCommentSerializer(serializers.ModelSerializer):
    """Serializer for RestaurantComment model."""
    created_by_email = serializers.EmailField(
        source='created_by.email',
        read_only=True
    )

    class Meta:
        model = RestaurantComment
        fields = [
            'id', 'restaurant', 'comment_text', 'created_by',
            'created_by_email', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ParticipantCommentSerializer(serializers.ModelSerializer):
    """Serializer for ParticipantComment model."""
    created_by_email = serializers.EmailField(
        source='created_by.email',
        read_only=True
    )

    class Meta:
        model = ParticipantComment
        fields = [
            'id', 'participant', 'comment_text', 'created_by',
            'created_by_email', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# Request/Response serializers for custom actions

class SendEmailRequestSerializer(serializers.Serializer):
    """Request serializer for sending a single email."""
    participant_id = serializers.UUIDField()
    restaurant_id = serializers.UUIDField()
    email_type = serializers.ChoiceField(choices=EmailType.choices)


class SendBulkEmailsRequestSerializer(serializers.Serializer):
    """Request serializer for sending bulk emails."""
    emails = SendEmailRequestSerializer(many=True)


class PretixSyncResultSerializer(serializers.Serializer):
    """Response serializer for Pretix sync results."""
    newParticipants = serializers.IntegerField()
    updatedParticipants = serializers.IntegerField()
    cancelledParticipants = serializers.IntegerField()
    errors = serializers.ListField(
        child=serializers.DictField()
    )


class TestEmailRequestSerializer(serializers.Serializer):
    """Request serializer for sending a test email."""
    to = serializers.EmailField()
    subject = serializers.CharField()
    body = serializers.CharField()
