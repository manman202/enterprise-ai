"""
User ORM model — represents both local accounts and AD-provisioned users.
LDAP users have hashed_password=None; local dev users have a password hash.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base


class User(Base):
    __tablename__ = "users"

    # Primary key
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Identity
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Enterprise fields (populated from Active Directory)
    department: Mapped[str | None] = mapped_column(String, nullable=True)
    ad_groups: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of AD group names

    # Auth — nullable for AD users (they auth against LDAP, not local password)
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)

    # Status flags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(  # noqa: F821
        "AuditLog", back_populates="user", cascade="all, delete-orphan"
    )
