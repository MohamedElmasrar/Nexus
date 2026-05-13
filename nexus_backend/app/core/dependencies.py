"""
FastAPI dependency functions used across routers.

* get_db           – yields a SQLAlchemy session per request
* get_current_user – extracts + validates JWT, returns OwnCloudUser info
* require_admin    – raises 403 unless caller is an admin
"""

from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, decrypt_password
from app.models.base import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Lightweight user object (no DB) ───────────────────────────────────────


@dataclass
class CurrentUser:
    """User extracted from the JWT — no database lookup needed."""
    username: str
    role: str               # "admin" | "user"
    display_name: str
    email: str
    oc_password: str        # decrypted ownCloud password
    is_admin: bool = False


# ── Database session ───────────────────────────────────────────────────────

def get_db():
    """Yield a database session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Authentication ─────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> CurrentUser:
    """Decode the JWT bearer token and return a CurrentUser (no DB hit)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: str | None = payload.get("sub")
    if username is None:
        raise credentials_exception

    try:
        oc_password = decrypt_password(payload.get("oc_pass", ""))
    except Exception:
        raise credentials_exception

    role = payload.get("role", "user")

    return CurrentUser(
        username=username,
        role=role,
        display_name=payload.get("display_name", username),
        email=payload.get("email", ""),
        oc_password=oc_password,
        is_admin=(role == "admin"),
    )


# ── Authorization ──────────────────────────────────────────────────────────

def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Raise 403 if the authenticated user is not an admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
