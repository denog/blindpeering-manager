#!/bin/sh
set -e

if [ "${AUTO_MIGRATE:-true}" != "false" ]; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput
fi

exec "$@"
