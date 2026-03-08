"""
Pydantic schemas for chat, conversation, and message endpoints.
"""

from datetime import datetime

from pydantic import BaseModel

# ── Source citation ────────────────────────────────────────────────────────────


class SourceCitation(BaseModel):
    """A document chunk returned as evidence for an AI answer."""

    document_id: str
    filename: str
    department: str
    excerpt: str
    score: float


# ── Chat (simple one-shot) ─────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Send a message; optionally provide a conversation_id to continue a thread."""

    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    """AI response with source citations and conversation reference."""

    response: str
    sources: list[SourceCitation] = []
    conversation_id: str


# ── Messages ───────────────────────────────────────────────────────────────────


class MessageOut(BaseModel):
    """A single message in a conversation thread."""

    id: str
    role: str  # "user" | "assistant"
    content: str
    sources: list[SourceCitation] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Conversations ──────────────────────────────────────────────────────────────


class ConversationOut(BaseModel):
    """Conversation summary for sidebar / history list."""

    id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationOut):
    """Full conversation including all messages."""

    messages: list[MessageOut] = []
