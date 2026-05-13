"""
Authentication router — validates against ownCloud and issues JWT tokens.

POST /api/v1/auth/login
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import create_access_token, encrypt_password
from app.schemas.auth import Token
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    """
    Authenticate against ownCloud.

    On success, issues a JWT containing the username, role, and an
    encrypted copy of the ownCloud password so that subsequent API
    calls can proxy as the authenticated user.
    """
    oc = get_owncloud_client()

    # Validate credentials against ownCloud
    valid = await oc.validate_credentials(form_data.username, form_data.password)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user profile to determine role
    user_info = await oc.get_current_user(form_data.username, form_data.password)
    if user_info is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch user profile from ownCloud",
        )

    role = "admin" if user_info.is_admin else "user"

    # Encrypt the ownCloud password for storage in the JWT
    enc_password = encrypt_password(form_data.password)

    token = create_access_token(
        data={
            "sub": form_data.username,
            "role": role,
            "display_name": user_info.display_name,
            "email": user_info.email,
            "oc_pass": enc_password,
        }
    )
    return Token(access_token=token)
