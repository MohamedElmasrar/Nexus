"""
DriveConfig model — stores connection details for external storage providers.

The ``config_json`` column holds provider-specific credentials as a JSON dict
(e.g. ownCloud URL/user/password, or Google Drive service-account keys).
Only admins may read or write this table.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DriveConfig(Base):
    __tablename__ = "drive_configs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    drive_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "owncloud" | "gdrive" | "onedrive"
    label: Mapped[str] = mapped_column(
        String(150), nullable=False, default="Default"
    )
    config_json: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # JSON-serialised credentials
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<DriveConfig id={self.id} type={self.drive_type!r} active={self.is_active}>"
