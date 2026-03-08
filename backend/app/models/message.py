"""
Message ORM model — a single turn in a conversation.
role: "user" | "assistant"
sources: JSON list of {document_id, filename, department, score, excerpt}
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base


class Message(Base):
    __tablename__ = "messages"

    # Primary key
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Parent conversation — cascade delete
    conversation_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Who sent this message
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" or "assistant"

    # Message body
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # RAG sources — JSON array (only set for assistant messages)
    sources: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: [{document_id, filename, score, excerpt}]

    # LLM token usage (for monitoring/billing tracking)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")  # noqa: F821
