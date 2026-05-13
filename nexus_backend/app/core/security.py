"""
JWT token handling and Fernet encryption for ownCloud credentials.

Deliberately kept as pure functions with no database or HTTP dependencies
so they can be imported from anywhere without circular imports.
"""

from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import get_settings


# ── Fernet encryption for ownCloud credentials in JWT ────────────────────

def _get_fernet() -> Fernet:
    """Derive a Fernet key from the SECRET_KEY (must be url-safe base64, 32 bytes)."""
    import base64
    import hashlib
    settings = get_settings()
    # Derive a stable 32-byte key from the app secret
    raw = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_password(plain: str) -> str:
    """Encrypt a plaintext password for safe storage in a JWT claim."""
    f = _get_fernet()
    return f.encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    """Decrypt a password stored in a JWT claim."""
    f = _get_fernet()
    return f.decrypt(token.encode()).decode()


# ── JWT ────────────────────────────────────────────────────────────────────

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Return the payload dict or *None* if the token is invalid / expired."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
