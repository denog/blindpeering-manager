"""
Base Django settings for bpm project.
"""

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-in-production')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    # Local apps
    'core',
    'authentication',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'bpm.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'staticfiles'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bpm.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'bpm'),
        'USER': os.environ.get('POSTGRES_USER', 'bpm'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'bpm'),
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# WhiteNoise serves STATIC_ROOT: backend statics collected at image build time
# (admin, DRF) plus the pre-hashed Vite SPA bundle copied in by the Dockerfile.
# Deliberately NOT a manifest storage: the SPA's index.html is not rendered
# through {% static %}, so hashed-name resolution would 404 the Vite assets.
# (The old STATICFILES_STORAGE setting was removed in Django 5.1.)
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Session settings
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 86400 * 7  # 1 week
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Scoped rates for the public, unauthenticated carpool endpoints only
    # (nothing else in this app is throttled). read/write are keyed per
    # magic-link token (see CarpoolTokenThrottle) -- event participants often
    # share venue WiFi/NAT, so a per-IP bucket would let a few people's page
    # polling starve everyone else at that IP. 'carpool-ip' is a coarse
    # per-IP backstop so cycling tokens can't be used to flood the endpoints.
    #
    # Budget: an open board page costs ~60 read req/hour (60s poll) plus the
    # odd manual refresh/post, so allow ~80/hour per active participant. The
    # default 8000/hour therefore covers ~100 participants behind one NAT --
    # raise CARPOOL_IP_RATE_PER_HOUR for a larger shared-WiFi venue.
    'DEFAULT_THROTTLE_RATES': {
        'carpool-read': '120/hour',
        'carpool-write': '20/hour',
        'carpool-ip': f"{os.environ.get('CARPOOL_IP_RATE_PER_HOUR', 8000)}/hour",
    },
}

# SendGrid
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
EMAIL_SENDER_ADDRESS = os.environ.get('SMTP_SENDER_EMAIL', 'noreply@denog.de')
EMAIL_SENDER_NAME = os.environ.get('SMTP_SENDER_NAME', 'DENOG Event Team')

# Pretix
PRETIX_API_TOKEN = os.environ.get('PRETIX_API_TOKEN')
PRETIX_EVENT = os.environ.get('PRETIX_EVENT')
PRETIX_ORGANIZER = os.environ.get('PRETIX_ORGANIZER', 'denog')
PRETIX_CHECKIN_LIST_ID_LOCAL = os.environ.get('PRETIX_CHECKIN_LIST_ID_LOCAL')
PRETIX_CHECKIN_LIST_ID_GLOBAL = os.environ.get('PRETIX_CHECKIN_LIST_ID_GLOBAL')

# Carpool board
# Public origin the frontend SPA is served from, used to build magic links
# embedded in the assignment email (e.g. FRONTEND_BASE_URL + "/carpool/<token>/").
FRONTEND_BASE_URL = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:5173')
# Days after the event that carpool messages/links remain accessible before
# expiring (data minimization). Enforced live in the view (410 past this
# window) independently of whether the cleanup_expired_carpool_messages
# management command has actually run.
CARPOOL_MESSAGE_RETENTION_DAYS = int(os.environ.get('CARPOOL_MESSAGE_RETENTION_DAYS', 3))
