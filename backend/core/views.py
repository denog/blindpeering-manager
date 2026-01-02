"""
DRF ViewSets for core models.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .models import (
    Participant, Restaurant, Assignment, EventStatus,
    EmailLog, RestaurantComment, ParticipantComment
)
from .serializers import (
    ParticipantSerializer, RestaurantSerializer, RestaurantListSerializer,
    AssignmentSerializer, AssignmentWriteSerializer, EventStatusSerializer,
    EmailLogSerializer, RestaurantCommentSerializer,
    ParticipantCommentSerializer, SendEmailRequestSerializer,
    SendBulkEmailsRequestSerializer, PretixSyncResultSerializer,
    TestEmailRequestSerializer
)
from rest_framework.decorators import api_view, permission_classes


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
