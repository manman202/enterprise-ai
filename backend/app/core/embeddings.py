"""
Local embedding service using sentence-transformers.
Model: all-MiniLM-L6-v2 (384-dimensional, fast, high quality for semantic search)

The model is loaded once at first use and cached in memory.
On an offline server, the model must be pre-downloaded into the Docker image
or the HuggingFace cache directory.
"""

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level model cache — loaded once, reused for all requests
_model: Any | None = None


def _load_model() -> Any:
    """
    Load the sentence-transformers model.
    Logs a clear error if sentence-transformers is not installed.
    """
    global _model
    if _model is not None:
        return _model

    try:
        from sentence_transformers import \
            SentenceTransformer  # type: ignore[import]

        logger.info("Loading embedding model '%s'...", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("Embedding model loaded successfully")
        return _model
    except ImportError:
        logger.error(
            "sentence-transformers not installed. "
            "Run: pip install sentence-transformers"
        )
        raise
    except Exception as exc:
        logger.error(
            "Failed to load embedding model '%s': %s", settings.embedding_model, exc
        )
        raise


def embed_text(text: str) -> list[float]:
    """
    Compute a dense vector embedding for a single text string.

    Args:
        text: Input text (query or document chunk)

    Returns:
        List of floats (384 dimensions for all-MiniLM-L6-v2)
    """
    model = _load_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Compute embeddings for a list of texts in a single batch call.
    More efficient than calling embed_text() in a loop.

    Args:
        texts: List of text strings (document chunks)

    Returns:
        List of embedding vectors, one per input text
    """
    if not texts:
        return []
    model = _load_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [e.tolist() for e in embeddings]


def preload() -> None:
    """
    Eagerly load the embedding model at application startup.
    Prevents the first query from being slow.
    """
    _load_model()
