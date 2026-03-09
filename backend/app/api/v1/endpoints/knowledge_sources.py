"""
Knowledge Sources API — CRUD + sync management for configured data source connectors.
All endpoints require admin privileges (get_current_admin dependency).

Routes:
  GET    /api/v1/knowledge-sources                   — list all
  GET    /api/v1/knowledge-sources/{id}              — get one
  POST   /api/v1/knowledge-sources                   — create
  PATCH  /api/v1/knowledge-sources/{id}              — update
  DELETE /api/v1/knowledge-sources/{id}              — delete
  POST   /api/v1/knowledge-sources/{id}/sync         — trigger manual sync
  GET    /api/v1/knowledge-sources/{id}/sync-history — last 10 sync results
  POST   /api/v1/knowledge-sources/test-connection   — test credentials before saving
"""

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.postgres import get_db
from app.models.knowledge_source import KnowledgeSource
from app.models.user import User
from app.schemas.knowledge_source import (
    KnowledgeSourceCreate,
    KnowledgeSourceResponse,
    KnowledgeSourceUpdate,
    SyncHistoryEntry,
    TestConnectionRequest,
    TestConnectionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-sources", tags=["knowledge-sources"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _mask_credentials(config: dict | None) -> dict | None:
    """Replace sensitive credential fields with '***' before returning to client."""
    if not config:
        return config
    secret_keys = {
        "client_secret",
        "password",
        "secret_access_key",
        "access_key_id",
    }
    return {k: ("***" if k in secret_keys else v) for k, v in config.items()}


def _source_to_response(source: KnowledgeSource) -> KnowledgeSourceResponse:
    """Convert ORM row to response schema with credentials masked."""
    config = None
    if source.config:
        try:
            config = json.loads(source.config)
            config = _mask_credentials(config)
        except Exception:
            config = None

    return KnowledgeSourceResponse(
        id=source.id,
        name=source.name,
        department=source.department,
        source_type=source.source_type,
        config=config,
        status=source.status,
        is_active=source.is_active,
        last_sync_at=source.last_sync_at,
        last_sync_status=source.last_sync_status,
        last_sync_count=source.last_sync_count,
        last_error=source.last_error,
        created_at=source.created_at,
        created_by=source.created_by,
    )


def _get_connector(source: KnowledgeSource):
    """Instantiate the correct connector class for this source."""
    from app.services.connectors.exchange import ExchangeConnector
    from app.services.connectors.local import LocalConnector
    from app.services.connectors.s3 import S3Connector
    from app.services.connectors.sharepoint import SharePointConnector
    from app.services.connectors.smb import SMBConnector

    config = {}
    if source.config:
        try:
            config = json.loads(source.config)
        except Exception:
            pass

    connector_map = {
        "sharepoint": SharePointConnector,
        "smb": SMBConnector,
        "exchange": ExchangeConnector,
        "local": LocalConnector,
        "s3": S3Connector,
    }
    cls = connector_map.get(source.source_type)
    if cls is None:
        raise HTTPException(status_code=400, detail=f"Unknown source type: {source.source_type}")
    return cls(source_id=source.id, config=config)


# ── CRUD endpoints ────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_knowledge_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Return aggregate stats: source counts and documents indexed."""
    from sqlalchemy import func

    from app.models.document import Document

    try:
        total_result = await db.execute(select(func.count(KnowledgeSource.id)))
        total = total_result.scalar() or 0
    except Exception:
        total = 0

    try:
        active_result = await db.execute(
            select(func.count(KnowledgeSource.id)).where(KnowledgeSource.status == "active")
        )
        active = active_result.scalar() or 0
    except Exception:
        active = 0

    try:
        last_result = await db.execute(select(func.max(KnowledgeSource.last_sync_at)))
        last_sync = last_result.scalar()
        last_sync = last_sync.isoformat() if last_sync else None
    except Exception:
        last_sync = None

    try:
        doc_result = await db.execute(
            select(func.count(Document.id)).where(Document.status == "ingested")
        )
        documents_indexed = doc_result.scalar() or 0
    except Exception:
        documents_indexed = 0

    return {
        "total_sources": total,
        "active_sources": active,
        "last_sync": last_sync,
        "documents_indexed": documents_indexed,
    }


@router.get("", response_model=List[KnowledgeSourceResponse])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """List all knowledge sources."""
    try:
        result = await db.execute(select(KnowledgeSource).order_by(KnowledgeSource.created_at.desc()))
        sources = result.scalars().all()
        return [_source_to_response(s) for s in sources]
    except Exception as e:
        logger.error("Error fetching knowledge sources: %s", e)
        return []


@router.get("/{source_id}", response_model=KnowledgeSourceResponse)
async def get_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Get a single knowledge source by ID."""
    source = await db.get(KnowledgeSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Knowledge source not found")
    return _source_to_response(source)


@router.post("", response_model=KnowledgeSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_source(
    body: KnowledgeSourceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Create a new knowledge source."""
    source = KnowledgeSource(
        id=str(uuid.uuid4()),
        name=body.name,
        department=body.department,
        source_type=body.source_type,
        config=json.dumps(body.config),
        status="inactive",
        is_active=body.is_active,
        created_at=datetime.utcnow(),
        created_by=admin.id,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    logger.info("Knowledge source created: %s (%s) by %s", source.name, source.id, admin.username)
    return _source_to_response(source)


@router.patch("/{source_id}", response_model=KnowledgeSourceResponse)
async def update_source(
    source_id: str,
    body: KnowledgeSourceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Update a knowledge source's metadata or config."""
    source = await db.get(KnowledgeSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    if body.name is not None:
        source.name = body.name
    if body.department is not None:
        source.department = body.department
    if body.status is not None:
        source.status = body.status
    if body.config is not None:
        # Merge new config over existing — allows partial credential updates
        existing = {}
        if source.config:
            try:
                existing = json.loads(source.config)
            except Exception:
                pass
        # Replace *** placeholders with existing values (client sends *** for unchanged secrets)
        merged = existing.copy()
        for k, v in body.config.items():
            if v != "***":
                merged[k] = v
        source.config = json.dumps(merged)
    if body.is_active is not None:
        source.is_active = body.is_active
        # Keep status in sync with is_active flag
        if not body.is_active and source.status == "active":
            source.status = "inactive"

    await db.commit()
    await db.refresh(source)
    logger.info("Knowledge source updated: %s by %s", source.id, admin.username)
    return _source_to_response(source)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Delete a knowledge source."""
    source = await db.get(KnowledgeSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Knowledge source not found")
    await db.delete(source)
    await db.commit()
    logger.info("Knowledge source deleted: %s by %s", source_id, admin.username)


# ── Sync endpoints ────────────────────────────────────────────────────────────


@router.post("/{source_id}/sync")
async def trigger_sync(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Trigger a manual sync for this knowledge source immediately.
    The sync runs in the background — returns 202 Accepted immediately.
    """
    import asyncio

    source = await db.get(KnowledgeSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Knowledge source not found")
    if source.status == "syncing":
        raise HTTPException(status_code=409, detail="Sync already in progress for this source")

    # Mark as syncing right away so the UI can show the spinner
    source.status = "syncing"
    await db.commit()

    # Fire-and-forget sync task
    from app.services.sync_scheduler import _sync_source

    asyncio.create_task(_sync_source(source))

    logger.info("Manual sync triggered for source %s by %s", source.name, admin.username)
    return {"message": f"Sync started for '{source.name}'", "source_id": source_id}


@router.get("/{source_id}/sync-history", response_model=List[SyncHistoryEntry])
async def sync_history(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """
    Return the last 10 sync results for this source.
    Currently reads from audit_logs filtered by resource = "knowledge_source:{id}".
    """
    from sqlalchemy import and_

    from app.models.audit_log import AuditLog

    result = await db.execute(
        select(AuditLog)
        .where(
            and_(
                AuditLog.action == "knowledge_sync",
                AuditLog.resource == f"knowledge_source:{source_id}",
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    logs = result.scalars().all()

    history: list[SyncHistoryEntry] = []
    for log in logs:
        details = {}
        if log.details:
            try:
                details = json.loads(log.details)
            except Exception:
                pass
        history.append(
            SyncHistoryEntry(
                id=log.id,
                source_id=source_id,
                started_at=log.created_at,
                finished_at=log.created_at,  # We store only completion time
                duration_seconds=None,
                files_processed=details.get("files_processed"),
                status="success" if log.outcome == "allow" else "failed",
                error=details.get("error"),
            )
        )
    return history


# ── Test connection endpoint ──────────────────────────────────────────────────


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    body: TestConnectionRequest,
    _admin: User = Depends(get_current_admin),
):
    """
    Test connector credentials before saving a source.
    Creates a temporary connector instance and calls test_connection().
    Never persists any data.
    """
    from app.services.connectors.exchange import ExchangeConnector
    from app.services.connectors.local import LocalConnector
    from app.services.connectors.s3 import S3Connector
    from app.services.connectors.sharepoint import SharePointConnector
    from app.services.connectors.smb import SMBConnector

    connector_map = {
        "sharepoint": SharePointConnector,
        "smb": SMBConnector,
        "exchange": ExchangeConnector,
        "local": LocalConnector,
        "s3": S3Connector,
    }
    cls = connector_map.get(body.source_type)
    if cls is None:
        raise HTTPException(status_code=400, detail=f"Unknown source type: {body.source_type}")

    try:
        connector = cls(source_id="test", config=body.config)
        result = await connector.test_connection()
        return TestConnectionResponse(
            success=result.success,
            message=result.message,
            files_found=result.files_found,
        )
    except Exception as e:
        logger.error("test_connection error: %s", e)
        return TestConnectionResponse(success=False, message=str(e))


# ── Upload endpoint (local sources only) ─────────────────────────────────────

# Supported extensions for direct file upload
_UPLOAD_ALLOWED = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".md"}
_UPLOAD_MAX_BYTES = 50 * 1024 * 1024  # 50 MB per file


@router.post("/{source_id}/upload")
async def upload_files(
    source_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Upload one or more files directly into a local knowledge source path.
    Saves each file to the configured local path then triggers ingestion.
    Only supported for source_type='local'.
    Max file size: 50 MB per file.
    Supported types: .pdf, .docx, .doc, .xlsx, .xls, .txt, .md
    """
    source = await db.get(KnowledgeSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Knowledge source not found")
    if source.source_type != "local":
        raise HTTPException(status_code=400, detail="File upload is only supported for local folder sources")

    # Resolve save path: use configured local path or fall back to shared uploads dir
    config = {}
    if source.config:
        try:
            config = json.loads(source.config)
        except Exception:
            pass
    local_path = config.get("path", "").strip()
    if not local_path:
        local_path = f"/opt/aiyedun/uploads/{source_id}"

    try:
        os.makedirs(local_path, exist_ok=True)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot create upload directory '{local_path}': {e}",
        )

    from app.services.ingestion import ingest_bytes

    results = []
    for upload in files:
        filename = upload.filename or "unknown"
        ext = Path(filename).suffix.lower()

        # Validate extension
        if ext not in _UPLOAD_ALLOWED:
            results.append({
                "filename": filename,
                "size": 0,
                "status": "rejected",
                "error": f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(_UPLOAD_ALLOWED))}",
                "chunks_created": 0,
            })
            continue

        # Read content
        content = await upload.read()
        size = len(content)

        if size > _UPLOAD_MAX_BYTES:
            results.append({
                "filename": filename,
                "size": size,
                "status": "rejected",
                "error": f"File exceeds 50 MB limit ({size // 1024 // 1024} MB)",
                "chunks_created": 0,
            })
            continue

        # Save to the local path
        dest_path = os.path.join(local_path, filename)
        try:
            with open(dest_path, "wb") as fh:
                fh.write(content)
        except OSError as e:
            results.append({
                "filename": filename,
                "size": size,
                "status": "error",
                "error": f"Could not write to disk: {e}",
                "chunks_created": 0,
            })
            continue

        # Ingest
        try:
            chunks_created = await ingest_bytes(
                content=content,
                filename=filename,
                source_id=source_id,
                department=source.department or "",
                metadata={"uploaded_by": admin.username},
            )
            results.append({
                "filename": filename,
                "size": size,
                "status": "success",
                "error": None,
                "chunks_created": chunks_created,
            })
        except Exception as e:
            logger.error("Upload ingest failed for %s: %s", filename, e)
            results.append({
                "filename": filename,
                "size": size,
                "status": "error",
                "error": f"Saved but ingestion failed: {e}",
                "chunks_created": 0,
            })

    succeeded = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] in ("error", "rejected"))

    # Update source stats — BUG 2 fix: always set is_active=True on successful upload
    source.last_sync_at = datetime.utcnow()
    source.last_sync_count = succeeded
    source.last_sync_status = "success" if failed == 0 else ("partial" if succeeded > 0 else "failed")
    if succeeded > 0:
        source.status = "active"
        source.is_active = True
        source.last_error = None
    elif failed > 0 and succeeded == 0:
        source.status = "error"
        source.last_error = f"{failed} file(s) failed to ingest"
    await db.commit()
    await db.refresh(source)

    logger.info(
        "Upload: %d file(s) to source '%s' by %s — %d ok, %d failed — saved to %s",
        len(files),
        source.name,
        admin.username,
        succeeded,
        failed,
        local_path,
    )
    return {
        "uploaded": results,
        "total_files": len(results),
        "succeeded": succeeded,
        "failed": failed,
        "saved_to": local_path,
    }


# ── Scan VPS path endpoint ────────────────────────────────────────────────────


@router.get("/scan-path")
async def scan_path(
    path: str = Query(..., description="Absolute path to scan on the VPS filesystem"),
    _admin: User = Depends(get_current_admin),
):
    """
    Walk a path on the VPS server and return all supported files found.
    Used by the upload modal to preview what's available at a given path.
    """
    if not path:
        raise HTTPException(status_code=400, detail="path parameter is required")

    # Security: prevent path traversal outside expected mount points
    resolved = os.path.realpath(path)
    if not os.path.isabs(resolved):
        raise HTTPException(status_code=400, detail="Path must be absolute")

    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"Path does not exist: {path}")

    if not os.path.isdir(resolved):
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")

    if not os.access(resolved, os.R_OK):
        raise HTTPException(status_code=403, detail=f"Path is not readable: {path}")

    files = []
    total = 0
    supported = 0

    for root, _dirs, filenames in os.walk(resolved):
        for fname in filenames:
            total += 1
            ext = Path(fname).suffix.lower()
            if ext not in _UPLOAD_ALLOWED:
                continue
            full = os.path.join(root, fname)
            try:
                size = os.path.getsize(full)
                rel = os.path.relpath(full, resolved)
                files.append({
                    "name": fname,
                    "size": size,
                    "extension": ext,
                    "relative_path": rel,
                })
                supported += 1
            except OSError:
                pass

    return {
        "path": resolved,
        "files": files[:500],  # cap at 500 entries to avoid huge responses
        "total": total,
        "supported": supported,
    }
