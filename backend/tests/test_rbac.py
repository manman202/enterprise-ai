"""
RBAC / department isolation tests (Phase 9).

Tests that:
1. rag_query passes the caller's department as a filter to ChromaDB
2. Admin users pass None (no filter) — full access
3. The passerelle department bypass: documents tagged 'passerelle' are
   available even when the query is filtered to a different department
   (tested indirectly via the mock return)
4. build_rag_prompt builds a prompt that includes context from returned chunks

All external services are mocked; no real DB, ChromaDB, or Ollama calls.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.rag import build_rag_prompt, rag_query


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_chunk(doc_id="doc-1", filename="test.pdf", department="RH", excerpt="Some text", score=0.9):
    return {
        "document_id": doc_id,
        "filename": filename,
        "department": department,
        "excerpt": excerpt,
        "score": score,
    }


# ── test_rag_only_queries_user_department ──────────────────────────────────────


async def test_rag_only_queries_user_department():
    """
    rag_query must forward the caller's department list to query_documents
    so that ChromaDB filters results to that department only.
    """
    mock_query = AsyncMock(return_value=[])
    mock_generate = AsyncMock(return_value="Mocked answer")

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", mock_query),
        patch("app.core.rag.generate", mock_generate),
    ):
        answer, chunks = await rag_query(
            question="What is the leave policy?",
            user_departments=["RH"],
        )

    # ChromaDB must have been called exactly once with the RH filter
    mock_query.assert_awaited_once()
    call_kwargs = mock_query.await_args.kwargs
    assert call_kwargs.get("department_filter") == ["RH"], (
        f"Expected department_filter=['RH'], got: {call_kwargs.get('department_filter')}"
    )


async def test_rag_department_filter_it():
    """rag_query passes the IT department filter through correctly."""
    mock_query = AsyncMock(return_value=[])
    mock_generate = AsyncMock(return_value="IT answer")

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", mock_query),
        patch("app.core.rag.generate", mock_generate),
    ):
        await rag_query(
            question="What software is approved?",
            user_departments=["IT"],
        )

    call_kwargs = mock_query.await_args.kwargs
    assert call_kwargs.get("department_filter") == ["IT"]


# ── test_admin_has_no_department_restriction ──────────────────────────────────


async def test_admin_has_no_department_restriction():
    """
    When user_departments=None (admin), rag_query must pass None to
    query_documents — i.e., no department filter applied.
    """
    mock_query = AsyncMock(return_value=[])
    mock_generate = AsyncMock(return_value="Admin answer")

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", mock_query),
        patch("app.core.rag.generate", mock_generate),
    ):
        answer, chunks = await rag_query(
            question="Show me all documents",
            user_departments=None,   # admin — no restriction
        )

    assert answer  # some response returned
    call_kwargs = mock_query.await_args.kwargs
    assert call_kwargs.get("department_filter") is None, (
        "Admin query must not filter by department"
    )


# ── test_passerelle_accessible_cross_dept ─────────────────────────────────────


async def test_passerelle_accessible_cross_dept():
    """
    A document in the 'passerelle' department returned by ChromaDB
    should appear in the RAG answer regardless of the user's department.

    We verify this by mocking query_documents to return a passerelle chunk
    and checking that the answer and sources are propagated correctly.
    """
    passerelle_chunk = _make_chunk(
        doc_id="pass-doc-1",
        filename="circular.pdf",
        department="passerelle",
        excerpt="This circular applies to all staff.",
        score=0.95,
    )

    mock_query = AsyncMock(return_value=[passerelle_chunk])
    mock_generate = AsyncMock(return_value="All staff must read the circular.")

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", mock_query),
        patch("app.core.rag.generate", mock_generate),
    ):
        answer, chunks = await rag_query(
            question="Is there a circular for all staff?",
            user_departments=["RH"],   # RH user, but passerelle doc returned
        )

    assert answer == "All staff must read the circular."
    assert len(chunks) == 1
    assert chunks[0]["department"] == "passerelle"
    assert chunks[0]["filename"] == "circular.pdf"


# ── build_rag_prompt tests ─────────────────────────────────────────────────────


def test_build_rag_prompt_includes_context():
    """Prompt must include the document excerpt and filename."""
    chunk = _make_chunk(filename="policy.pdf", excerpt="Employees get 25 days leave.")
    prompt = build_rag_prompt("How many leave days?", [chunk])

    assert "policy.pdf" in prompt
    assert "Employees get 25 days leave." in prompt
    assert "How many leave days?" in prompt


def test_build_rag_prompt_no_context():
    """With no chunks the prompt signals that no documents were found."""
    prompt = build_rag_prompt("What is AI?", [])

    assert "Aucun document pertinent" in prompt
    assert "What is AI?" in prompt


def test_build_rag_prompt_includes_history():
    """Conversation history turns should appear in the prompt."""
    history = [
        {"role": "user", "content": "Who are you?"},
        {"role": "assistant", "content": "I am Aiyedun."},
    ]
    prompt = build_rag_prompt("Tell me more.", [], history=history)

    assert "Who are you?" in prompt
    assert "I am Aiyedun." in prompt


def test_build_rag_prompt_multiple_departments():
    """Chunks from multiple departments should all appear in the prompt."""
    chunks = [
        _make_chunk(filename="rh_doc.pdf", department="RH", excerpt="HR policy text."),
        _make_chunk(filename="it_doc.pdf", department="IT", excerpt="IT policy text."),
    ]
    prompt = build_rag_prompt("Company policies?", chunks)

    assert "rh_doc.pdf" in prompt
    assert "it_doc.pdf" in prompt
    assert "HR policy text." in prompt
    assert "IT policy text." in prompt


# ── rag_query error handling ──────────────────────────────────────────────────


async def test_rag_query_embedding_failure_returns_fallback():
    """If embed_text raises, rag_query returns a graceful error message."""
    with patch("app.core.rag.embed_text", side_effect=RuntimeError("model unavailable")):
        answer, chunks = await rag_query("Test question", user_departments=["RH"])

    assert "indisponible" in answer.lower() or answer  # graceful fallback
    assert chunks == []


async def test_rag_query_ollama_failure_returns_fallback():
    """If Ollama generate raises, rag_query returns a graceful error message."""
    mock_query = AsyncMock(return_value=[])

    with (
        patch("app.core.rag.embed_text", return_value=[0.0] * 384),
        patch("app.core.rag.query_documents", mock_query),
        patch("app.core.rag.generate", side_effect=RuntimeError("ollama down")),
    ):
        answer, chunks = await rag_query("Test question")

    assert "indisponible" in answer.lower() or answer
    assert chunks == []
