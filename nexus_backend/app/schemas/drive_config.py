"""Pydantic schemas for DriveConfig — credentials are intentionally redacted on read."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DriveConfigCreate(BaseModel):
    drive_type: str = Field(..., pattern="^(owncloud|gdrive|onedrive)$")
    label: str = Field(default="Default", max_length=150)
    config_json: dict  # provider-specific credentials
    is_active: bool = True


class DriveConfigRead(BaseModel):
    """Returned to admins — credentials are NOT exposed."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    drive_type: str
    label: str
    is_active: bool
    created_at: datetime
