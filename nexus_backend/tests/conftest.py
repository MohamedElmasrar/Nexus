"""
Pytest fixtures for the Nexus backend test suite.

Tests use an in-memory SQLite database for isolation and speed.
"""

import os

# Must be set BEFORE any app imports so Settings picks it up
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["FIRST_ADMIN_USERNAME"] = "admin"
os.environ["FIRST_ADMIN_PASSWORD"] = "admin"
os.environ["FIRST_ADMIN_EMAIL"] = "admin@test.local"
os.environ["OWNCLOUD_URL"] = "http://localhost:8080"
os.environ["OWNCLOUD_USERNAME"] = "admin"
os.environ["OWNCLOUD_PASSWORD"] = "admin"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.core.dependencies import get_db
from app.core.security import create_access_token, encrypt_password
from app.main import app
from app.models.base import Base

# ── Test database ───────────────────────────────────────────────────────────

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def db():
    """Provide a test database session."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """FastAPI TestClient with overridden DB."""
    return TestClient(app)


@pytest.fixture
def admin_token() -> str:
    """Return a valid JWT for an admin user."""
    return create_access_token(data={
        "sub": "admin",
        "role": "admin",
        "display_name": "Admin",
        "email": "admin@test.local",
        "oc_pass": encrypt_password("admin"),
    })


@pytest.fixture
def user_token() -> str:
    """Return a valid JWT for a standard user."""
    return create_access_token(data={
        "sub": "testuser",
        "role": "user",
        "display_name": "Test User",
        "email": "user@test.local",
        "oc_pass": encrypt_password("userpass"),
    })
