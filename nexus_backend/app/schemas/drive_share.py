"""
DriveShare schemas.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DriveShareCreate(BaseModel):
    drive_id: int
    group_id: int
    path: str


class DriveShareRead(BaseModel):
    id: int
    drive_id: int
    group_id: int
    path: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
