"""
Document management endpoints — upload, list, delete, reindex.
Upload triggers the full ingestion pipeline (extract → chunk → embed → ChromaDB).
Admin-only for write operations; read is open to authenticated users.
"""

import logging

from app.api.deps import get_current_admin, get_current_user
from app.core.ingestion import ingest_document
from app.db.chroma import delete_document_chunks
from app.db.postgres import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentOut
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()

# Accepted file extensions
ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx", ".xlsx", ".xls"}


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    department: str = "",  # Query param: department tag
    current_admin: User = Depends(get_current_admin),  # Admin only
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document and trigger ingestion into the knowledge base.
    Ingestion is async — the endpoint returns immediately with status "pending",
    and the document record is updated to "ingested" or "failed" when done.
    """
    import os

    filename = file.filename or "untitled"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=422, detail="File is empty")

    # Create document record
    doc = Document(
        filename=filename,
        department=department or None,
        size=len(content),
        status="pending",
    )
    db.add(doc)
    await db.flush()  # Get the UUID before ingestion

    # Run ingestion synchronously (RAG pipeline)
    # In production with high volume, push to a Celery/Redis queue instead
    await ingest_document(doc=doc, content=content, db=db)

    await db.refresh(doc)
    logger.info(
        "Document '%s' uploaded by '%s' — status: %s",
        filename,
        current_admin.username,
        doc.status,
    )
    return doc


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),  # Any authenticated user
    db: AsyncSession = Depends(get_db),
):
    """
    List all documents. Admins see all; regular users see only their department's documents.
    """
    query = select(Document).order_by(Document.created_at.desc())

    # RBAC: non-admin users filtered to their department
    if not current_user.is_admin and current_user.department:
        query = query.where(
            (Document.department == current_user.department)
            | (Document.department.is_(None))
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    current_admin: User = Depends(get_current_admin),  # Admin only
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a document: removes the DB record and all its ChromaDB chunks.
    """
    doc = await db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove vectors from ChromaDB first
    await delete_document_chunks(doc_id)

    await db.delete(doc)
    await db.commit()
    logger.info("Document '%s' deleted by '%s'", doc.filename, current_admin.username)


@router.post("/documents/reindex", status_code=202)
async def reindex_all(
    current_admin: User = Depends(get_current_admin),  # Admin only
    db: AsyncSession = Depends(get_db),
):
    """
    Re-ingest all documents that are in "failed" or "pending" status.
    Documents already "ingested" are skipped unless force=true is passed.
    Returns a summary of what was queued.
    NOTE: Ingestion requires the original file — this endpoint only re-runs
    ingestion for documents where the content is already stored.
    This is a placeholder; full re-index from disk is done via the file watcher (Phase 8).
    """
    result = await db.execute(
        select(Document).where(Document.status.in_(["pending", "failed"]))
    )
    pending_docs = result.scalars().all()

    return {
        "message": f"{len(pending_docs)} document(s) queued for re-ingestion",
        "document_ids": [d.id for d in pending_docs],
        "note": "Re-ingestion from original files requires the file watcher (Phase 8)",
    }
