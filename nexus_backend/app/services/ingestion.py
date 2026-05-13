"""
Ingestion pipeline — orchestrates file download, parsing, chunking, and vectorization.

Downloads a file from ownCloud, parses it, chunks the text, and stores
the embeddings in ChromaDB. Updates FileSyncStatus in PostgreSQL.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.file_sync import FileSyncStatus
from app.services.document_parser import parse_document
from app.services.chunker import chunk_text
from app.services import vector_store
from app.services.owncloud_client import get_owncloud_client

logger = logging.getLogger("nexus.ingestion")


async def ingest_file(
    db: Session,
    file_path: str,
    username: str,
    password: str,
) -> dict:
    """
    Full ingestion pipeline for a single file.

    1. Download file bytes from ownCloud
    2. Parse the document (PDF, DOCX, XLSX, etc.)
    3. Chunk the extracted text
    4. Index chunks in ChromaDB
    5. Update FileSyncStatus in PostgreSQL

    Returns a summary dict with status and chunk count.
    """
    logger.info(f"Ingesting: {file_path}")

    try:
        # 1. Download from ownCloud
        oc = get_owncloud_client()
        file_bytes = b""
        async for chunk in oc.download_file(username, password, file_path):
            file_bytes += chunk

        if not file_bytes:
            raise ValueError(f"Empty file: {file_path}")

        # 2. Parse
        filename = file_path.rstrip("/").rsplit("/", 1)[-1]
        parsed = parse_document(file_bytes, filename)

        if not parsed.text.strip():
            _update_sync_status(db, file_path, "empty")
            return {"file_path": file_path, "status": "empty", "chunks": 0}

        # 3. Chunk
        chunks = chunk_text(parsed.text, file_path)

        if not chunks:
            _update_sync_status(db, file_path, "empty")
            return {"file_path": file_path, "status": "empty", "chunks": 0}

        # 4. Index in vector store (replaces old chunks if re-indexing)
        count = vector_store.index_chunks(chunks)

        # 5. Update sync status
        _update_sync_status(db, file_path, "synced")

        logger.info(f"Ingested {count} chunks for {file_path}")
        return {"file_path": file_path, "status": "synced", "chunks": count}

    except Exception as e:
        logger.error(f"Ingestion failed for {file_path}: {e}")
        _update_sync_status(db, file_path, "error")
        return {"file_path": file_path, "status": "error", "error": str(e), "chunks": 0}


def _update_sync_status(db: Session, file_path: str, status: str) -> None:
    """Create or update the FileSyncStatus record."""
    record = db.query(FileSyncStatus).filter(FileSyncStatus.file_path == file_path).first()
    if record is None:
        record = FileSyncStatus(file_path=file_path, status=status)
        db.add(record)
    else:
        record.status = status
        if status == "synced":
            record.synced_at = datetime.now(timezone.utc)
    db.commit()


async def ingest_all_unsynced(
    db: Session,
    username: str,
    password: str,
    base_path: str = "/",
) -> list[dict]:
    """
    Walk the ownCloud directory and ingest all files that haven't been synced yet.
    """
    oc = get_owncloud_client()
    results: list[dict] = []

    try:
        files = await oc.list_files(username, password, base_path)
    except Exception as e:
        logger.error(f"Failed to list files at {base_path}: {e}")
        return [{"file_path": base_path, "status": "error", "error": str(e), "chunks": 0}]

    for f in files:
        if f.is_directory:
            # Recurse into subdirectories
            sub_results = await ingest_all_unsynced(db, username, password, f.path)
            results.extend(sub_results)
        else:
            # Check if already synced
            record = db.query(FileSyncStatus).filter(
                FileSyncStatus.file_path == f.path,
                FileSyncStatus.status == "synced",
            ).first()

            if record is None:
                result = await ingest_file(db, f.path, username, password)
                results.append(result)

    return results
