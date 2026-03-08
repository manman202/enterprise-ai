"""
Aiyedun FastAPI application entry point.

Startup sequence:
  1. CORS middleware configured from allowed_origins setting
  2. Database tables created (dev mode; production uses Alembic)
  3. Embedding model preloaded (warms up sentence-transformers)
  4. All v1 API routes mounted under /api/v1
  5. WebSocket route mounted at /ws/chat/{conversation_id}
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.chat import websocket_chat
from app.api.v1.router import router
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ───────────────────────────────────────────────────────────────────


async def on_startup() -> None:
    """Run on every application startup."""
    logger.info("Aiyedun starting in '%s' mode", settings.app_env)

    # Ensure DB tables exist (safe to run on every start — idempotent)
    from app.db.postgres import create_all_tables

    await create_all_tables()
    logger.info("Database tables verified")

    # Preload the embedding model so the first query is not slow
    try:
        from app.core.embeddings import preload

        preload()
    except Exception as exc:
        logger.warning("Embedding model preload failed (non-fatal): %s", exc)

    # Start file watcher (monitors WATCHED_PATHS for new/modified documents)
    try:
        from app.services.file_watcher import start_file_watcher

        await start_file_watcher()
    except Exception as exc:
        logger.warning("File watcher startup failed (non-fatal): %s", exc)

    # Start knowledge source sync scheduler (runs every 15 minutes)
    try:
        from app.services.sync_scheduler import start_sync_scheduler

        await start_sync_scheduler()
    except Exception as exc:
        logger.warning("Sync scheduler startup failed (non-fatal): %s", exc)

    logger.info("Aiyedun startup complete")


# ── App factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Aiyedun Enterprise AI",
    description=(
        "Self-hosted, offline-first AI knowledge platform. "
        "LAN-only · Active Directory governed · Zero internet dependency."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    on_startup=[on_startup],
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST API routes ────────────────────────────────────────────────────────────
app.include_router(router)

# ── WebSocket route ────────────────────────────────────────────────────────────
# Registered at app level (not on APIRouter) so FastAPI can upgrade the connection.
app.add_api_websocket_route(
    "/ws/chat/{conversation_id}",
    websocket_chat,
)
