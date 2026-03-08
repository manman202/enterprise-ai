"""
PostgreSQL async engine, session factory, Base class, and startup helpers.
Uses SQLAlchemy 2.x async API with asyncpg driver.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Engine & Session ───────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "development",  # Log SQL in dev only
    pool_pre_ping=True,  # Verify connections before use
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base — all ORM models inherit from this."""

    pass


# ── FastAPI dependency ─────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    """Yield an async database session; auto-close after request."""
    async with AsyncSessionLocal() as session:
        yield session


# ── Startup utility ────────────────────────────────────────────────────────────
async def create_all_tables() -> None:
    """
    Create all tables that don't exist yet.
    Called at application startup — idempotent (safe to call repeatedly).
    NOTE: In production, prefer Alembic migrations over this.
    """
    import app.models  # noqa: F401 — ensures all models are registered on Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
