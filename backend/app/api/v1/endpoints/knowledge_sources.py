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
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
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


@router.get("", response_model=List[KnowledgeSourceResponse])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """List all knowledge sources."""
    result = await db.execute(select(KnowledgeSource).order_by(KnowledgeSource.created_at.desc()))
    sources = result.scalars().all()
    return [_source_to_response(s) for s in sources]


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
