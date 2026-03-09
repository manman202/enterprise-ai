"""
Ingestion service wrapper — accepts raw bytes from connectors and pushes them
through the core ingestion pipeline (extract → chunk → embed → ChromaDB).
Creates a Document DB row so the knowledge page can track connector-ingested files.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


async def ingest_bytes(
    content: bytes,
    filename: str,
    source_id: Optional[str] = None,
    department: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    """
    Create a Document record and run the full ingestion pipeline for raw bytes.

    Args:
        content:     Raw file bytes
        filename:    Original filename (used for extension detection and display)
        source_id:   UUID of the KnowledgeSource this file came from (stored in filepath)
        department:  Department this file belongs to
        metadata:    Optional extra metadata (e.g. email sender/subject)

    Returns:
        Number of chunks created (0 if ingestion failed).
    """
    from app.core.ingestion import ingest_document
    from app.db.postgres import AsyncSessionLocal
    from app.models.document import Document

    async with AsyncSessionLocal() as db:
        # Check for duplicate by filename + source to avoid re-ingesting unchanged files
        from sqlalchemy import select

        existing = await db.execute(
            select(Document).where(
                Document.filename == filename,
                Document.filepath == f"connector:{source_id}",
            )
        )
        doc = existing.scalar_one_or_none()

        if doc is None:
            # New file — create a Document record
            doc = Document(
                id=str(uuid.uuid4()),
                filename=filename,
                filepath=f"connector:{source_id}" if source_id else None,
                department=department or "",
                status="pending",
                created_at=datetime.utcnow(),
            )
            db.add(doc)
            await db.flush()

        # Run the full ingestion pipeline (hash-based dedup happens inside)
        await ingest_document(doc=doc, content=content, db=db)
        chunks_created = doc.chunks_count or 0
        logger.debug(
            "ingest_bytes: completed for %s (source=%s) — %d chunks",
            filename, source_id, chunks_created,
        )
        return chunks_created
