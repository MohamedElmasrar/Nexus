"""
File service — orchestrates file upload, listing, and download.

This layer sits between the HTTP routers and the storage providers,
keeping the file retrieval logic decoupled from FastAPI so it can
be reused by future features (e.g. RAG pipelines, AI document parsing).
"""

import json
import mimetypes
from typing import AsyncGenerator

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.drive_config import DriveConfig
from app.models.file_record import FileRecord
from app.models.user import User
from app.services.storage import get_storage_provider, StorageProvider


def get_default_drive_config(db: Session) -> DriveConfig | None:
    """Return the first active ownCloud drive config, or ``None``."""
    return (
        db.query(DriveConfig)
        .filter(DriveConfig.drive_type == "owncloud", DriveConfig.is_active.is_(True))
        .first()
    )


def _build_owncloud_provider() -> StorageProvider:
    """Build an OwnCloudProvider from environment variables (fallback)."""
    settings = get_settings()
    return get_storage_provider("owncloud", {
        "url": settings.OWNCLOUD_URL,
        "username": settings.OWNCLOUD_USERNAME,
        "password": settings.OWNCLOUD_PASSWORD,
    })


def _resolve_provider(db: Session, drive_id: int | None = None) -> tuple[StorageProvider, str]:
    """
    Resolve the storage provider to use.

    Returns
    -------
    tuple[StorageProvider, str]
        (provider_instance, drive_type_string)
    """
    if drive_id is not None:
        cfg = db.query(DriveConfig).filter(DriveConfig.id == drive_id).first()
        if cfg is None:
            raise ValueError(f"Drive config {drive_id} not found")
        config_dict = json.loads(cfg.config_json)
        return get_storage_provider(cfg.drive_type, config_dict), cfg.drive_type

    # Try DB-configured ownCloud first, fall back to env vars
    cfg = get_default_drive_config(db)
    if cfg:
        config_dict = json.loads(cfg.config_json)
        return get_storage_provider(cfg.drive_type, config_dict), cfg.drive_type

    return _build_owncloud_provider(), "owncloud"


async def upload_file(
    db: Session,
    file_content: bytes,
    filename: str,
    group_id: int,
    user: User,
    drive_id: int | None = None,
    parent_id: int | None = None,
) -> FileRecord:
    """
    Upload a file to the resolved storage provider and persist a FileRecord.
    """
    provider, drive_type = _resolve_provider(db, drive_id)

    # Organise files by group name/id
    dest_path = f"/nexus/group_{group_id}"
    external_id = await provider.upload(file_content, filename, dest_path)

    mime, _ = mimetypes.guess_type(filename)
    record = FileRecord(
        filename=filename,
        is_folder=False,
        parent_id=parent_id,
        storage_provider=drive_type,
        external_file_id=external_id,
        group_id=group_id,
        uploaded_by=user.id,
        file_size=len(file_content),
        mime_type=mime,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


async def create_folder(
    db: Session,
    name: str,
    group_id: int,
    user: User,
    parent_id: int | None = None,
) -> FileRecord:
    """Create a virtual folder in the database."""
    record = FileRecord(
        filename=name,
        is_folder=True,
        parent_id=parent_id,
        storage_provider="system",
        external_file_id="folder",
        group_id=group_id,
        uploaded_by=user.id,
        file_size=0,
        mime_type="application/vnd.nexus.folder",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_files_for_group(db: Session, group_id: int) -> list[FileRecord]:
    """Return every file linked to a group."""
    return (
        db.query(FileRecord)
        .filter(FileRecord.group_id == group_id)
        .order_by(FileRecord.is_folder.desc(), FileRecord.filename.asc())
        .all()
    )


def get_file_record(db: Session, file_id: int) -> FileRecord | None:
    return db.query(FileRecord).filter(FileRecord.id == file_id).first()


async def download_file(
    db: Session, file_record: FileRecord
) -> AsyncGenerator[bytes, None]:
    """Stream the file bytes from whatever provider originally stored it."""
    # Resolve provider from the record's storage_provider field
    cfg = (
        db.query(DriveConfig)
        .filter(
            DriveConfig.drive_type == file_record.storage_provider,
            DriveConfig.is_active.is_(True),
        )
        .first()
    )
    if cfg:
        config_dict = json.loads(cfg.config_json)
        provider = get_storage_provider(cfg.drive_type, config_dict)
    else:
        # Fallback to env-based ownCloud
        provider = _build_owncloud_provider()

    async for chunk in provider.download(file_record.external_file_id):
        yield chunk
