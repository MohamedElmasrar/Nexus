"""
Admin — Drive configuration router.

Allows admins to register, list, and remove external storage connections.
Credentials are never exposed in read responses.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin
from app.models.drive_config import DriveConfig
from app.schemas.drive_config import DriveConfigCreate, DriveConfigRead

router = APIRouter(
    prefix="/api/v1/admin/drives",
    tags=["Admin — Drives"],
    dependencies=[Depends(require_admin)],
)


@router.get("/", response_model=list[DriveConfigRead])
def list_drives(db: Session = Depends(get_db)):
    """List all drive configurations (credentials redacted)."""
    return db.query(DriveConfig).all()


@router.post("/", response_model=DriveConfigRead, status_code=status.HTTP_201_CREATED)
def add_drive(
    data: DriveConfigCreate,
    db: Session = Depends(get_db),
):
    """Register a new external drive connection."""
    drive = DriveConfig(
        drive_type=data.drive_type,
        label=data.label,
        config_json=json.dumps(data.config_json),
        is_active=data.is_active,
    )
    db.add(drive)
    db.commit()
    db.refresh(drive)
    return drive


@router.delete("/{drive_id}", status_code=status.HTTP_200_OK)
def remove_drive(drive_id: int, db: Session = Depends(get_db)):
    """Remove a drive configuration."""
    drive = db.query(DriveConfig).filter(DriveConfig.id == drive_id).first()
    if drive is None:
        raise HTTPException(status_code=404, detail="Drive config not found")
    db.delete(drive)
    db.commit()
    return {"detail": f"Drive config {drive_id} deleted"}


@router.get("/{drive_id}/browse")
async def admin_browse_drive(
    drive_id: int, path: str = "/", db: Session = Depends(get_db)
):
    """Browse native drive contents as an admin."""
    from app.services.drive_service import list_drive_contents
    return await list_drive_contents(db, drive_id, path, user_groups=[], is_admin=True)


from pydantic import BaseModel
class ShareRequest(BaseModel):
    group_id: int
    path: str

@router.post("/{drive_id}/share")
def admin_share_path(
    drive_id: int, req: ShareRequest, db: Session = Depends(get_db)
):
    """Share a path on a drive with a group."""
    from app.services.drive_service import share_path_with_group
    from app.schemas.drive_share import DriveShareRead
    share = share_path_with_group(db, drive_id, req.path, req.group_id)
    return DriveShareRead.model_validate(share)

@router.get("/{drive_id}/shares")
def admin_list_shares(
    drive_id: int, path: str, db: Session = Depends(get_db)
):
    """List shares for a specific path."""
    from app.models.drive_share import DriveShare
    from app.schemas.drive_share import DriveShareRead
    shares = db.query(DriveShare).filter(
        DriveShare.drive_id == drive_id,
        DriveShare.path == path
    ).all()
    return [DriveShareRead.model_validate(s) for s in shares]

@router.delete("/{drive_id}/share/{share_id}")
def admin_remove_share(
    drive_id: int, share_id: int, db: Session = Depends(get_db)
):
    from app.services.drive_service import remove_path_share
    if remove_path_share(db, share_id):
        return {"detail": "Share removed"}
    raise HTTPException(status_code=404, detail="Share not found")
