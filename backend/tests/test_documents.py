from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.document import Document

DOC = Document(id="doc-1", filename="notes.txt", size=12, created_at=datetime(2026, 1, 1))


def _db_patch(docs: list = None, fetched_doc=DOC):
    """Patch get_db with a mock session."""
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = docs or []
    session.execute = AsyncMock(return_value=result)
    session.get = AsyncMock(return_value=fetched_doc)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock(side_effect=lambda obj: None)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.db.postgres.AsyncSessionLocal", return_value=cm), session


def _chroma_patch():
    collection = AsyncMock()
    chroma = AsyncMock()
    chroma.get_or_create_collection = AsyncMock(return_value=collection)
    return patch("app.api.v1.endpoints.documents.get_chroma", return_value=AsyncMock(return_value=chroma)), collection


# ─── LIST ─────────────────────────────────────────────────────────────────────

async def test_list_documents_empty(client: AsyncClient):
    db_patch, _ = _db_patch(docs=[])
    with db_patch:
        response = await client.get("/api/v1/documents")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_documents_returns_items(client: AsyncClient):
    db_patch, _ = _db_patch(docs=[DOC])
    with db_patch:
        response = await client.get("/api/v1/documents")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "doc-1"
    assert body[0]["filename"] == "notes.txt"


# ─── UPLOAD ───────────────────────────────────────────────────────────────────

async def test_upload_document_returns_201(client: AsyncClient):
    db_patch, session = _db_patch()
    chroma_patch, collection = _chroma_patch()

    with db_patch, chroma_patch:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("hello.txt", b"Hello world", "text/plain")},
        )

    assert response.status_code == 201


async def test_upload_document_stores_in_chroma(client: AsyncClient):
    db_patch, _ = _db_patch()
    chroma_patch, collection = _chroma_patch()

    with db_patch, chroma_patch:
        await client.post(
            "/api/v1/documents",
            files={"file": ("hello.txt", b"Hello world", "text/plain")},
        )

    collection.add.assert_awaited_once()
    call_kwargs = collection.add.call_args.kwargs
    assert call_kwargs["documents"] == ["Hello world"]


# ─── DELETE ───────────────────────────────────────────────────────────────────

async def test_delete_document_returns_204(client: AsyncClient):
    db_patch, _ = _db_patch()
    chroma_patch, _ = _chroma_patch()

    with db_patch, chroma_patch:
        response = await client.delete("/api/v1/documents/doc-1")

    assert response.status_code == 204


async def test_delete_document_not_found(client: AsyncClient):
    db_patch, session = _db_patch()
    session.get = AsyncMock(return_value=None)
    chroma_patch, _ = _chroma_patch()

    with db_patch, chroma_patch:
        response = await client.delete("/api/v1/documents/missing")

    assert response.status_code == 404
