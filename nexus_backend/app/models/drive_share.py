"""
DriveShare model — maps a path on an external drive to a specific group.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DriveShare(Base):
    __tablename__ = "drive_shares"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    drive_id: Mapped[int] = mapped_column(
        ForeignKey("drive_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    drive = relationship("DriveConfig")
    group = relationship("Group")

    def __repr__(self) -> str:
        return f"<DriveShare drive={self.drive_id} group={self.group_id} path={self.path!r}>"
