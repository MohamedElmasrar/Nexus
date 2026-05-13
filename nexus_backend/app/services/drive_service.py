"""
Service for browsing drives and managing drive shares.
"""

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.future import select

from app.models.drive_config import DriveConfig
from app.models.drive_share import DriveShare
from app.models.group import Group
from app.services.storage.owncloud import OwnCloudProvider


def _get_provider(drive: DriveConfig) -> OwnCloudProvider:
    import json
    try:
        config = json.loads(drive.config_json)
        # Right now we only support owncloud but this can be extended
        return OwnCloudProvider(
            base_url=config.get("url", ""),
            username=config.get("username", ""),
            password=config.get("password", "")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid drive config: {e}")


async def list_drive_contents(
    db: Session, drive_id: int, path: str, user_groups: list[Group], is_admin: bool
) -> list[dict[str, Any]]:
    """
    List files/folders on a drive at the given path.
    If the user is not an admin, filters the results based on DriveShares for their groups.
    """
    drive = db.get(DriveConfig, drive_id)
    if not drive or not drive.is_active:
        raise HTTPException(status_code=404, detail="Drive not found or inactive")

    provider = _get_provider(drive)
    
    # Clean the path
    path = "/" + path.strip("/") if path.strip("/") else "/"

    if not is_admin:
        # Check permissions
        group_ids = [g.id for g in user_groups]
        if not group_ids:
            return []
            
        stmt = select(DriveShare).where(
            DriveShare.drive_id == drive_id,
            DriveShare.group_id.in_(group_ids)
        )
        shares = db.scalars(stmt).all()
        shared_paths = [s.path.rstrip("/") for s in shares]
        
        # Determine if the user has access to browse this directory at all
        can_browse = False
        clean_path = path.rstrip("/")
        
        for sp in shared_paths:
            if clean_path == sp or clean_path.startswith(sp + "/"):
                # Path is exactly a share, or a child of a share
                can_browse = True
                break
            if sp.startswith(clean_path + "/") or (clean_path == "" and sp):
                # Path is a parent of a share (e.g. browsing the root towards a share)
                can_browse = True
                break
                
        if not can_browse and shared_paths:
            raise HTTPException(status_code=403, detail="Forbidden")

    try:
        results = await provider.list_files(path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Storage provider error: {str(e)}")

    if is_admin:
        return results

    # Filter results for non-admins
    filtered_results = []
    clean_path = path.rstrip("/")
    
    for item in results:
        item_path = f"{clean_path}/{item['name']}".strip("/")
        
        has_access = False
        for sp in shared_paths:
            sp_clean = sp.strip("/")
            if item_path == sp_clean or item_path.startswith(sp_clean + "/"):
                has_access = True
                break
            if sp_clean.startswith(item_path + "/"):
                has_access = True
                break
                
        if has_access:
            filtered_results.append(item)

    return filtered_results


def share_path_with_group(
    db: Session, drive_id: int, path: str, group_id: int
) -> DriveShare:
    """Create a DriveShare record."""
    # Ensure group exists
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    drive = db.get(DriveConfig, drive_id)
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    path = "/" + path.strip("/") if path.strip("/") else "/"

    # Check if share already exists
    stmt = select(DriveShare).where(
        DriveShare.drive_id == drive_id,
        DriveShare.group_id == group_id,
        DriveShare.path == path
    )
    existing = db.scalars(stmt).first()
    if existing:
        return existing

    share = DriveShare(drive_id=drive_id, group_id=group_id, path=path)
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


def remove_path_share(db: Session, share_id: int) -> bool:
    share = db.get(DriveShare, share_id)
    if share:
        db.delete(share)
        db.commit()
        return True
    return False


async def download_file(
    db: Session, drive_id: int, path: str, user_groups: list[Group], is_admin: bool
):
    """Get the async generator to stream the file."""
    drive = db.get(DriveConfig, drive_id)
    if not drive or not drive.is_active:
        raise HTTPException(status_code=404, detail="Drive not found or inactive")

    path = "/" + path.strip("/") if path.strip("/") else "/"

    if not is_admin:
        group_ids = [g.id for g in user_groups]
        stmt = select(DriveShare).where(
            DriveShare.drive_id == drive_id,
            DriveShare.group_id.in_(group_ids)
        )
        shares = db.scalars(stmt).all()
        shared_paths = [s.path.rstrip("/") for s in shares]
        
        has_access = False
        clean_path = path.rstrip("/")
        for sp in shared_paths:
            if clean_path == sp or clean_path.startswith(sp + "/"):
                has_access = True
                break
                
        if not has_access:
            raise HTTPException(status_code=403, detail="Forbidden")

    provider = _get_provider(drive)
    return await provider.download(path)
