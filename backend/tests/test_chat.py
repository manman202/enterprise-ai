"""
Chat endpoint tests (Phase 9).

Covers:
  POST   /api/v1/chat/message                    — success, no-auth
  GET    /api/v1/chat/conversations              — empty list, after message
  GET    /api/v1/chat/history/{id}               — messages returned, 404
  DELETE /api/v1/chat/conversations/{id}         — deleted, then 404

Strategy: use app.dependency_overrides to inject a mock DB session for
each test, avoiding the complex passlib/bcrypt issues that affect login-path
tests. get_current_user also uses get_db so we override it at the dep level.
"""

import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.core.security import create_access_token
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

# ── Shared test data ───────────────────────────────────────────────────────────

_USER_ID = "chat-user-uuid"
_CONV_ID = "chat-conv-uuid"

# Pre-computed bcrypt hash — not actually verified in chat tests
_PLACEHOLDER_HASH = "$2b$12$D38/Hx2pbYtP1jQMv9gdZ.9p4846Kg0nGGY53cTz4AZukyVzxciRy"

CHAT_USER = User(
    id=_USER_ID,
    username="chatuser",
    email="chatuser@aiyedun.test",
    hashed_password=_PLACEHOLDER_HASH,
    is_active=True,
    is_admin=False,
    department="RH",
    created_at=datetime(2026, 1, 1),
)

TOKEN = create_access_token(_USER_ID)
AUTH_HEADERS = {"Authorization": f"Bearer {TOKEN}"}

SAMPLE_CONVERSATION = Conversation(
    id=_CONV_ID,
    user_id=_USER_ID,
    title="Hello world",
    message_count=2,
    created_at=datetime(2026, 3, 1),
    updated_at=datetime(2026, 3, 1),
)

SAMPLE_USER_MSG = Message(
    id="msg-uuid-1",
    conversation_id=_CONV_ID,
    role="user",
    content="Hello",
    created_at=datetime(2026, 3, 1),
)

SAMPLE_ASSISTANT_MSG = Message(
    id="msg-uuid-2",
    conversation_id=_CONV_ID,
    role="assistant",
    content="This is a mocked AI response.",
    sources=None,
    created_at=datetime(2026, 3, 1),
)


# ── Dependency override helpers ───────────────────────────────────────────────

def _make_client_with_db(mock_db_session):
    """
    Return a context manager that yields an AsyncClient with get_db overridden
    to inject *mock_db_session*.
    """
    from app.main import app
    from app.db.postgres import get_db

    async def _override_get_db():
        yield mock_db_session

    @asynccontextmanager
    async def _ctx():
        app.dependency_overrides[get_db] = _override_get_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                yield ac
        finally:
            app.dependency_overrides.clear()

    return _ctx()


def _make_session(
    *,
    get_returns=None,
    execute_scalars=None,
) -> AsyncMock:
    """
    Build a mock AsyncSession.

    get_returns: value returned by session.get() for ANY key — set to
                 a dict {type: value} for type-specific dispatch, or a
                 single value returned for every call.
    execute_scalars: list returned by result.scalars().all()
    """
    session = AsyncMock()

    # db.get() — return different objects depending on the call order
    if isinstance(get_returns, dict):
        call_count = {"n": 0}
        values = list(get_returns.values())

        async def _get(model, pk):
            idx = min(call_count["n"], len(values) - 1)
            call_count["n"] += 1
            return values[idx]

        session.get = _get
    else:
        session.get = AsyncMock(return_value=get_returns)

    scalars = MagicMock()
    scalars.all.return_value = execute_scalars or []
    result = MagicMock()
    result.scalars.return_value = scalars
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    return session


# ── POST /api/v1/chat/message ──────────────────────────────────────────────────


