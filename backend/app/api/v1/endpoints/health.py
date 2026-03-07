import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.postgres import AsyncSessionLocal

router = APIRouter()


@router.get("/health")
async def health():
    status = {"api": "ok", "postgres": "unknown", "chromadb": "unknown", "ollama": "unknown"}

    # PostgreSQL
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        status["postgres"] = "ok"
    except Exception as e:
        status["postgres"] = str(e)

    # ChromaDB
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.chroma_url}/api/v1/heartbeat")
            status["chromadb"] = "ok" if r.is_success else f"http {r.status_code}"
    except Exception as e:
        status["chromadb"] = str(e)

    # Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            status["ollama"] = "ok" if r.is_success else f"http {r.status_code}"
    except Exception as e:
        status["ollama"] = str(e)

    return status
