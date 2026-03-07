from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


def _chroma_patch(ids=None, texts=None, metadatas=None, distances=None, missing=False):
    collection = AsyncMock()
    collection.query = AsyncMock(return_value={
        "ids": [ids or []],
        "documents": [texts or []],
        "metadatas": [metadatas or []],
        "distances": [distances or []],
    })

    chroma = AsyncMock()
    if missing:
        chroma.get_collection = AsyncMock(side_effect=Exception("collection not found"))
    else:
        chroma.get_collection = AsyncMock(return_value=collection)

    return patch("app.api.v1.endpoints.search.get_chroma", return_value=AsyncMock(return_value=chroma)), collection


async def test_search_returns_results(client: AsyncClient):
    chroma_patch, collection = _chroma_patch(
        ids=["doc-1"],
        texts=["The quick brown fox"],
        metadatas=[{"filename": "fox.txt", "document_id": "doc-1"}],
        distances=[0.1],
    )
    with chroma_patch:
        response = await client.post("/api/v1/search", json={"query": "fox"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "fox"
    assert len(body["results"]) == 1
    result = body["results"][0]
    assert result["document_id"] == "doc-1"
    assert result["filename"] == "fox.txt"
    assert result["excerpt"] == "The quick brown fox"
    assert result["score"] == pytest.approx(0.9)


async def test_search_empty_collection_returns_empty(client: AsyncClient):
    chroma_patch, _ = _chroma_patch(missing=True)
    with chroma_patch:
        response = await client.post("/api/v1/search", json={"query": "anything"})

    assert response.status_code == 200
    assert response.json()["results"] == []


async def test_search_rejects_empty_query(client: AsyncClient):
    chroma_patch, _ = _chroma_patch()
    with chroma_patch:
        response = await client.post("/api/v1/search", json={"query": "   "})

    assert response.status_code == 422


async def test_search_truncates_long_excerpts(client: AsyncClient):
    long_text = "a" * 500
    chroma_patch, _ = _chroma_patch(
        ids=["doc-1"],
        texts=[long_text],
        metadatas=[{"filename": "big.txt", "document_id": "doc-1"}],
        distances=[0.2],
    )
    with chroma_patch:
        response = await client.post("/api/v1/search", json={"query": "a"})

    assert len(response.json()["results"][0]["excerpt"]) == 300


async def test_search_passes_n_results_to_chroma(client: AsyncClient):
    chroma_patch, collection = _chroma_patch()
    with chroma_patch:
        await client.post("/api/v1/search", json={"query": "test", "n_results": 3})

    collection.query.assert_awaited_once()
    assert collection.query.call_args.kwargs["n_results"] == 3
