"""
Authentication endpoint tests (Phase 9).

Covers:
  POST /api/v1/auth/login  — success, wrong password, unknown user, inactive account
  GET  /api/v1/auth/me     — authenticated, unauthenticated, invalid token
  POST /api/v1/auth/logout — always succeeds
  POST /api/v1/auth/register — happy path, duplicate, bad payload

Note: passlib's bcrypt backend raises ValueError("password cannot be longer than
72 bytes") during its detect_wrap_bug self-test in this environment. We work around
this by patching verify_password and hash_password at the endpoint layer.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.models.user import User

# Placeholder hash — we mock verify_password so this value is not actually checked
_PLACEHOLDER_HASH = "$2b$12$placeholder"

ACTIVE_USER = User(
    id="user-1",
    username="alice",
    email="alice@example.com",
    hashed_password=_PLACEHOLDER_HASH,
    is_active=True,
    is_admin=False,
    created_at=datetime(2026, 1, 1),
)

INACTIVE_USER = User(
    id="user-2",
    username="bob",
    email="bob@example.com",
    hashed_password=_PLACEHOLDER_HASH,
    is_active=False,
    is_admin=False,
    created_at=datetime(2026, 1, 1),
)


def _db_patch(user=ACTIVE_USER):
    """Patch the DB session so that scalar queries return *user*."""
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    session.execute = AsyncMock(return_value=result)
    session.get = AsyncMock(return_value=user)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm)


# ─── LOGIN ────────────────────────────────────────────────────────────────────


async def test_login_success(client: AsyncClient):
    """Correct credentials → 200 with a bearer token."""
    with (
        _db_patch(),
        patch("app.api.v1.endpoints.auth.verify_password", return_value=True),
    ):
        response = await client.post(
            "/api/v1/auth/login", json={"username": "alice", "password": "secret"}
        )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    """Wrong password → 401."""
    with (
        _db_patch(),
        patch("app.api.v1.endpoints.auth.verify_password", return_value=False),
    ):
        response = await client.post(
            "/api/v1/auth/login", json={"username": "alice", "password": "wrong"}
        )

    assert response.status_code == 401


async def test_login_unknown_user(client: AsyncClient):
    """Unknown username → 401 (user not found in DB)."""
    with _db_patch(user=None):
        response = await client.post(
            "/api/v1/auth/login", json={"username": "ghost", "password": "x"}
        )

    assert response.status_code == 401


async def test_login_inactive_user(client: AsyncClient):
    """Disabled account → 403 (authenticated but forbidden)."""
    with (
        _db_patch(user=INACTIVE_USER),
        patch("app.api.v1.endpoints.auth.verify_password", return_value=True),
    ):
        response = await client.post(
            "/api/v1/auth/login", json={"username": "bob", "password": "secret"}
        )

    assert response.status_code == 403


# ─── ME ───────────────────────────────────────────────────────────────────────


async def test_get_me_authenticated(client: AsyncClient):
    """Valid token → 200 with user data (no hashed_password exposed)."""
    token = create_access_token(ACTIVE_USER.id)
    with _db_patch():
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["id"] == "user-1"
    assert "hashed_password" not in body


async def test_get_me_no_token(client: AsyncClient):
    """No Authorization header → 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_get_me_invalid_token(client: AsyncClient):
    """Garbage token → 401."""
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"}
    )
    assert response.status_code == 401


# ─── LOGOUT ───────────────────────────────────────────────────────────────────


async def test_logout(client: AsyncClient):
    """POST /logout always succeeds (stateless JWT)."""
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert "message" in response.json()


# ─── REGISTER ─────────────────────────────────────────────────────────────────

REGISTER_PAYLOAD = {
    "username": "charlie",
    "email": "charlie@example.com",
    "password": "Password1",
    "confirm_password": "Password1",
}


async def test_register_creates_user(client: AsyncClient):
    """Valid registration payload → 201."""
    from app.models.user import User as _User

    new_user = _User(
        id="new-user-id",
        username="charlie",
        email="charlie@example.com",
        hashed_password=_PLACEHOLDER_HASH,
        is_active=True,
        is_admin=False,
    )

    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None   # no duplicate

    captured_user: list = []

    def _capture_add(obj):
        if isinstance(obj, _User):
            # Simulate what DB would set after insert
            obj.id = new_user.id
            obj.is_active = True
            obj.is_admin = False
            captured_user.append(obj)

    session.execute = AsyncMock(return_value=result)
    session.add = _capture_add
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("app.db.postgres.AsyncSessionLocal", return_value=cm),
        patch("app.api.v1.endpoints.auth.hash_password", return_value=_PLACEHOLDER_HASH),
    ):
        response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    assert len(captured_user) == 1
    session.commit.assert_awaited_once()


async def test_register_conflict_on_duplicate(client: AsyncClient):
    """Username / email already taken → 409."""
    with _db_patch(user=ACTIVE_USER):
        response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 409


async def test_register_rejects_short_password(client: AsyncClient):
    """Password under 8 characters → 422."""
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "password": "short", "confirm_password": "short"},
    )
    assert response.status_code == 422


async def test_register_rejects_mismatched_passwords(client: AsyncClient):
    """Passwords don't match → 422."""
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "confirm_password": "Different1"},
    )
    assert response.status_code == 422


async def test_register_rejects_short_username(client: AsyncClient):
    """Username under 3 chars → 422."""
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "username": "ab"},
    )
    assert response.status_code == 422


async def test_register_rejects_invalid_email(client: AsyncClient):
    """Invalid email format → 422."""
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "email": "notanemail"},
    )
    assert response.status_code == 422
