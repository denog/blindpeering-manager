"""
Development settings for bpm project.
"""

import os

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
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Allow JS to read it for API calls

# Session cookie for dev
SESSION_COOKIE_SECURE = False

# Email settings for development (Mailpit)
EMAIL_BACKEND_TYPE = 'smtp'
EMAIL_SMTP_HOST = os.environ.get('EMAIL_SMTP_HOST', 'localhost')
EMAIL_SMTP_PORT = int(os.environ.get('EMAIL_SMTP_PORT', 1025))
