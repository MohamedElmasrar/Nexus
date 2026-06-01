"""
Chat router — conversation and messaging endpoints.

Handles chat sessions: create conversations, send messages, get AI responses
with source citations from the RAG pipeline.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, get_db
from app.services import chat_service, vector_store, llm_service

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["Chat"],
)


# ── Schemas ────────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New conversation"


class ConversationUpdate(BaseModel):
    title: str


class ImagePayload(BaseModel):
    mime_type: str
    data: str  # Base64 encoded image data


class AskRequest(BaseModel):
    message: str
    images: list[ImagePayload] | None = None
    response_length: str = "medium"


class SourceOut(BaseModel):
    file_path: str
    snippet: str


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: list[SourceOut] | None = None
    images: list[str] | None = None
    created_at: str


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceOut]
    message_id: int
    conversation_id: int


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all conversations for the current user."""
    convs = chat_service.list_conversations(db, current_user.username)
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convs
    ]


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    data: ConversationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new conversation."""
    conv = chat_service.create_conversation(db, current_user.username, data.title)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a conversation with all messages."""
    conv = chat_service.get_conversation(db, conversation_id, current_user.username)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=[SourceOut(**s) for s in m.sources] if m.sources else None,
                images=m.images,
                created_at=m.created_at.isoformat(),
            )
            for m in conv.messages
        ],
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    ok = chat_service.delete_conversation(db, conversation_id, current_user.username)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"detail": "Conversation deleted"}


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update conversation title."""
    conv = chat_service.update_conversation_title(db, conversation_id, current_user.username, data.title)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.post("/conversations/{conversation_id}/ask", response_model=AskResponse)
async def ask_question(
    conversation_id: int,
    data: AskRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message and get an AI response.

    1. Saves the user's message
    2. Searches the vector store for relevant context
    3. Sends the question + context to the LLM
    4. Saves the AI response with source citations
    5. Returns the answer
    """
    # Verify conversation ownership
    conv = chat_service.get_conversation(db, conversation_id, current_user.username)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not data.message.strip() and not data.images:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Construct image data URLs if provided
    image_data_urls = []
    images_payload = []
    if data.images:
        for img in data.images:
            image_data_urls.append(f"data:{img.mime_type};base64,{img.data}")
            images_payload.append({"mime_type": img.mime_type, "data": img.data})

    # 1. Save user message
    chat_service.add_message(
        db,
        conversation_id,
        "user",
        data.message,
        images=image_data_urls if image_data_urls else None,
    )

    # 2. Search vector store and filter for meaningful chunks (similarity < 0.75 distance)
    search_results = []
    if data.message.strip():
        raw_results = vector_store.search(data.message, n_results=5)
        # Cosine distance: < 0.75 is relevant, > 0.75 is irrelevant/noise
        search_results = [r for r in raw_results if r.distance < 0.75]
        # Fallback to the top match if all were filtered out to avoid loss of context
        if raw_results and not search_results:
            search_results = [raw_results[0]]

    # 3. Get LLM response (multimodal base64 + context + response length setting)
    llm_response = llm_service.ask(
        question=data.message,
        context_results=search_results,
        images=images_payload if images_payload else None,
        response_length=data.response_length,
    )

    # 4. Save assistant message with sources
    assistant_msg = chat_service.add_message(
        db,
        conversation_id,
        "assistant",
        llm_response.answer,
        sources=llm_response.sources,
    )

    # 5. Auto-title the conversation if it's the first exchange
    if conv.title == "New conversation":
        title_text = data.message.strip() if data.message.strip() else "Image upload"
        short_title = title_text[:60]
        if len(title_text) > 60:
            short_title += "..."
        chat_service.update_conversation_title(db, conversation_id, current_user.username, short_title)

    return AskResponse(
        answer=llm_response.answer,
        sources=[SourceOut(**s) for s in llm_response.sources],
        message_id=assistant_msg.id,
        conversation_id=conversation_id,
    )
