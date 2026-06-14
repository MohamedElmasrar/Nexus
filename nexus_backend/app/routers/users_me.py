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
from datetime import datetime, timezone

from app.core.dependencies import CurrentUser, get_current_user, get_db
from app.services.owncloud_client import get_owncloud_client
from app.models.favorite import Favorite
from app.models.recent_view import RecentView


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
    preview: bool = Query(False, description="If true, serve inline instead of attachment"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Stream a file download from ownCloud."""
    oc = get_owncloud_client()
    filename = path.rstrip("/").rsplit("/", 1)[-1]
    
    # Robust MIME type determination for common types (helps on Windows registry gaps)
    ext = filename.lower().split(".")[-1]
    mime_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "txt": "text/plain",
        "html": "text/html",
        "css": "text/css",
        "js": "application/javascript",
        "json": "application/json",
        "md": "text/markdown",
    }
    mime_type = mime_map.get(ext)
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(path)

    try:
        stream = oc.download_file(current_user.username, current_user.oc_password, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ownCloud error: {e}")

    disposition = "inline" if preview else "attachment"
    return StreamingResponse(
        stream,
        media_type=mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
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


@router.get("/files/summary")
async def get_file_summary(
    path: str = Query(..., description="File path on ownCloud"),
    force_refresh: bool = Query(False, description="If true, bypass database cache and regenerate summary"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get or generate an AI summary for an indexed file.
    
    If the file is not yet indexed, returns {"indexed": False}.
    Otherwise, retrieves document chunks from ChromaDB and summarizes them.
    Checks and writes to database cache to avoid redundant AI calls.
    """
    from app.services import vector_store, llm_service
    from app.models.file_sync import FileSyncStatus
    import json
    import logging
    
    logger = logging.getLogger("nexus")
    
    # 1. Check if we already have the summary cached in the database
    sync_status = db.query(FileSyncStatus).filter(FileSyncStatus.file_path == path).first()
    if not force_refresh and sync_status and sync_status.ai_summary:
        takeaways = []
        if sync_status.ai_takeaways:
            try:
                takeaways = json.loads(sync_status.ai_takeaways)
            except Exception:
                takeaways = [t.strip() for t in sync_status.ai_takeaways.split(",") if t.strip()]
                
        tags = []
        if sync_status.ai_tags:
            try:
                tags = json.loads(sync_status.ai_tags)
            except Exception:
                tags = [t.strip() for t in sync_status.ai_tags.split(",") if t.strip()]

        return {
            "indexed": True,
            "summary": sync_status.ai_summary,
            "takeaways": takeaways,
            "tags": tags
        }
        
    # 2. Cache miss: check vector store for file content chunks
    try:
        collection = vector_store._get_collection()
        data = collection.get(where={"file_path": path}, include=["documents", "metadatas"])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query vector store: {e}"
        )
        
    if not data or not data["documents"]:
        return {
            "indexed": False,
            "summary": None,
            "takeaways": [],
            "tags": []
        }
        
    # Chunks exist. Sort them by chunk_index to maintain document flow
    chunks_with_indices = []
    for doc, meta in zip(data["documents"], data["metadatas"]):
        chunk_idx = meta.get("chunk_index", 0)
        chunks_with_indices.append((chunk_idx, doc))
        
    chunks_with_indices.sort(key=lambda x: x[0])
    chunk_texts = [x[1] for x in chunks_with_indices]
    
    # 3. Generate summary using Gemini
    summary_obj = llm_service.summarize_document(path, chunk_texts)
    
    # 4. Save to database cache
    if not sync_status:
        sync_status = FileSyncStatus(
            file_path=path,
            status="synced",
            ai_summary=summary_obj.summary,
            ai_takeaways=json.dumps(summary_obj.takeaways),
            ai_tags=json.dumps(summary_obj.tags),
        )
        db.add(sync_status)
    else:
        sync_status.ai_summary = summary_obj.summary
        sync_status.ai_takeaways = json.dumps(summary_obj.takeaways)
        sync_status.ai_tags = json.dumps(summary_obj.tags)
        sync_status.status = "synced"
        
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cache generated summary to database: {e}")
        
    return {
        "indexed": True,
        "summary": summary_obj.summary,
        "takeaways": summary_obj.takeaways,
        "tags": summary_obj.tags
    }


