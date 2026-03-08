"""
ChromaDB async client singleton and query helpers.
Supports multi-collection queries filtered by department for RBAC.
"""

import logging
from typing import Any

import chromadb

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None  # chromadb async client (type: chromadb.AsyncHttpClient)

# Default collection name for all documents
DEFAULT_COLLECTION = "documents"


async def get_chroma():
    """Return (or create) the shared async ChromaDB client."""
    global _client
    if _client is None:
        _client = await chromadb.AsyncHttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
    return _client


async def get_collection(name: str = DEFAULT_COLLECTION):  # type: ignore[return]
    """Get or create a ChromaDB collection by name."""
    client = await get_chroma()
    return await client.get_or_create_collection(name)


async def query_documents(
    query_embedding: list[float],
    n_results: int = 5,
    department_filter: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Query the documents collection using a pre-computed embedding.

    Args:
        query_embedding: Vector produced by the embedding model
        n_results: Max number of chunks to return
        department_filter: If set, only return chunks from these departments.
                           None means return from all departments (admin queries).

    Returns:
        List of {document_id, filename, department, excerpt, score} dicts
    """
    try:
        collection = await get_collection(DEFAULT_COLLECTION)
    except Exception:
        # Collection doesn't exist yet (no documents uploaded)
        return []

    # Build ChromaDB where clause for department RBAC
    where: dict[str, Any] | None = None
    if department_filter:
        if len(department_filter) == 1:
            where = {"department": {"$eq": department_filter[0]}}
        else:
            where = {"department": {"$in": department_filter}}

    try:
        raw = await collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
            where=where,
        )
    except Exception as exc:
        logger.warning("ChromaDB query failed: %s", exc)
        return []

    results = []
    ids = raw.get("ids", [[]])[0]
    texts = raw.get("documents", [[]])[0]
    metas = raw.get("metadatas", [[]])[0]
    distances = raw.get("distances", [[]])[0]

    for doc_id, text, meta, distance in zip(ids, texts, metas, distances):
        results.append(
            {
                "document_id": doc_id,
                "filename": meta.get("filename", "unknown"),
                "department": meta.get("department", ""),
                "excerpt": text[:400] if text else "",  # First 400 chars as preview
                "score": round(1 - float(distance), 4),  # Cosine similarity
            }
        )

    return results


async def add_document_chunks(
    doc_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
    filename: str,
    department: str,
) -> None:
    """
    Add a document's text chunks to ChromaDB with metadata.
    Each chunk gets a unique ID = doc_id::chunk_index.
    """
    collection = await get_collection(DEFAULT_COLLECTION)

    # Build per-chunk IDs and metadata
    chunk_ids = [f"{doc_id}::{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": doc_id,
            "filename": filename,
            "department": department,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    await collection.add(
        ids=chunk_ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    logger.info("Stored %d chunks for document '%s' in ChromaDB", len(chunks), filename)


async def delete_document_chunks(doc_id: str) -> None:
    """Remove all chunks for a given document from ChromaDB."""
    try:
        collection = await get_collection(DEFAULT_COLLECTION)
        # Query to find all chunk IDs for this document
        existing = await collection.get(where={"document_id": {"$eq": doc_id}})
        if existing and existing.get("ids"):
            await collection.delete(ids=existing["ids"])
            logger.info(
                "Deleted %d chunks for document '%s' from ChromaDB",
                len(existing["ids"]),
                doc_id,
            )
    except Exception as exc:
        logger.warning("Failed to delete chunks for document '%s': %s", doc_id, exc)
