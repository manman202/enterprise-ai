"""
KnowledgeSource ORM model — represents a configured data source that feeds
documents into the knowledge base via automated connectors.

source_type: sharepoint | smb | exchange | local | s3
status:      active | inactive | error | syncing
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    # Primary key — UUID string for consistency with other models
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Human-readable name for this source
    name: Mapped[str] = mapped_column(String, nullable=False)

    # Department that owns/uses this source (access-control hint)
    department: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Connector type — determines which connector class handles syncing
    source_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        index=True,
        # "sharepoint" | "smb" | "exchange" | "local" | "s3"
    )

    # JSON blob storing connector-specific config (paths, URLs, credentials)
    # Credentials are stored encrypted at rest via the application layer
    config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string

    # Lifecycle state of this source
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="inactive",
        index=True,
        # "active"   — enabled, syncs on schedule
        # "inactive" — disabled by admin
        # "syncing"  — sync in progress right now
        # "error"    — last sync failed (see last_error)
    )

    # Whether this source should be included in scheduled syncs
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Last sync metadata
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String, nullable=True)  # "success" | "failed"
    last_sync_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # files processed
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)  # error detail if last sync failed

    # Creation metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)  # user_id who created it
