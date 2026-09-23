"""
DRF ViewSets for core models.
"""

import hashlib
from datetime import datetime, time, timedelta

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from . import email_templates
from .models import (
    Participant, Restaurant, Assignment, EventStatus, CarpoolMessage,
    EmailLog, RestaurantComment, ParticipantComment, ParticipantStatus
)
from .serializers import (
    ParticipantSerializer, RestaurantSerializer, RestaurantListSerializer,
    AssignmentSerializer, AssignmentWriteSerializer, EventStatusSerializer,
    EmailLogSerializer, RestaurantCommentSerializer,
    ParticipantCommentSerializer, SendEmailRequestSerializer,
    SendBulkEmailsRequestSerializer, PretixSyncResultSerializer,
    TestEmailRequestSerializer, CarpoolMessageSerializer,
    CarpoolMessageCreateSerializer,
)
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes, throttle_classes
)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    Simple health check endpoint to verify backend availability.
    Accessible without authentication for monitoring/load balancers.
    """
    return Response({
        'status': 'healthy',
        'timestamp': timezone.now(),
        'version': '1.0.0'
    })


class CarpoolTokenThrottle(SimpleRateThrottle):
    """Throttle the carpool endpoints per magic-link token rather than per IP.

    Event participants routinely share venue WiFi/NAT, so an IP-keyed bucket
    would let a handful of people's page polling (or one bad actor) starve
    everyone else behind the same address. Keying on the token scopes the
    bucket to a single participant's board session. Requests with no token in
    the URL are not throttled here -- the coarse per-IP backstop below covers
    those and bounds total volume across all tokens at one address.
    """

    def get_cache_key(self, request, view):
        token = view.kwargs.get('token')
        if not token:
            return None
        ident = hashlib.sha256(token.encode()).hexdigest()
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class CarpoolReadThrottle(CarpoolTokenThrottle):
    scope = 'carpool-read'


class CarpoolWriteThrottle(CarpoolTokenThrottle):
    scope = 'carpool-write'


class CarpoolIPThrottle(AnonRateThrottle):
    """Coarse per-IP backstop for the carpool endpoints.

    Each distinct token gets its own token bucket, so the token throttle alone
    doesn't bound how many requests one IP can make by cycling tokens. This
    caps that while staying generous enough for a large shared-NAT venue.
    """

    scope = 'carpool-ip'


def _carpool_board_deadline(event_date):
    """Immutable instant a carpool board and its messages become inaccessible.

    End of the last retained day, in the project's default timezone. Computed
    once per request and stamped onto new messages so later edits to the
    singleton event date can't move an existing message's deadline.
    """
    expires_on = event_date + timedelta(days=settings.CARPOOL_MESSAGE_RETENTION_DAYS)
    return timezone.make_aware(
        datetime.combine(expires_on, time.max),
        timezone.get_default_timezone(),
    )


def _resolve_carpool_access(token):
    """Resolve a carpool magic-link token to its (participant, restaurant).

    Identity and table are derived ONLY from the token -- callers must never
    accept a client-supplied participant/restaurant id for these endpoints.
    Returns (participant, restaurant, board_deadline, error_response);
    error_response is None on success, otherwise the Response the caller
    should return as-is.
    """
    try:
        participant = Participant.objects.get(carpool_token=token)
    except Participant.DoesNotExist:
        return None, None, None, Response(
            {'detail': 'This carpool link is invalid.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if participant.status == ParticipantStatus.CANCELLED:
        return None, None, None, Response(
            {'detail': 'This carpool link is invalid.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        restaurant = participant.assignment.restaurant
    except Assignment.DoesNotExist:
        # Table captains are linked to their restaurant via
        # Restaurant.assigned_captain, not an Assignment row (the auto-assigner
        # skips them), but they still get a carpool link in their email.
        restaurant = participant.captained_restaurants.first()

    if restaurant is None:
        return None, None, None, Response(
            {'detail': "You haven't been assigned to a table yet."},
            status=status.HTTP_404_NOT_FOUND,
        )

    event_date = EventStatus.get_current().event_date
    if event_date is None:
        # Fail closed: without an event date there is no bounded lifetime for
        # the board, so it must not be reachable (setup phase, or the date was
        # cleared while reusing the installation for another event).
        return None, None, None, Response(
            {'detail': 'This carpool board is not available yet.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    board_deadline = _carpool_board_deadline(event_date)
    if timezone.now() > board_deadline:
        return None, None, None, Response(
            {'detail': 'This carpool board has closed.'},
            status=status.HTTP_410_GONE,
        )

    return participant, restaurant, board_deadline, None


@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([CarpoolReadThrottle, CarpoolIPThrottle])
def carpool_board(request, token):
    """Return the carpool message board for the token holder's table."""
    participant, restaurant, _board_deadline, error = _resolve_carpool_access(token)
    if error:
        return error

    # Hide messages past their own immutable deadline even if the cleanup
    # command hasn't run yet.
    messages = restaurant.carpool_messages.filter(
        expires_at__gt=timezone.now()
    ).select_related('sender')
    return Response({
        'restaurant_name': restaurant.name,
        'participant_name': participant.attendee_name,
        'messages': CarpoolMessageSerializer(
            messages, many=True, context={'viewer': participant}
        ).data,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([CarpoolWriteThrottle, CarpoolIPThrottle])
def carpool_post_message(request, token):
    """Post a new carpool message to the token holder's table."""
    participant, restaurant, board_deadline, error = _resolve_carpool_access(token)
    if error:
        return error

    serializer = CarpoolMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    message = CarpoolMessage.objects.create(
        restaurant=restaurant,
        sender=participant,
        body=serializer.validated_data['body'],
        expires_at=board_deadline,
    )
    return Response(
        CarpoolMessageSerializer(message, context={'viewer': participant}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([CarpoolWriteThrottle, CarpoolIPThrottle])
def carpool_delete_message(request, token, message_id):
    """Delete a carpool message the token holder posted themselves."""
    participant, restaurant, _board_deadline, error = _resolve_carpool_access(token)
    if error:
        return error

    deleted, _ = CarpoolMessage.objects.filter(
        id=message_id, sender=participant
    ).delete()
    if not deleted:
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


class ParticipantViewSet(viewsets.ModelViewSet):
    """ViewSet for Participant CRUD operations."""
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        """
        Bulk upsert participants from CSV import.
        Wrapped in a transaction for atomicity and performance.
        """
        data = request.data if isinstance(request.data, list) else [request.data]
        result = {'succeeded': 0, 'failed': 0, 'errors': []}

        with transaction.atomic():
            for item in data:
                try:
                    pretix_id = item.get('pretix_id')
                    if pretix_id:
                        Participant.objects.update_or_create(
                            pretix_id=pretix_id,
                            defaults={
                                'given_name': item.get('given_name', ''),
                                'family_name': item.get('family_name', ''),
                                'attendee_name': item.get('attendee_name', ''),
                                'attendee_email': item.get('attendee_email', ''),
                                'is_table_captain': item.get('is_table_captain', False),
                                'captain_phone': item.get('captain_phone'),
                                'captain_preferred_contact': item.get('captain_preferred_contact'),
                                'status': item.get('status', 'registered'),
                            }
                        )
                    else:
                        Participant.objects.create(
                            given_name=item.get('given_name', ''),
                            family_name=item.get('family_name', ''),
                            attendee_name=item.get('attendee_name', ''),
                            attendee_email=item.get('attendee_email', ''),
                            is_table_captain=item.get('is_table_captain', False),
                            captain_phone=item.get('captain_phone'),
                            captain_preferred_contact=item.get('captain_preferred_contact'),
                            status=item.get('status', 'registered'),
                        )
                    result['succeeded'] += 1
                except Exception as e:
                    result['failed'] += 1
                    result['errors'].append({
                        'email': item.get('attendee_email'),
                        'reason': str(e)
                    })

        return Response(result)

    @action(detail=False, methods=['post'])
    def sync_pretix(self, request):
        """Sync participants from Pretix ticketing system."""
        import requests as req
        from .services.pretix import PretixSyncService

        service = PretixSyncService()
        try:
            result = service.sync()
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        except req.exceptions.HTTPError as e:
            return Response(
                {'error': f'Pretix API error: {e.response.status_code} - {e.response.reason}'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except req.exceptions.RequestException as e:
            return Response(
                {'error': f'Failed to connect to Pretix API: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        return Response(PretixSyncResultSerializer(result).data)


class RestaurantViewSet(viewsets.ModelViewSet):
    """ViewSet for Restaurant CRUD operations."""
    queryset = Restaurant.objects.prefetch_related('assignments', 'assigned_captain')
    serializer_class = RestaurantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return RestaurantListSerializer
        return RestaurantSerializer

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        """Bulk create restaurants from CSV import."""
        data = request.data if isinstance(request.data, list) else [request.data]
        created = []

        with transaction.atomic():
            for item in data:
                restaurant = Restaurant.objects.create(
                    name=item.get('name', ''),
                    address=item.get('address', ''),
                    phone=item.get('phone'),
                    taxi_time=item.get('taxi_time'),
                    public_transport_time=item.get('public_transport_time'),
                    public_transport_lines=item.get('public_transport_lines'),
                    max_seats=item.get('max_seats', 10),
                )
                created.append(restaurant)

        return Response(
            RestaurantSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED
        )


class AssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Assignment CRUD operations."""
    queryset = Assignment.objects.select_related('participant', 'restaurant')
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AssignmentWriteSerializer
        return AssignmentSerializer

    def create(self, request, *args, **kwargs):
        """Upsert assignment (update if participant already assigned)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment, created = Assignment.objects.update_or_create(
            participant=serializer.validated_data['participant'],
            defaults={
                'restaurant': serializer.validated_data['restaurant'],
                'assigned_at': timezone.now()
            }
        )

        return Response(
            AssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create/update assignments."""
        data = request.data if isinstance(request.data, list) else [request.data]
        assignments = []

        with transaction.atomic():
            for item in data:
                assignment, _ = Assignment.objects.update_or_create(
                    participant_id=item['participant'],
                    defaults={
                        'restaurant_id': item['restaurant'],
                        'assigned_at': timezone.now()
                    }
                )
                assignments.append(assignment)

        return Response(
            AssignmentSerializer(assignments, many=True).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Clear all assignments."""
        count, _ = Assignment.objects.all().delete()
        return Response({'deleted': count})

    @action(detail=False, methods=['delete'], url_path='by-participant/(?P<participant_id>[^/.]+)')
    def remove_by_participant(self, request, participant_id=None):
        """Remove assignment by participant ID."""
        count, _ = Assignment.objects.filter(participant_id=participant_id).delete()
        return Response({'deleted': count})


class EventStatusViewSet(viewsets.ModelViewSet):
    """ViewSet for EventStatus (singleton pattern)."""
    queryset = EventStatus.objects.all()
    serializer_class = EventStatusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Get the current event status."""
        status_obj = EventStatus.get_current()
        return Response(EventStatusSerializer(status_obj).data)

    @action(detail=False, methods=['patch', 'put'])
    def update_state(self, request):
        """Update the event workflow state."""
        status_obj = EventStatus.get_current()
        serializer = self.get_serializer(status_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def reset_email_template(self, request):
        """Reset an email template's subject/body to its default content."""
        defaults_by_template = {
            'assignment': {
                'assignment_email_subject': email_templates.DEFAULT_ASSIGNMENT_EMAIL_SUBJECT,
                'assignment_email_body': email_templates.DEFAULT_ASSIGNMENT_EMAIL_BODY,
            },
            'captain_overview': {
                'captain_overview_email_subject': email_templates.DEFAULT_CAPTAIN_OVERVIEW_EMAIL_SUBJECT,
                'captain_overview_email_body': email_templates.DEFAULT_CAPTAIN_OVERVIEW_EMAIL_BODY,
            },
        }
        template = request.data.get('template')
        defaults = defaults_by_template.get(template)
        if defaults is None:
            return Response(
                {'detail': f"Invalid template '{template}'. Expected one of: {', '.join(defaults_by_template)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_obj = EventStatus.get_current()
        serializer = self.get_serializer(status_obj, data=defaults, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for EmailLog (read-only with send actions)."""
    queryset = EmailLog.objects.select_related('participant', 'restaurant')
    serializer_class = EmailLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def send(self, request):
        """Send email to a single participant."""
        from .services.email import EmailService

        serializer = SendEmailRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email_service = EmailService()
        try:
            log = email_service.send_assignment_email(
                participant_id=serializer.validated_data['participant_id'],
                restaurant_id=serializer.validated_data['restaurant_id'],
                email_type=serializer.validated_data['email_type'],
                sent_by=request.user.email
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        return Response(EmailLogSerializer(log).data)

    @action(detail=False, methods=['post'])
    def send_bulk(self, request):
        """Send emails to multiple participants."""
        from .services.email import EmailService

        serializer = SendBulkEmailsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email_service = EmailService()
        try:
            result = email_service.send_bulk_emails(
                emails=serializer.validated_data['emails'],
                sent_by=request.user.email
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        sent_logs = result['sent']
        failures = result['failed']

        # If all emails failed, return an error
        if not sent_logs and failures:
            # Get unique error messages
            error_messages = list(set(f['error'] for f in failures))
            # Show the first error message (they're usually all the same issue)
            main_error = error_messages[0]
            return Response(
                {
                    'error': main_error,
                    'total_failed': len(failures),
                    'failures': failures[:5]  # Return first 5 failures for context
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        # Return sent logs and failure count for partial success
        response_data = {
            'sent': EmailLogSerializer(sent_logs, many=True).data,
            'sent_count': len(sent_logs),
            'failed_count': len(failures),
        }
        if failures:
            response_data['failures'] = failures[:5]

        return Response(response_data)

    @action(detail=False, methods=['post'], url_path='send-captain-overviews')
    def send_captain_overviews(self, request):
        """Send captain overview emails to all captains."""
        from .services.email import EmailService

        email_service = EmailService()
        try:
            result = email_service.send_all_captain_overviews(
                sent_by=request.user.email
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        sent_logs = result['sent']
        failures = result['failed']

        # If all emails failed, return an error
        if not sent_logs and failures:
            error_messages = list(set(f['error'] for f in failures))
            main_error = error_messages[0]
            return Response(
                {
                    'error': main_error,
                    'total_failed': len(failures),
                    'failures': failures[:5]
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        response_data = {
            'sent': EmailLogSerializer(sent_logs, many=True).data,
            'sent_count': len(sent_logs),
            'failed_count': len(failures),
        }
        if failures:
            response_data['failures'] = failures[:5]

        return Response(response_data)

    @action(detail=False, methods=['post'])
    def test(self, request):
        """Send a test email."""
        from .services.email import EmailService

        serializer = TestEmailRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email_service = EmailService()
        email_service.send_raw_email(
            to=serializer.validated_data['to'],
            subject=serializer.validated_data['subject'],
            body=serializer.validated_data['body']
        )

        return Response({'message': 'Test email sent successfully'})


class RestaurantCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for RestaurantComment."""
    serializer_class = RestaurantCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = RestaurantComment.objects.select_related('created_by')
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset


class ParticipantCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for ParticipantComment."""
    serializer_class = ParticipantCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ParticipantComment.objects.select_related('created_by')
        participant_id = self.request.query_params.get('participant_id')
        if participant_id:
            queryset = queryset.filter(participant_id=participant_id)
        return queryset
