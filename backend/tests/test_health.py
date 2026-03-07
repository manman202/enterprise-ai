from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
from httpx import AsyncClient, Response

from app.core.config import settings


def _mock_postgres(ok: bool = True):
    """Return a context-manager patch for AsyncSessionLocal that succeeds or raises."""
    session = AsyncMock()
    if ok:
        session.execute = AsyncMock(return_value=None)
    else:
        session.execute = AsyncMock(side_effect=Exception("connection refused"))

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.api.v1.endpoints.health.AsyncSessionLocal", return_value=cm)


@respx.mock
async def test_health_all_ok(client: AsyncClient):
    respx.get(f"{settings.chroma_url}/api/v1/heartbeat").mock(return_value=Response(200))
    respx.get(f"{settings.ollama_url}/api/tags").mock(return_value=Response(200))

    with _mock_postgres(ok=True):
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["api"] == "ok"
    assert body["postgres"] == "ok"
    assert body["chromadb"] == "ok"
    assert body["ollama"] == "ok"


@respx.mock
async def test_health_postgres_down(client: AsyncClient):
    respx.get(f"{settings.chroma_url}/api/v1/heartbeat").mock(return_value=Response(200))
    respx.get(f"{settings.ollama_url}/api/tags").mock(return_value=Response(200))

    with _mock_postgres(ok=False):
        response = await client.get("/api/v1/health")

    body = response.json()
    assert body["postgres"] != "ok"
    assert body["chromadb"] == "ok"
    assert body["ollama"] == "ok"


@respx.mock
async def test_health_chromadb_down(client: AsyncClient):
    respx.get(f"{settings.chroma_url}/api/v1/heartbeat").mock(return_value=Response(503))
    respx.get(f"{settings.ollama_url}/api/tags").mock(return_value=Response(200))

    with _mock_postgres(ok=True):
        response = await client.get("/api/v1/health")

    body = response.json()
    assert body["postgres"] == "ok"
    assert body["chromadb"] == "http 503"
    assert body["ollama"] == "ok"


@respx.mock
async def test_health_ollama_unreachable(client: AsyncClient):
    import httpx

    respx.get(f"{settings.chroma_url}/api/v1/heartbeat").mock(return_value=Response(200))
    respx.get(f"{settings.ollama_url}/api/tags").mock(side_effect=httpx.ConnectError("refused"))

    with _mock_postgres(ok=True):
        response = await client.get("/api/v1/health")

    body = response.json()
    assert body["postgres"] == "ok"
    assert body["chromadb"] == "ok"
    assert body["ollama"] != "ok"
