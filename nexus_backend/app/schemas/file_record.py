"""Pydantic schemas for FileRecord."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    is_folder: bool
    parent_id: int | None
    storage_provider: str
    group_id: int
    uploaded_by: int | None
    uploaded_at: datetime
    file_size: int | None
    mime_type: str | None


class FolderCreate(BaseModel):
    name: str
    group_id: int
    parent_id: int | None = None
    drive_id: int | None = None


class FileUploadResponse(BaseModel):
    file: FileRecordRead
    message: str = "File uploaded successfully"
