# syntax=docker/dockerfile:1.4

# Stage 1: Build frontend
FROM --platform=linux/amd64 node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .

RUN --mount=type=secret,id=env_file,target=/frontend/.env.docker \
    if [ -f /frontend/.env.docker ]; then \
      export $(cat /frontend/.env.docker | grep -v '^#' | xargs) && \
      pnpm build; \
    else \
      pnpm build; \
    fi

# Stage 2: Build Django dependencies
FROM --platform=linux/amd64 python:3.12-slim AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Production image
FROM --platform=linux/amd64 python:3.12-slim

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

# Copy built frontend into Django staticfiles
COPY --from=frontend-builder /frontend/dist ./staticfiles

# Set proper ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Run Django with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "bpm.wsgi:application"]
