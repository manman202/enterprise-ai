"""
Document ORM model — metadata record for every file ingested into the knowledge base.
The actual content lives in ChromaDB; this table tracks ingestion state.
status: "pending" | "ingested" | "failed"
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base


class Document(Base):
    __tablename__ = "documents"

    # Primary key
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # File identity
    filename: Mapped[str] = mapped_column(String, nullable=False)
    filepath: Mapped[str | None] = mapped_column(
        String, nullable=True                # Original path (from watcher or upload)
    )

    # Access control — limits which users can query this document
    department: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True    # e.g. "RH", "Finance", "IT"
    )

    # File stats
    size: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0   # Raw bytes
    )
    file_hash: Mapped[str | None] = mapped_column(
        String, nullable=True                # MD5 of file content (dedup check)
    )

    # Ingestion state
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="pending", index=True
        # "pending" → just uploaded, not yet in ChromaDB
        # "ingested" → successfully chunked and stored in ChromaDB
        # "failed" → ingestion failed (see error_message)
    )
    chunks_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True               # How many chunks are in ChromaDB
    )
    ingested_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True              # When ingestion completed
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True                  # Ingestion error detail if failed
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
