"""
Admin — User listing via ownCloud OCS Provisioning API.

All endpoints require the ``admin`` role.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import CurrentUser, require_admin
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(
    prefix="/api/v1/admin/users",
    tags=["Admin — Users"],
    dependencies=[Depends(require_admin)],
)


@router.get("/")
async def list_users(current_user: CurrentUser = Depends(require_admin)):
    """List all ownCloud users."""
    oc = get_owncloud_client()
    usernames = await oc.list_users(current_user.username, current_user.oc_password)
    # Fetch full profile for each user
    users = []
    for uname in usernames:
        info = await oc.get_user(current_user.username, current_user.oc_password, uname)
        if info:
            users.append({
                "username": info.username,
                "display_name": info.display_name,
                "email": info.email,
                "groups": info.groups,
                "is_admin": info.is_admin,
            })
    return users


@router.get("/{username}")
async def get_user(
    username: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Get a specific ownCloud user's details."""
    oc = get_owncloud_client()
    info = await oc.get_user(current_user.username, current_user.oc_password, username)
    if info is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": info.username,
        "display_name": info.display_name,
        "email": info.email,
        "groups": info.groups,
        "is_admin": info.is_admin,
    }
