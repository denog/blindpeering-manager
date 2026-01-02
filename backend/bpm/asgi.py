"""
ASGI config for bpm project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bpm.settings.production')

application = get_asgi_application()
