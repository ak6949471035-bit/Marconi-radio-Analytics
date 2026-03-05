#!/bin/sh
set -e

# Run database migrations (uses DATABASE_URL)
alembic upgrade head

# Start the FastAPI app
exec uvicorn main:app --host 0.0.0.0 --port 8000
