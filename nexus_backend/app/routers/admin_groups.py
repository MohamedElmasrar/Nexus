"""
Admin — Group management via ownCloud OCS Provisioning API.

All endpoints require the ``admin`` role.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies import CurrentUser, require_admin
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(
    prefix="/api/v1/admin/groups",
    tags=["Admin — Groups"],
    dependencies=[Depends(require_admin)],
)


class GroupCreate(BaseModel):
    group_id: str


@router.get("/")
async def list_groups(current_user: CurrentUser = Depends(require_admin)):
    """List all ownCloud groups."""
    oc = get_owncloud_client()
    groups = await oc.list_groups(current_user.username, current_user.oc_password)
    return [{"id": g, "name": g} for g in groups]


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Get group details including members."""
    oc = get_owncloud_client()
    members = await oc.get_group_members(
        current_user.username, current_user.oc_password, group_id
    )
    return {
        "id": group_id,
        "name": group_id,
        "members": members,
    }


@router.post("/", status_code=201)
async def create_group(
    data: GroupCreate,
    current_user: CurrentUser = Depends(require_admin),
):
    """Create a new ownCloud group."""
    oc = get_owncloud_client()
    ok = await oc.create_group(current_user.username, current_user.oc_password, data.group_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to create group")
    return {"id": data.group_id, "name": data.group_id}


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Delete an ownCloud group."""
    oc = get_owncloud_client()
    ok = await oc.delete_group(current_user.username, current_user.oc_password, group_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to delete group")
    return {"detail": f"Group '{group_id}' deleted"}


@router.post("/{group_id}/users/{username}")
async def add_user_to_group(
    group_id: str,
    username: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Add a user to an ownCloud group."""
    oc = get_owncloud_client()
    ok = await oc.add_user_to_group(
        current_user.username, current_user.oc_password, username, group_id
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to add user to group")
    return {"detail": f"User '{username}' added to group '{group_id}'"}


@router.delete("/{group_id}/users/{username}")
async def remove_user_from_group(
    group_id: str,
    username: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Remove a user from an ownCloud group."""
    oc = get_owncloud_client()
    ok = await oc.remove_user_from_group(
        current_user.username, current_user.oc_password, username, group_id
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to remove user from group")
    return {"detail": f"User '{username}' removed from group '{group_id}'"}
