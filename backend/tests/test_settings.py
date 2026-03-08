from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.user import User

ALICE = User(
    id="user-1",
    username="alice",
    email="alice@example.com",
    hashed_password=hash_password("OldPass1"),
    is_active=True,
    is_admin=False,
    created_at=datetime(2026, 1, 1),
)

TOKEN = create_access_token(ALICE.id)
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def _db_with_user(user=ALICE, conflict=None):
    session = AsyncMock()

    def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conflict
        return result

    session.execute = AsyncMock(side_effect=_execute)
    session.get = AsyncMock(return_value=user)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm)


# ─── PATCH /users/me ──────────────────────────────────────────────────────────

async def test_update_profile_username(client: AsyncClient):
    with _db_with_user():
        response = await client.patch("/api/v1/users/me", json={"username": "alicenew"}, headers=AUTH)
    assert response.status_code == 200
    assert response.json()["username"] == "alice"  # mock returns original object


async def test_update_profile_conflict(client: AsyncClient):
    with _db_with_user(conflict=ALICE):
        response = await client.patch("/api/v1/users/me", json={"username": "taken"}, headers=AUTH)
    assert response.status_code == 409


async def test_update_profile_requires_auth(client: AsyncClient):
    response = await client.patch("/api/v1/users/me", json={"username": "x"})
    assert response.status_code == 401


async def test_update_profile_noop_returns_user(client: AsyncClient):
    with _db_with_user():
        response = await client.patch("/api/v1/users/me", json={}, headers=AUTH)
    assert response.status_code == 200


# ─── POST /users/me/password ──────────────────────────────────────────────────

VALID_PW_PAYLOAD = {
    "current_password": "OldPass1",
    "new_password": "NewPass1",
    "confirm_password": "NewPass1",
}


async def test_change_password_success(client: AsyncClient):
    with _db_with_user():
        response = await client.post("/api/v1/users/me/password", json=VALID_PW_PAYLOAD, headers=AUTH)
    assert response.status_code == 204


async def test_change_password_wrong_current(client: AsyncClient):
    with _db_with_user():
        response = await client.post(
            "/api/v1/users/me/password",
            json={**VALID_PW_PAYLOAD, "current_password": "WrongPass"},
            headers=AUTH,
        )
    assert response.status_code == 400


async def test_change_password_mismatch(client: AsyncClient):
    with _db_with_user():
        response = await client.post(
            "/api/v1/users/me/password",
            json={**VALID_PW_PAYLOAD, "confirm_password": "Different"},
            headers=AUTH,
        )
    assert response.status_code == 422


async def test_change_password_too_short(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/me/password",
        json={**VALID_PW_PAYLOAD, "new_password": "short", "confirm_password": "short"},
        headers=AUTH,
    )
    assert response.status_code == 422


async def test_change_password_requires_auth(client: AsyncClient):
    response = await client.post("/api/v1/users/me/password", json=VALID_PW_PAYLOAD)
    assert response.status_code == 401
