"""
Current-user router — ownCloud-native endpoints.

* GET  /api/v1/users/me/            — profile (from JWT + OCS)
* GET  /api/v1/users/me/groups      — user's ownCloud groups
* GET  /api/v1/users/me/files       — browse files (WebDAV as user)
* GET  /api/v1/users/me/files/download — stream file download
"""

import mimetypes
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, get_db
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(prefix="/api/v1/users/me", tags=["Current User"])


@router.get("/")
async def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    """Return the current user's profile."""
    oc = get_owncloud_client()
    user_info = await oc.get_current_user(current_user.username, current_user.oc_password)
    if user_info is None:
        return {
            "username": current_user.username,
            "display_name": current_user.display_name,
            "email": current_user.email,
            "role": current_user.role,
            "groups": [],
        }
    return {
        "username": user_info.username,
        "display_name": user_info.display_name,
        "email": user_info.email,
        "role": "admin" if user_info.is_admin else "user",
        "groups": user_info.groups,
    }


@router.get("/groups")
async def my_groups(current_user: CurrentUser = Depends(get_current_user)):
    """Return the ownCloud groups the current user belongs to."""
    oc = get_owncloud_client()
    user_info = await oc.get_current_user(current_user.username, current_user.oc_password)
    if user_info is None:
        return []
    return [{"id": g, "name": g} for g in user_info.groups]


@router.get("/files")
async def browse_files(
    path: str = Query("/", description="Directory path on ownCloud"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Browse the user's ownCloud files via WebDAV."""
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


@router.get("/files/download")
async def download_file(
    path: str = Query(..., description="File path on ownCloud"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Stream a file download from ownCloud."""
    oc = get_owncloud_client()
    mime_type, _ = mimetypes.guess_type(path)
    filename = path.rstrip("/").rsplit("/", 1)[-1]

    try:
        stream = oc.download_file(current_user.username, current_user.oc_password, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ownCloud error: {e}")

    return StreamingResponse(
        stream,
        media_type=mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/files/upload")
async def upload_file(
    path: str = Query("/", description="Destination directory on ownCloud"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a file to the user's ownCloud account and auto-index for AI."""
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


@router.delete("/files")
async def delete_file(
    path: str = Query(..., description="File or folder path to delete"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a file or folder from the user's ownCloud account."""
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
        # Don't fail the deletion if vector store fails
        import logging
        logging.getLogger("nexus.api").warning(f"Failed to delete chunks for {path}: {ex}")

    return {"detail": f"Deleted {path}"}


class CreateFolderRequest(BaseModel):
    path: str


@router.post("/files/folder")
async def create_folder(
    data: CreateFolderRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a folder in the user's ownCloud account."""
    oc = get_owncloud_client()
    try:
        ok = await oc.create_folder(current_user.username, current_user.oc_password, data.path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Create folder error: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create folder")
    return {"detail": f"Created folder at {data.path}"}


