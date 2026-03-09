"""
Ollama HTTP client — wrapper around Ollama's REST API.
Supports both batch generation and async token streaming.
"""

import json
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default timeout for non-streaming requests (seconds)
# Mistral 7B on CPU can take 2-4 min; set well above that.
_TIMEOUT = 300.0


@asynccontextmanager
async def ollama_client():
    """Yield a short-lived httpx client connected to the Ollama container."""
    async with httpx.AsyncClient(base_url=settings.ollama_url, timeout=_TIMEOUT) as client:
        yield client


async def generate(prompt: str, model: str | None = None) -> str:
    """
    Generate a complete response from Ollama (non-streaming).

    Args:
        prompt: The full prompt to send to the model
        model: Override the default model from settings

    Returns:
        Complete response string from the LLM
    """
    model = model or settings.ollama_model
    async with ollama_client() as client:
        response = await client.post(
            "/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        return response.json()["response"]


async def generate_stream(
    prompt: str,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Ollama as they are generated.
    Each yield is one token (partial text) from the model.

    Usage:
        async for token in generate_stream(prompt):
            await websocket.send_text(token)
    """
    model = model or settings.ollama_model

    async with httpx.AsyncClient(
        base_url=settings.ollama_url,
        timeout=httpx.Timeout(300.0),  # Streaming can take longer
    ) as client:
        async with client.stream(
            "POST",
            "/api/generate",
            json={"model": model, "prompt": prompt, "stream": True},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    if token:
                        yield token
                    if chunk.get("done", False):
                        break
                except json.JSONDecodeError:
                    logger.warning("Ollama stream: invalid JSON line: %r", line)
                    continue


async def health_check() -> bool:
    """
    Check if Ollama is reachable and the configured model is available.

    Returns:
        True if Ollama is healthy and the model exists, False otherwise
    """
    try:
        async with ollama_client() as client:
            response = await client.get("/api/tags", timeout=5.0)
            if not response.is_success:
                return False

            available_models = [m.get("name", "") for m in response.json().get("models", [])]
            model_name = settings.ollama_model
            # Model may be listed as "mistral" or "mistral:latest"
            return any(
                m == model_name or m.startswith(f"{model_name}:") or m.endswith(f":{model_name}")
                for m in available_models
            )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Ollama health check failed: %s", exc)
        return False
