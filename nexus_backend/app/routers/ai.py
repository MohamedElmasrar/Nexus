"""
AI router — document indexing and vector store management.

Admin endpoints for indexing files into the RAG pipeline.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_db, require_admin
from app.services import ingestion, vector_store

router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI — Indexing"],
    dependencies=[Depends(require_admin)],
)


class IndexRequest(BaseModel):
    file_path: str


class IndexAllRequest(BaseModel):
    base_path: str = "/"


@router.post("/index")
async def index_file(
    data: IndexRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Index a specific file from ownCloud into the vector store."""
    result = await ingestion.ingest_file(
        db=db,
        file_path=data.file_path,
        username=current_user.username,
        password=current_user.oc_password,
    )

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result.get("error", "Indexing failed"))

    return result


@router.post("/index-all")
async def index_all_files(
    data: IndexAllRequest = IndexAllRequest(),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Index all unsynced files from ownCloud recursively."""
    results = await ingestion.ingest_all_unsynced(
        db=db,
        username=current_user.username,
        password=current_user.oc_password,
        base_path=data.base_path,
    )

    synced = sum(1 for r in results if r["status"] == "synced")
    errors = sum(1 for r in results if r["status"] == "error")

    return {
        "total": len(results),
        "synced": synced,
        "errors": errors,
        "results": results,
    }


@router.delete("/index")
async def remove_from_index(
    file_path: str = Query(..., description="File path to remove from index"),
    current_user: CurrentUser = Depends(require_admin),
):
    """Remove a file from the vector store index."""
    count = vector_store.delete_document(file_path)
    return {"file_path": file_path, "chunks_removed": count}


@router.get("/index")
async def list_indexed_files(
    current_user: CurrentUser = Depends(require_admin),
):
    """List all files currently in the vector store."""
    files = vector_store.get_indexed_files()
    return {"total_files": len(files), "files": files}
