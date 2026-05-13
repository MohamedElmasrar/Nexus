"""
Admin — File management and sharing via ownCloud WebDAV + OCS Share API.

All endpoints require the ``admin`` role.
Replaces the old admin_drives.py.
"""

import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_db, require_admin
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(
    prefix="/api/v1/admin/files",
    tags=["Admin — Files"],
    dependencies=[Depends(require_admin)],
)


# ── Browse ─────────────────────────────────────────────────────────────────

@router.get("/browse")
async def browse_files(
    path: str = Query("/", description="Directory path on ownCloud"),
    current_user: CurrentUser = Depends(require_admin),
):
    """Browse ownCloud files as admin."""
    oc = get_owncloud_client()
    try:
        files = await oc.list_files(current_user.username, current_user.oc_password, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ownCloud error: {e}")
    return [
        {
            "name": f.name,
            "path": f.path,
            "is_directory": f.is_directory,
            "size": f.size,
            "content_type": f.content_type,
            "last_modified": f.last_modified,
        }
        for f in files
    ]


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    path: str = Query("/", description="Destination directory on ownCloud"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Upload a file to ownCloud and auto-index for AI search."""
    oc = get_owncloud_client()
    content = await file.read()
    dest = f"{path.rstrip('/')}/{file.filename}"
    try:
        ok = await oc.upload_file(current_user.username, current_user.oc_password, dest, content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Upload failed")

    # Auto-index the uploaded file for AI search
    try:
        from app.services import ingestion
        await ingestion.ingest_file(db, dest, current_user.username, current_user.oc_password)
    except Exception:
        pass  # Non-blocking: upload succeeded even if indexing fails

    return {"detail": f"Uploaded {file.filename} to {path}", "path": dest}


# ── Download ───────────────────────────────────────────────────────────────

@router.get("/download")
async def download_file(
    path: str = Query(..., description="File path on ownCloud"),
    current_user: CurrentUser = Depends(require_admin),
):
    """Stream a file download from ownCloud."""
    oc = get_owncloud_client()
    mime_type, _ = mimetypes.guess_type(path)
    filename = path.rstrip("/").rsplit("/", 1)[-1]

    try:
        stream = oc.download_file(current_user.username, current_user.oc_password, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Download error: {e}")

    return StreamingResponse(
        stream,
        media_type=mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Create Folder ──────────────────────────────────────────────────────────

class CreateFolderRequest(BaseModel):
    path: str


@router.post("/folder")
async def create_folder(
    data: CreateFolderRequest,
    current_user: CurrentUser = Depends(require_admin),
):
    """Create a folder on ownCloud."""
    oc = get_owncloud_client()
    try:
        ok = await oc.create_folder(current_user.username, current_user.oc_password, data.path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Create folder error: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create folder")
    return {"detail": f"Created folder at {data.path}"}


# ── Delete ─────────────────────────────────────────────────────────────────

@router.delete("/")
async def delete_file(
    path: str = Query(..., description="File or folder path to delete"),
    current_user: CurrentUser = Depends(require_admin),
):
    """Delete a file or folder on ownCloud."""
    oc = get_owncloud_client()
    try:
        ok = await oc.delete_file(current_user.username, current_user.oc_password, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Delete error: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete")

    # Remove from vector store if indexed
    try:
        from app.services import vector_store
        vector_store.delete_documents_by_path_prefix(path)
    except Exception as ex:
        import logging
        logging.getLogger("nexus.api").warning(f"Failed to delete chunks for {path}: {ex}")

    return {"detail": f"Deleted {path}"}


# ── Sharing ────────────────────────────────────────────────────────────────

class ShareRequest(BaseModel):
    path: str
    share_type: int = 1         # 0=user, 1=group
    share_with: str
    permissions: int = 1        # 1=read, 31=all


@router.get("/shares")
async def list_shares(
    path: str = Query("", description="Filter shares by path (optional)"),
    current_user: CurrentUser = Depends(require_admin),
):
    """List ownCloud shares."""
    oc = get_owncloud_client()
    shares = await oc.get_shares(current_user.username, current_user.oc_password, path)
    return [
        {
            "id": s.id,
            "share_type": s.share_type,
            "share_with": s.share_with,
            "share_with_displayname": s.share_with_displayname,
            "path": s.path,
            "permissions": s.permissions,
            "uid_owner": s.uid_owner,
            "file_target": s.file_target,
        }
        for s in shares
    ]


@router.post("/share")
async def create_share(
    data: ShareRequest,
    current_user: CurrentUser = Depends(require_admin),
):
    """Share a file/folder with a user or group on ownCloud."""
    oc = get_owncloud_client()
    share = await oc.create_share(
        current_user.username,
        current_user.oc_password,
        path=data.path,
        share_type=data.share_type,
        share_with=data.share_with,
        permissions=data.permissions,
    )
    if share is None:
        raise HTTPException(status_code=400, detail="Failed to create share")
    return {
        "id": share.id,
        "share_type": share.share_type,
        "share_with": share.share_with,
        "path": share.path,
        "permissions": share.permissions,
    }


@router.delete("/share/{share_id}")
async def delete_share(
    share_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    """Remove an ownCloud share."""
    oc = get_owncloud_client()
    ok = await oc.delete_share(current_user.username, current_user.oc_password, share_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to delete share")
    return {"detail": f"Share {share_id} deleted"}


# ── Sync Status ────────────────────────────────────────────────────────────

@router.get("/sync-status")
def get_sync_status(
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get the AI sync status for a file."""
    from app.models.file_sync import FileSyncStatus
    record = db.query(FileSyncStatus).filter(FileSyncStatus.file_path == path).first()
    if record is None:
        return {"file_path": path, "status": "not_tracked", "synced_at": None}
    return {
        "file_path": record.file_path,
        "status": record.status,
        "synced_at": record.synced_at,
    }


@router.post("/sync-status")
def set_sync_status(
    path: str = Query(...),
    status: str = Query("pending"),
    db: Session = Depends(get_db),
):
    """Mark a file for AI sync."""
    from app.models.file_sync import FileSyncStatus
    from datetime import datetime, timezone

    record = db.query(FileSyncStatus).filter(FileSyncStatus.file_path == path).first()
    if record is None:
        record = FileSyncStatus(file_path=path, status=status)
        db.add(record)
    else:
        record.status = status
        if status == "synced":
            record.synced_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return {
        "file_path": record.file_path,
        "status": record.status,
        "synced_at": record.synced_at,
    }
