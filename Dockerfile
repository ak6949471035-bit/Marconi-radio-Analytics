# -----------------------------------------------------------------------------
# Stage 1: Build frontend
# -----------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app/station-tracker

COPY station-tracker/package.json station-tracker/package-lock.json ./
RUN npm ci

COPY station-tracker/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Final Python image
# -----------------------------------------------------------------------------
FROM python:3.13-slim

WORKDIR /app

# System deps + data dir in one layer; clean apt to avoid extra size
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data

# Python deps (single layer)
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App and frontend (single COPY layer)
COPY api/main.py api/db.py api/models.py api/jobs.py api/util.py ./
COPY api/migrations/ ./migrations/
COPY api/alembic.ini ./
COPY api/entrypoint.sh /entrypoint.sh
COPY --from=frontend-builder /app/station-tracker/.output/public ./static

RUN chmod +x /entrypoint.sh

ENV DATABASE_URL=sqlite+aiosqlite:////data/station-tracker.db
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
