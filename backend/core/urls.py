"""
URL configuration for core API endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ParticipantViewSet, RestaurantViewSet, AssignmentViewSet,
    EventStatusViewSet, EmailLogViewSet,
    RestaurantCommentViewSet, ParticipantCommentViewSet, health_check
)

router = DefaultRouter()
router.register(r'participants', ParticipantViewSet)
router.register(r'restaurants', RestaurantViewSet)
router.register(r'assignments', AssignmentViewSet)
router.register(r'event-status', EventStatusViewSet)
router.register(r'emails', EmailLogViewSet)
router.register(r'restaurant-comments', RestaurantCommentViewSet, basename='restaurant-comment')
router.register(r'participant-comments', ParticipantCommentViewSet, basename='participant-comment')

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('', include(router.urls)),
]