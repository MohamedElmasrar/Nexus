"""
Chat service — CRUD operations for conversations and messages.

Manages the persistence of user chat sessions in PostgreSQL.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message


def create_conversation(db: Session, username: str, title: str = "New conversation") -> Conversation:
    """Create a new conversation for a user."""
    conv = Conversation(
        user_username=username,
        title=title,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(db: Session, username: str) -> list[Conversation]:
    """List all conversations for a user, most recent first."""
    return (
        db.query(Conversation)
        .filter(Conversation.user_username == username)
        .order_by(Conversation.updated_at.desc())
        .all()
    )


def get_conversation(db: Session, conversation_id: int, username: str) -> Conversation | None:
    """Get a specific conversation (with messages) owned by the user."""
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_username == username,
        )
        .first()
    )


def delete_conversation(db: Session, conversation_id: int, username: str) -> bool:
    """Delete a conversation and all its messages. Returns True if found."""
    conv = get_conversation(db, conversation_id, username)
    if conv is None:
        return False
    db.delete(conv)
    db.commit()
    return True


def add_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
    sources: list[dict] | None = None,
) -> Message:
    """Add a message to an existing conversation."""
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        sources=sources,
    )
    db.add(msg)

    # Update conversation timestamp
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        conv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)
    return msg


def update_conversation_title(db: Session, conversation_id: int, username: str, title: str) -> Conversation | None:
    """Update the title of a conversation."""
    conv = get_conversation(db, conversation_id, username)
    if conv is None:
        return None
    conv.title = title
    db.commit()
    db.refresh(conv)
    return conv
