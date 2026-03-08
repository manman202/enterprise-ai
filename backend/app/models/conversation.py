"""
Conversation ORM model — a named thread of messages between a user and the AI.
Each conversation belongs to one user and contains many messages.
"""

import uuid
from datetime import datetime

from app.db.postgres import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Conversation(Base):
    __tablename__ = "conversations"

    # Primary key
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Owner — cascade delete when user is deleted
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Display title — auto-generated from first message (first 60 chars)
    title: Mapped[str] = mapped_column(
        String, default="New conversation", nullable=False
    )

    # Denormalized count for quick display in sidebar (updated on message insert)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="conversations"
    )
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
