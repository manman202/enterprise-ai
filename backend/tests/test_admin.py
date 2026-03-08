from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.user import User

ADMIN = User(
    id="admin-1", username="admin", email="admin@example.com",
    hashed_password=hash_password("secret"), is_active=True, is_admin=True,
    created_at=datetime(2026, 1, 1),
)

REGULAR = User(
    id="user-1", username="alice", email="alice@example.com",
    hashed_password=hash_password("secret"), is_active=True, is_admin=False,
    created_at=datetime(2026, 1, 2),
)


def _admin_token() -> str:
    return create_access_token(ADMIN.id)


def _db_patch(users: list | None = None, get_user=REGULAR):
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = users or [ADMIN, REGULAR]
    session.execute = AsyncMock(return_value=result)
    session.get = AsyncMock(return_value=get_user)
    session.delete = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm), session


def _auth_patch(user=ADMIN):
    return patch("app.api.deps.get_current_user", return_value=user)


# ─── LIST ─────────────────────────────────────────────────────────────────────

async def test_list_users_returns_all(client: AsyncClient):
    db_patch, _ = _db_patch()
    with db_patch, _auth_patch():
        response = await client.get(
            "/api/v1/admin/users", headers={"Authorization": f"Bearer {_admin_token()}"}
        )
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_list_users_requires_admin(client: AsyncClient):
    db_patch, _ = _db_patch()
    with db_patch, _auth_patch(user=REGULAR):
        response = await client.get(
            "/api/v1/admin/users", headers={"Authorization": f"Bearer {create_access_token(REGULAR.id)}"}
        )
    assert response.status_code == 403


# ─── UPDATE ───────────────────────────────────────────────────────────────────

async def test_update_user_deactivates(client: AsyncClient):
    db_patch, _ = _db_patch()
    with db_patch, _auth_patch():
        response = await client.patch(
            f"/api/v1/admin/users/{REGULAR.id}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 200


async def test_update_user_not_found(client: AsyncClient):
    db_patch, session = _db_patch()
    session.get = AsyncMock(return_value=None)
    with db_patch, _auth_patch():
        response = await client.patch(
            "/api/v1/admin/users/missing",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 404


async def test_cannot_deactivate_self(client: AsyncClient):
    db_patch, session = _db_patch()
    session.get = AsyncMock(return_value=ADMIN)
    with db_patch, _auth_patch():
        response = await client.patch(
            f"/api/v1/admin/users/{ADMIN.id}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 400


async def test_cannot_remove_own_admin_role(client: AsyncClient):
    db_patch, session = _db_patch()
    session.get = AsyncMock(return_value=ADMIN)
    with db_patch, _auth_patch():
        response = await client.patch(
            f"/api/v1/admin/users/{ADMIN.id}",
            json={"is_admin": False},
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 400


# ─── DELETE ───────────────────────────────────────────────────────────────────

async def test_delete_user_succeeds(client: AsyncClient):
    db_patch, _ = _db_patch()
    with db_patch, _auth_patch():
        response = await client.delete(
            f"/api/v1/admin/users/{REGULAR.id}",
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 204


async def test_cannot_delete_self(client: AsyncClient):
    db_patch, _ = _db_patch()
    with db_patch, _auth_patch():
        response = await client.delete(
            f"/api/v1/admin/users/{ADMIN.id}",
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 400


async def test_delete_user_not_found(client: AsyncClient):
    db_patch, session = _db_patch()
    session.get = AsyncMock(return_value=None)
    with db_patch, _auth_patch():
        response = await client.delete(
            "/api/v1/admin/users/missing",
            headers={"Authorization": f"Bearer {_admin_token()}"},
        )
    assert response.status_code == 404
