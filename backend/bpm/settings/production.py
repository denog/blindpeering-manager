"""
Production settings for bpm project.
"""

import os
from .base import *  # noqa: F401, F403

DEBUG = False

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', '').split(',')
    if host.strip()
]
# Internal health probes (the compose healthcheck hits the app via 127.0.0.1
# inside the container); external traffic always arrives with the public
# hostname through the reverse proxy.
ALLOWED_HOSTS += ['127.0.0.1', 'localhost']

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# The app is only reachable through a TLS-terminating reverse proxy (e.g.
# Caddy) -- the compose file binds the published port to loopback. Trust the
# proxy's X-Forwarded-Proto so is_secure(), secure cookies and CSRF checks
# behave correctly. Safe because the proxy overwrites client-sent headers.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Public origin(s) allowed for CSRF; FRONTEND_BASE_URL is the canonical one.
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CSRF_TRUSTED_ORIGINS', FRONTEND_BASE_URL).split(',')  # noqa: F405
    if origin.strip()
]

# CORS - in production, same origin so not needed
CORS_ALLOWED_ORIGINS = []
