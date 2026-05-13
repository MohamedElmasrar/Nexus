"""Pydantic schemas for FileSyncStatus."""

from datetime import datetime

from pydantic import BaseModel


class FileSyncStatusRead(BaseModel):
    id: int
    file_path: str
    status: str
    synced_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FileSyncStatusUpdate(BaseModel):
    status: str  # "pending" | "synced" | "error"
