"""
Group model and the many-to-many association table linking Users ↔ Groups.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserGroupLink(Base):
    """Association table for the User ↔ Group many-to-many relationship."""
    __tablename__ = "user_group_links"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationships ───────────────────────────────────────────────────
    users = relationship(
        "User",
        secondary="user_group_links",
        back_populates="groups",
        lazy="selectin",
    )
    files = relationship("FileRecord", back_populates="group", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Group id={self.id} name={self.name!r}>"
