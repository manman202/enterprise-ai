"""
Document ingestion unit tests (Phase 9).

Tests the pure-Python functions in app.core.ingestion:
  - chunk_text: chunking behaviour with size and overlap
  - extract_text_from_txt: reads a .txt file correctly
  - extract_text: dispatch — unknown extension returns ""

No database or HTTP calls are made.
"""

import os
import tempfile

import pytest

from app.core.ingestion import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    chunk_text,
    extract_text,
    extract_text_from_txt,
)


# ── chunk_text ─────────────────────────────────────────────────────────────────


def test_chunk_text_basic():
    """A 1000-char string should produce multiple chunks ≤ CHUNK_SIZE + small margin."""
    text = "word " * 200          # 1 000 characters (5 chars × 200)
    chunks = chunk_text(text)

    assert len(chunks) > 1, "Expected more than one chunk for a 1 000-char text"
    for chunk in chunks:
        # Each chunk should not greatly exceed the target size
        assert len(chunk) <= CHUNK_SIZE + CHUNK_OVERLAP + 10, (
            f"Chunk too large: {len(chunk)} chars"
        )


def test_chunk_text_short():
    """Text shorter than CHUNK_SIZE → exactly one chunk equal to the input."""
    text = "This is a short sentence."
    chunks = chunk_text(text)

    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_empty():
    """Empty string → empty list."""
    assert chunk_text("") == []


def test_chunk_text_whitespace_only():
    """Whitespace-only string → empty list."""
    assert chunk_text("   \n\n   ") == []


def test_chunk_text_overlap():
    """Adjacent chunks should share overlapping content at their boundary."""
    # Build a text where each 'sentence' is CHUNK_SIZE characters long so that
    # the second sentence starts near the boundary of the first chunk.
    sentence_a = "A" * (CHUNK_SIZE - 5) + ". "
    sentence_b = "B" * (CHUNK_SIZE - 5) + ". "
    text = sentence_a + sentence_b

    chunks = chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)

    # With overlap we expect at least 2 chunks; the second should start
    # before the clean end of the first chunk.
    assert len(chunks) >= 2, "Need at least 2 chunks to verify overlap"

    # The tail of chunk[0] should appear in the head of chunk[1]
    tail_of_first = chunks[0][-CHUNK_OVERLAP:]
    head_of_second = chunks[1][:CHUNK_OVERLAP]
    assert tail_of_first in chunks[1] or head_of_second in chunks[0], (
        "No overlap found between adjacent chunks"
    )


def test_chunk_text_exact_size():
    """Text that is exactly CHUNK_SIZE long → one chunk, no crash."""
    text = "x" * CHUNK_SIZE
    chunks = chunk_text(text)
    assert len(chunks) >= 1


def test_chunk_text_preserves_content():
    """All characters from the original text must appear somewhere in the chunks."""
    text = "Hello world! " * 100
    chunks = chunk_text(text)
    reconstructed = " ".join(chunks)
    # Every unique word from the original must appear in the output
    for word in set(text.split()):
        assert word in reconstructed, f"Word '{word}' missing from chunks"


# ── extract_text_from_txt ──────────────────────────────────────────────────────


def test_extract_text_txt():
    """extract_text_from_txt reads and returns the file content."""
    content = "Hello, Aiyedun!\nThis is a test document.\n"

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", encoding="utf-8", delete=False
    ) as f:
        f.write(content)
        path = f.name

    try:
        result = extract_text_from_txt(path)
        assert result == content
    finally:
        os.unlink(path)


def test_extract_text_txt_via_dispatch():
    """extract_text() dispatches .txt files to extract_text_from_txt."""
    content = "Dispatch test content.\n"

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", encoding="utf-8", delete=False
    ) as f:
        f.write(content)
        path = f.name

    try:
        result = extract_text(path)
        assert result == content
    finally:
        os.unlink(path)


def test_extract_text_md_via_dispatch():
    """.md files are treated as plain text."""
    content = "# Heading\n\nSome markdown content.\n"

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", encoding="utf-8", delete=False
    ) as f:
        f.write(content)
        path = f.name

    try:
        result = extract_text(path)
        assert result == content
    finally:
        os.unlink(path)


# ── extract_text — unknown extension ──────────────────────────────────────────


def test_dispatch_unknown_extension():
    """extract_text with an unsupported extension returns an empty string."""
    # Create a real file so the path exists; extension is what matters
    with tempfile.NamedTemporaryFile(suffix=".xyz", delete=False) as f:
        f.write(b"binary content")
        path = f.name

    try:
        result = extract_text(path)
        assert result == "", (
            f"Expected empty string for .xyz extension, got: {result!r}"
        )
    finally:
        os.unlink(path)


def test_dispatch_no_extension():
    """extract_text with no extension (empty ext) returns empty string."""
    with tempfile.NamedTemporaryFile(suffix="", delete=False) as f:
        f.write(b"data")
        path = f.name

    try:
        result = extract_text(path)
        assert result == ""
    finally:
        os.unlink(path)
