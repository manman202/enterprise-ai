"""
Sync scheduler — background asyncio task that runs every 15 minutes.
Fetches all active KnowledgeSources from the database and triggers a sync
via the appropriate connector. Updates sync metadata and audit log on completion.
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

logger = logging.getLogger(__name__)

SYNC_INTERVAL_SECONDS = 15 * 60  # 15 minutes


def _get_connector(source):
    """Instantiate the correct connector for the given KnowledgeSource row."""
    import json

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
        raise ValueError(f"Unknown source_type: {source.source_type}")
    return cls(source_id=source.id, config=config)


async def _sync_source(source) -> None:
    """Run a full sync for one KnowledgeSource and update its metadata in the DB."""
    from app.db.postgres import AsyncSessionLocal
    from app.models.knowledge_source import KnowledgeSource

    logger.info("Sync scheduler: starting sync for source '%s' (%s)", source.name, source.id)

    async with AsyncSessionLocal() as db:
        # Mark as syncing
        row = await db.get(KnowledgeSource, source.id)
        if row is None:
            return
        row.status = "syncing"
        await db.commit()

    try:
        connector = _get_connector(source)
        result = await connector.sync()
    except Exception as e:
        logger.error("Sync scheduler: connector error for '%s': %s", source.name, e)
        result = None
        error_msg = str(e)
    else:
        error_msg = result.error if result and not result.success else None

    # Write results back to DB
    async with AsyncSessionLocal() as db:
        row = await db.get(KnowledgeSource, source.id)
        if row is None:
            return

        row.last_sync_at = datetime.utcnow()
        if result is not None:
            row.last_sync_status = "success" if result.success else "failed"
            row.last_sync_count = result.files_processed
            row.last_error = error_msg
            row.status = "active" if result.success else "error"
        else:
            row.last_sync_status = "failed"
            row.last_error = error_msg
            row.status = "error"

        await db.commit()

    # Write audit log entry
    try:
        from app.db.postgres import AsyncSessionLocal as ASLS
        from app.models.audit_log import AuditLog

        import json as _json

        async with ASLS() as db:
            entry = AuditLog(
                action="knowledge_sync",
                resource=f"knowledge_source:{source.id}",
                outcome="allow" if (result and result.success) else "deny",
                details=_json.dumps(
                    {
                        "source_name": source.name,
                        "source_type": source.source_type,
                        "files_processed": result.files_processed if result else 0,
                        "error": error_msg,
                    }
                ),
                ip_address="scheduler",
            )
            db.add(entry)
            await db.commit()
    except Exception as e:
        logger.warning("Sync scheduler: could not write audit log: %s", e)

    status = "succeeded" if (result and result.success) else "failed"
    logger.info(
        "Sync scheduler: sync %s for '%s' — %d files processed",
        status,
        source.name,
        result.files_processed if result else 0,
    )


async def _scheduler_loop() -> None:
    """Main loop — waits SYNC_INTERVAL_SECONDS then syncs all active sources."""
    from app.db.postgres import AsyncSessionLocal
    from app.models.knowledge_source import KnowledgeSource

    logger.info("Sync scheduler: started (interval=%ds)", SYNC_INTERVAL_SECONDS)

    while True:
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

        logger.info("Sync scheduler: running scheduled sync pass")
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(KnowledgeSource).where(
                        KnowledgeSource.is_active == True,  # noqa: E712
                        KnowledgeSource.status != "syncing",
                    )
                )
                sources = result.scalars().all()

            if not sources:
                logger.info("Sync scheduler: no active sources to sync")
                continue

            logger.info("Sync scheduler: syncing %d source(s)", len(sources))
            # Run all source syncs concurrently
            await asyncio.gather(*[_sync_source(s) for s in sources], return_exceptions=True)

        except Exception as e:
            logger.error("Sync scheduler: loop error: %s", e, exc_info=True)


async def start_sync_scheduler() -> None:
    """
    Start the sync scheduler as a background asyncio task.
    Called from main.py on_startup.
    """
    asyncio.create_task(_scheduler_loop())
    logger.info("Sync scheduler: background task created")
