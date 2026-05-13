"""
Nexus Backend — FastAPI application entry point.

* Registers all routers
* Configures CORS for the React frontend
* Creates database tables on startup
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.models.base import Base, engine

# Import models so SQLAlchemy knows about them
import app.models  # noqa: F401

# Import routers
from app.routers import (
    admin_files,
    admin_groups,
    admin_users,
    ai,
    auth,
    chat,
    users_me,
)

logger = logging.getLogger("nexus")


# ── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
    1. Create database tables.
    """
    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured")

    yield  # ← app is running

    # Shutdown — nothing special needed


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Nexus API",
    version="2.0.0",
    description=(
        "ownCloud-native document management frontend with AI integration. "
        "Authentication, users, groups, files, and sharing are all delegated "
        "to ownCloud. Nexus adds an AI sync layer on top."
    ),
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(admin_groups.router)
app.include_router(admin_files.router)
app.include_router(ai.router)
app.include_router(chat.router)
app.include_router(users_me.router)


# ── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/v1/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": "nexus-api", "version": "2.0.0"}
