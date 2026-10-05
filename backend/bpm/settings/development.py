"""
Development settings for bpm project.
"""

import os
from urllib.parse import urlparse

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# CORS settings for Vite dev server
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings for development
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
]

# Public origin when the dev stack runs behind a proxy (docker-compose.dev.yml
# gateway, optionally behind Caddy): accept its host and origin.
_public = urlparse(FRONTEND_BASE_URL)  # noqa: F405
if _public.hostname:
    ALLOWED_HOSTS.append(_public.hostname)
    _origin = f'{_public.scheme}://{_public.netloc}'
    for _origins in (CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS):
        if _origin not in _origins:
            _origins.append(_origin)
# The gateway forwards the outer proxy's scheme (TLS terminates at Caddy).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Allow JS to read it for API calls

# Session cookie for dev
SESSION_COOKIE_SECURE = False

# Email settings for development (Mailpit)
EMAIL_BACKEND_TYPE = 'smtp'
EMAIL_SMTP_HOST = os.environ.get('EMAIL_SMTP_HOST', 'localhost')
EMAIL_SMTP_PORT = int(os.environ.get('EMAIL_SMTP_PORT', 1025))
