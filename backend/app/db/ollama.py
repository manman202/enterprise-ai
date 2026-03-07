from contextlib import asynccontextmanager

import httpx

from app.core.config import settings


@asynccontextmanager
async def ollama_client():
    async with httpx.AsyncClient(base_url=settings.ollama_url, timeout=120.0) as client:
        yield client


async def generate(prompt: str, model: str | None = None) -> str:
    model = model or settings.ollama_model
    async with ollama_client() as client:
        response = await client.post(
            "/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        return response.json()["response"]
