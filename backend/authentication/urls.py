"""
URL configuration for authentication endpoints.
"""

from django.urls import path
from .views import LoginView, LogoutView, SessionView, CSRFTokenView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('session/', SessionView.as_view(), name='session'),
    path('csrf/', CSRFTokenView.as_view(), name='csrf'),
]
