"""
FileSyncStatus model — tracks which ownCloud files have been
indexed by the AI model.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FileSyncStatus(Base):
    __tablename__ = "file_sync_status"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    file_path: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # "pending" | "synced" | "error"
    synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_takeaways: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<FileSyncStatus path={self.file_path!r} status={self.status!r}>"