# ── Favorites ──────────────────────────────────────────────────────────────

class FavoriteRequest(BaseModel):
    file_path: str
    file_name: str

@router.get("/favorites")
async def list_favorites(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's favorite files."""
    favs = (
        db.query(Favorite)
        .filter(Favorite.username == current_user.username)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    return [
        {
            "id": f.id,
            "file_path": f.file_path,
            "file_name": f.file_name,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in favs
    ]

@router.post("/favorites")
async def add_favorite(
    data: FavoriteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a file to the current user's favorites."""
    existing = (
        db.query(Favorite)
        .filter(Favorite.username == current_user.username, Favorite.file_path == data.file_path)
        .first()
    )
    if existing:
        return {"id": existing.id, "file_path": existing.file_path, "file_name": existing.file_name, "detail": "Already in favorites"}
    
    fav = Favorite(
        username=current_user.username,
        file_path=data.file_path,
        file_name=data.file_name,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return {"id": fav.id, "file_path": fav.file_path, "file_name": fav.file_name}

@router.delete("/favorites")
async def remove_favorite(
    file_path: str = Query(..., description="File path to unfavorite"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a file from the current user's favorites."""
    deleted = (
        db.query(Favorite)
        .filter(Favorite.username == current_user.username, Favorite.file_path == file_path)
        .delete()
    )
    db.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"detail": f"Removed {file_path} from favorites"}


# ── Recent Views ───────────────────────────────────────────────────────────

class RecentViewRequest(BaseModel):
    file_path: str
    file_name: str

@router.get("/recent-views")
async def list_recent_views(
    limit: int = Query(20, ge=1, le=50, description="Max results"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's recently viewed files."""
    views = (
        db.query(RecentView)
        .filter(RecentView.username == current_user.username)
        .order_by(RecentView.viewed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": v.id,
            "file_path": v.file_path,
            "file_name": v.file_name,
            "viewed_at": v.viewed_at.isoformat() if v.viewed_at else None,
        }
        for v in views
    ]

@router.post("/recent-views")
async def record_view(
    data: RecentViewRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a file view (upserts — updates viewed_at if already exists)."""
    existing = (
        db.query(RecentView)
        .filter(RecentView.username == current_user.username, RecentView.file_path == data.file_path)
        .first()
    )
    if existing:
        existing.viewed_at = datetime.now(timezone.utc)
        existing.file_name = data.file_name
        db.commit()
        return {"id": existing.id, "file_path": existing.file_path, "file_name": existing.file_name}
    
    view = RecentView(
        username=current_user.username,
        file_path=data.file_path,
        file_name=data.file_name,
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return {"id": view.id, "file_path": view.file_path, "file_name": view.file_name}

@router.delete("/recent-views")
async def clear_recent_views(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all recent views for the current user."""
    db.query(RecentView).filter(RecentView.username == current_user.username).delete()
    db.commit()
    return {"detail": "Recent views cleared"}


# ── Content Search ─────────────────────────────────────────────────────────

@router.get("/files/search")
async def search_files(
    q: str = Query(..., description="Search query"),
    n: int = Query(10, ge=1, le=50, description="Max results"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Search document content via vector similarity. Returns matching files with snippets."""
    from app.services import vector_store
    
    results = vector_store.search(q, n_results=n)
    
    # Deduplicate by file_path, keeping the best (lowest distance) result per file
    seen: dict[str, dict] = {}
    for r in results:
        if r.file_path not in seen or r.distance < seen[r.file_path]["distance"]:
            seen[r.file_path] = {
                "file_path": r.file_path,
                "file_name": r.file_path.rsplit("/", 1)[-1] if "/" in r.file_path else r.file_path,
                "snippet": r.text[:200],
                "distance": r.distance,
            }
    
    return {
        "query": q,
        "results": sorted(seen.values(), key=lambda x: x["distance"]),
    }




