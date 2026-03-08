from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.user import User

ACTIVE_USER = User(
    id="user-1",
    username="alice",
    email="alice@example.com",
    hashed_password=hash_password("secret"),
    is_active=True,
    created_at=datetime(2026, 1, 1),
)

INACTIVE_USER = User(
    id="user-2",
    username="bob",
    email="bob@example.com",
    hashed_password=hash_password("secret"),
    is_active=False,
    created_at=datetime(2026, 1, 1),
)


def _db_patch(user=ACTIVE_USER):
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    session.execute = AsyncMock(return_value=result)
    session.get = AsyncMock(return_value=user)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm)


# ─── LOGIN ────────────────────────────────────────────────────────────────────

async def test_login_returns_token(client: AsyncClient):
    with _db_patch():
        response = await client.post("/api/v1/auth/login", json={"username": "alice", "password": "secret"})

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    with _db_patch():
        response = await client.post("/api/v1/auth/login", json={"username": "alice", "password": "wrong"})

    assert response.status_code == 401


async def test_login_unknown_user(client: AsyncClient):
    with _db_patch(user=None):
        response = await client.post("/api/v1/auth/login", json={"username": "ghost", "password": "x"})

    assert response.status_code == 401


async def test_login_inactive_user(client: AsyncClient):
    with _db_patch(user=INACTIVE_USER):
        response = await client.post("/api/v1/auth/login", json={"username": "bob", "password": "secret"})

    assert response.status_code == 403


# ─── REGISTER ─────────────────────────────────────────────────────────────────

REGISTER_PAYLOAD = {
    "username": "charlie",
    "email": "charlie@example.com",
    "password": "Password1",
    "confirm_password": "Password1",
}


async def test_register_creates_user(client: AsyncClient):
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.db.postgres.AsyncSessionLocal", return_value=cm):
        response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    session.add.assert_called_once()
    session.commit.assert_awaited_once()


async def test_register_conflict_on_duplicate(client: AsyncClient):
    with _db_patch(user=ACTIVE_USER):
        response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 409


async def test_register_rejects_short_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "password": "short", "confirm_password": "short"},
    )
    assert response.status_code == 422


async def test_register_rejects_mismatched_passwords(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "confirm_password": "Different1"},
    )
    assert response.status_code == 422


async def test_register_rejects_short_username(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "username": "ab"},
    )
    assert response.status_code == 422


async def test_register_rejects_invalid_email(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "email": "notanemail"},
    )
    assert response.status_code == 422


# ─── ME ───────────────────────────────────────────────────────────────────────

async def test_me_returns_current_user(client: AsyncClient):
    token = create_access_token(ACTIVE_USER.id)
    with _db_patch():
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["id"] == "user-1"
    assert "hashed_password" not in body


async def test_me_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_me_rejects_invalid_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer notavalidtoken"})
    assert response.status_code == 401
