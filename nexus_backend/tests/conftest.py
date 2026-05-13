"""
Pytest fixtures for the Nexus backend test suite.

Uses an in-memory SQLite database so tests are fast and isolated.
"""

import os

# Must be set BEFORE any app imports so Settings picks it up
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["FIRST_ADMIN_USERNAME"] = "admin"
os.environ["FIRST_ADMIN_PASSWORD"] = "adminpass"
os.environ["FIRST_ADMIN_EMAIL"] = "admin@test.local"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.core.dependencies import get_db
from app.core.security import get_password_hash, create_access_token
from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.group import Group, UserGroupLink
from app.models.file_record import FileRecord
from app.models.drive_config import DriveConfig

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
def admin_user(db) -> User:
    """Create and return an admin user."""
    user = User(
        username="admin",
        email="admin@test.local",
        hashed_password=get_password_hash("adminpass"),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def standard_user(db) -> User:
    """Create and return a standard user."""
    user = User(
        username="user1",
        email="user1@test.local",
        hashed_password=get_password_hash("userpass"),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user) -> str:
    """Return a valid JWT for the admin user."""
    return create_access_token(data={"sub": admin_user.username})


@pytest.fixture
def user_token(standard_user) -> str:
    """Return a valid JWT for the standard user."""
    return create_access_token(data={"sub": standard_user.username})


@pytest.fixture
def test_group(db) -> Group:
    """Create and return a test group."""
    group = Group(name="Engineering", description="Engineering team")
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@pytest.fixture
def assigned_group(db, standard_user, test_group) -> Group:
    """Create a group and assign the standard user to it."""
    link = UserGroupLink(user_id=standard_user.id, group_id=test_group.id)
    db.add(link)
    db.commit()
    return test_group


@pytest.fixture
def test_file_record(db, test_group, admin_user) -> FileRecord:
    """Create a file record in the test group."""
    record = FileRecord(
        filename="report.pdf",
        storage_provider="owncloud",
        external_file_id="nexus/group_1/report.pdf",
        group_id=test_group.id,
        uploaded_by=admin_user.id,
        file_size=1024,
        mime_type="application/pdf",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
