from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


async def test_chat_returns_response(client: AsyncClient):
    with patch("app.api.v1.endpoints.chat.generate", new=AsyncMock(return_value="Hello!")):
        response = await client.post("/api/v1/chat", json={"message": "Hi"})

    assert response.status_code == 200
    assert response.json() == {"response": "Hello!"}


async def test_chat_passes_message_to_generate(client: AsyncClient):
    mock_generate = AsyncMock(return_value="answer")
    with patch("app.api.v1.endpoints.chat.generate", new=mock_generate):
        await client.post("/api/v1/chat", json={"message": "What is AI?"})

    mock_generate.assert_awaited_once_with("What is AI?")


async def test_chat_rejects_empty_message(client: AsyncClient):
    response = await client.post("/api/v1/chat", json={"message": "   "})
    assert response.status_code == 422


async def test_chat_rejects_missing_message(client: AsyncClient):
    response = await client.post("/api/v1/chat", json={})
    assert response.status_code == 422
