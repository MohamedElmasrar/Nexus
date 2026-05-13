# ─────────────────────────────────────────────────────────────
# Nexus Backend — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Install system dependencies (for psycopg2 + doc parsing) ──
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev libxml2 && \
    rm -rf /var/lib/apt/lists/*

# ── Install Python dependencies ────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Copy application code ──────────────────────────────────
COPY . .

# ── Expose port ────────────────────────────────────────────
EXPOSE 8000

# ── Entrypoint: run migrations then start Uvicorn ──────────
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
