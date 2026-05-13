"""
Group service — business logic for group management and user ↔ group membership.
"""

from sqlalchemy.orm import Session

from app.models.group import Group, UserGroupLink
from app.models.user import User
from app.schemas.group import GroupCreate


def create_group(db: Session, data: GroupCreate) -> Group:
    group = Group(name=data.name, description=data.description)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def get_group_by_id(db: Session, group_id: int) -> Group | None:
    return db.query(Group).filter(Group.id == group_id).first()


def get_groups(db: Session, skip: int = 0, limit: int = 100) -> list[Group]:
    return db.query(Group).offset(skip).limit(limit).all()


# ── Membership ──────────────────────────────────────────────────────────────

def add_user_to_group(db: Session, group_id: int, user_id: int) -> bool:
    """
    Assign a user to a group.  Returns ``True`` on success.

    Raises nothing if the link already exists — idempotent.
    """
    existing = (
        db.query(UserGroupLink)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    )
    if existing:
        return True  # already a member

    link = UserGroupLink(user_id=user_id, group_id=group_id)
    db.add(link)
    db.commit()
    return True


def remove_user_from_group(db: Session, group_id: int, user_id: int) -> bool:
    """Remove a user from a group.  Returns ``True`` if the link existed."""
    link = (
        db.query(UserGroupLink)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    )
    if link is None:
        return False
    db.delete(link)
    db.commit()
    return True


def get_user_groups(db: Session, user_id: int) -> list[Group]:
    """Return all groups the user belongs to."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return []
    return list(user.groups)


def is_user_in_group(db: Session, user_id: int, group_id: int) -> bool:
    """Check whether a user is a member of a specific group."""
    return (
        db.query(UserGroupLink)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    ) is not None
