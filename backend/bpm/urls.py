"""
URL configuration for bpm project.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import TemplateView

from core.admin_backup import backup_view

urlpatterns = [
    path('dj-admin/backup/', admin.site.admin_view(backup_view), name='admin-backup'),
    path('dj-admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('core.urls')),
]

# In production, serve React app for all non-API routes
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^(?!api/|dj-admin/).*$', TemplateView.as_view(template_name='index.html')),
    ]
