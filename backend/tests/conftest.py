"""
Shared pytest fixtures for the Aiyedun backend test suite (Phase 9).

Provides:
- client: AsyncClient backed by the FastAPI app
- db helpers via mock patches (no real PostgreSQL needed)
- regular_user / admin_user objects + their JWT tokens
- mock_chroma / mock_ollama / mock_embeddings fixtures
"""

import pytest
import pytest_asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.core.security import create_access_token
from app.models.user import User


# ── Shared test user objects ────────────────────────────────────────────────────
# Passwords are hashed lazily (inside fixtures) to avoid bcrypt errors at import time.

def _make_user(
    user_id: str,
    username: str,
    email: str,
    is_admin: bool = False,
    is_active: bool = True,
    department: str | None = "RH",
    hashed_password: str = "$2b$12$placeholder_hash_not_used_for_login",
) -> User:
    """Build a User ORM object without hitting the database."""
    return User(
        id=user_id,
        username=username,
        email=email,
        full_name=f"{username.capitalize()} Test",
        department=department,
        hashed_password=hashed_password,
        is_active=is_active,
        is_admin=is_admin,
        created_at=datetime(2026, 1, 1),
    )


REGULAR_USER = _make_user("user-uuid-1", "testuser", "testuser@aiyedun.test")
ADMIN_USER = _make_user(
    "admin-uuid-1", "adminuser", "admin@aiyedun.test", is_admin=True, department="IT"
)
INACTIVE_USER = _make_user(
    "user-uuid-2", "inactive", "inactive@aiyedun.test", is_active=False
)


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def regular_user() -> User:
    """Return a regular (non-admin) test user object."""
    return REGULAR_USER


@pytest.fixture
def admin_user() -> User:
    """Return an admin test user object."""
    return ADMIN_USER


@pytest.fixture
def inactive_user() -> User:
    """Return an inactive (disabled) test user object."""
    return INACTIVE_USER


@pytest.fixture
def user_token(regular_user: User) -> str:
    """JWT token for the regular test user."""
    return create_access_token(regular_user.id)


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """JWT token for the admin test user."""
    return create_access_token(admin_user.id)


@pytest.fixture
def mock_chroma():
    """Mock ChromaDB query_documents — returns an empty list by default."""
    with patch("app.db.chroma.query_documents", new_callable=AsyncMock) as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_ollama():
    """Mock Ollama generate — returns a canned answer."""
    with patch("app.db.ollama.generate", new_callable=AsyncMock) as mock:
        mock.return_value = "This is a mocked AI response."
        yield mock


@pytest.fixture
def mock_embeddings():
    """Mock sentence-transformers embed_text — returns a 384-dim zero vector."""
    with patch("app.core.embeddings.embed_text") as mock:
        mock.return_value = [0.0] * 384
        yield mock


def _make_db_mock(user: User | None = REGULAR_USER) -> MagicMock:
    """
    Build an AsyncMock database session that returns *user* for any
    scalar query or db.get() call.
    """
    session = AsyncMock()

    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    result.scalars.return_value.all.return_value = []

    session.execute = AsyncMock(return_value=result)
    session.get = AsyncMock(return_value=user)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()

    return session


def _patch_db(user: User | None = REGULAR_USER):
    """
    Context-manager patch that wires the FastAPI app's get_db dependency to
    a fresh mock session returning *user*.
    """
    session = _make_db_mock(user)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)

    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm), session


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """AsyncClient backed by the FastAPI app (no real services required)."""
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
