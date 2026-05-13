"""
FileRecord model — metadata about every file managed by Nexus.

The actual binary lives in an external storage provider (ownCloud, etc.).
This table holds the pointer (``external_file_id``) and the group assignment.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FileRecord(Base):
    __tablename__ = "file_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    is_folder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("file_records.id", ondelete="CASCADE"), nullable=True, index=True
    )
    storage_provider: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "owncloud" | "gdrive" | "onedrive"
    external_file_id: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # WebDAV path or cloud file ID
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relationships ───────────────────────────────────────────────────
    group = relationship("Group", back_populates="files")
    uploader = relationship("User", back_populates="uploaded_files")
    children = relationship("FileRecord", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("FileRecord", back_populates="children", remote_side=[id])

    def __repr__(self) -> str:
        return f"<FileRecord id={self.id} filename={self.filename!r} is_folder={self.is_folder}>"