async def test_send_message():
    """Send a chat message → 200 + response text + conversation_id."""
    new_conv = Conversation(
        id=_CONV_ID,
        user_id=_USER_ID,
        title="What is the vacation policy?",
        message_count=0,
        created_at=datetime(2026, 3, 1),
        updated_at=datetime(2026, 3, 1),
    )

    call_count = {"n": 0}

    async def _get(model, pk):
        # First call: get_current_user fetches the User by token user_id
        # Subsequent call: get conversation (None → auto-create)
        n = call_count["n"]
        call_count["n"] += 1
        if n == 0:
            return CHAT_USER
        return None  # No existing conversation → will be created

    session = _make_session()
    session.get = _get

    # After flush, the conversation needs an id
    async def _flush():
        new_conv.id = _CONV_ID

    session.flush = _flush

    # add() must set id and defaults on Conversation objects
    def _add(obj):
        if isinstance(obj, Conversation):
            obj.id = _CONV_ID
            obj.updated_at = datetime(2026, 3, 1)
            if obj.message_count is None:
                obj.message_count = 0

    session.add = _add
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", new_callable=AsyncMock, return_value=[]),
        patch("app.core.rag.generate", new_callable=AsyncMock, return_value="Mocked answer"),
    ):
        async with _make_client_with_db(session) as ac:
            response = await ac.post(
                "/api/v1/chat/message",
                json={"message": "What is the vacation policy?"},
                headers=AUTH_HEADERS,
            )

    assert response.status_code == 200
    body = response.json()
    assert "response" in body
    assert "conversation_id" in body


async def test_send_message_no_auth(client: AsyncClient):
    """Missing token → 401."""
    response = await client.post(
        "/api/v1/chat/message",
        json={"message": "Hello"},
    )
    assert response.status_code == 401


async def test_send_message_empty_rejected():
    """Blank message → 422."""
    call_count = {"n": 0}

    async def _get(model, pk):
        call_count["n"] += 1
        return CHAT_USER

    session = _make_session()
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.post(
            "/api/v1/chat/message",
            json={"message": "   "},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 422


# ── GET /api/v1/chat/conversations ────────────────────────────────────────────


async def test_list_conversations_empty():
    """New user with no conversations → 200 + empty list."""
    async def _get(model, pk):
        return CHAT_USER

    session = _make_session(execute_scalars=[])
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.get("/api/v1/chat/conversations", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == []


async def test_list_conversations_after_message():
    """After a conversation exists, it appears in the list."""
    async def _get(model, pk):
        return CHAT_USER

    session = _make_session(execute_scalars=[SAMPLE_CONVERSATION])
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.get("/api/v1/chat/conversations", headers=AUTH_HEADERS)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == _CONV_ID
    assert data[0]["title"] == "Hello world"


# ── GET /api/v1/chat/history/{conversation_id} ────────────────────────────────


async def test_get_conversation_history():
    """GET history → list of messages for the conversation."""
    call_count = {"n": 0}

    async def _get(model, pk):
        n = call_count["n"]
        call_count["n"] += 1
        if n == 0:
            return CHAT_USER           # get_current_user
        return SAMPLE_CONVERSATION     # get conversation

    session = _make_session(execute_scalars=[SAMPLE_USER_MSG, SAMPLE_ASSISTANT_MSG])
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.get(
            f"/api/v1/chat/history/{_CONV_ID}", headers=AUTH_HEADERS
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[1]["role"] == "assistant"


async def test_get_history_not_found():
    """History for a non-existent conversation → 404."""
    call_count = {"n": 0}

    async def _get(model, pk):
        n = call_count["n"]
        call_count["n"] += 1
        if n == 0:
            return CHAT_USER   # get_current_user
        return None            # conversation not found

    session = _make_session()
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.get(
            "/api/v1/chat/history/does-not-exist", headers=AUTH_HEADERS
        )

    assert response.status_code == 404


# ── DELETE /api/v1/chat/conversations/{id} ────────────────────────────────────


async def test_delete_conversation():
    """DELETE existing conversation → 204."""
    call_count = {"n": 0}

    async def _get(model, pk):
        n = call_count["n"]
        call_count["n"] += 1
        if n == 0:
            return CHAT_USER           # get_current_user
        return SAMPLE_CONVERSATION     # conversation to delete

    session = _make_session()
    session.get = _get
    session.delete = AsyncMock()
    session.commit = AsyncMock()

    async with _make_client_with_db(session) as ac:
        response = await ac.delete(
            f"/api/v1/chat/conversations/{_CONV_ID}", headers=AUTH_HEADERS
        )

    assert response.status_code == 204
    session.delete.assert_awaited_once_with(SAMPLE_CONVERSATION)
    session.commit.assert_awaited()


async def test_delete_conversation_not_found():
    """DELETE non-existent conversation → 404."""
    call_count = {"n": 0}

    async def _get(model, pk):
        n = call_count["n"]
        call_count["n"] += 1
        if n == 0:
            return CHAT_USER   # get_current_user
        return None            # conversation not found

    session = _make_session()
    session.get = _get

    async with _make_client_with_db(session) as ac:
        response = await ac.delete(
            "/api/v1/chat/conversations/ghost-id", headers=AUTH_HEADERS
        )

    assert response.status_code == 404
