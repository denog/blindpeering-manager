# syntax=docker/dockerfile:1.4

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm version comes from the packageManager field in package.json (corepack)
RUN corepack enable && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# Stage 2: Build Django dependencies
FROM python:3.12-slim AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Production image
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --gid 1001 appuser

WORKDIR /app

# Copy Python packages from builder
COPY --from=backend-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy Django application
COPY backend/ .

# Collect backend static files (admin, DRF). The SPA build output is copied
# directly into STATIC_ROOT afterwards and needs no manifest processing.
RUN DJANGO_SETTINGS_MODULE=bpm.settings.production python manage.py collectstatic --noinput

# Copy built frontend into Django staticfiles
COPY --from=frontend-builder /frontend/dist ./staticfiles

# Container entrypoint (auto-migrates unless AUTO_MIGRATE=false)
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh

# Set proper ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]

# Run Django with Gunicorn; PORT/GUNICORN_WORKERS are read at runtime
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers ${GUNICORN_WORKERS:-2} bpm.wsgi:application"]
