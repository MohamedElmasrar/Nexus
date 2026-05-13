"""
User service — business logic for authentication and CRUD.

All functions accept a SQLAlchemy ``Session`` as their first argument
so they remain agnostic of FastAPI's dependency injection.
"""

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Return the user if credentials are valid, else ``None``."""
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(db: Session, data: UserCreate) -> User:
    """Create a new user with a hashed password."""
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def update_user(db: Session, user_id: int, data: UserUpdate) -> User | None:
    """Partially update a user.  Only fields that are not ``None`` are touched."""
    user = get_user_by_id(db, user_id)
    if user is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        user.hashed_password = get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: int) -> User | None:
    """Soft-delete — set ``is_active = False``."""
    user = get_user_by_id(db, user_id)
    if user is None:
        return None
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
