"""
AuditLog ORM model — immutable record of every security-relevant action.
Used for RBAC enforcement visibility and compliance reporting.
outcome: "allow" | "deny"
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    # Primary key
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Who performed the action (nullable — system events may have no user)
    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # What they did — e.g. "login", "query", "upload", "delete_document"
    action: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # What resource was affected — e.g. "conversation:uuid" or "document:filename"
    resource: Mapped[str | None] = mapped_column(String, nullable=True)

    # Result of the action
    outcome: Mapped[str] = mapped_column(String, nullable=False, default="allow")  # "allow" | "deny"

    # Structured extra context — e.g. department checked, query text, error message
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON object

    # Network context
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)

    # Timestamp — never updated (immutable audit trail)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="audit_logs")  # noqa: F821
