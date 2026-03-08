import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.postgres import AsyncSessionLocal

router = APIRouter()


@router.get("/health")
async def health():
    services: dict[str, dict] = {
        "postgres": {"status": "unknown"},
        "chromadb": {"status": "unknown"},
        "ollama": {"status": "unknown"},
    }

    # PostgreSQL
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        services["postgres"]["status"] = "ok"
    except Exception as e:
        services["postgres"]["status"] = str(e)

    # ChromaDB — returns 410 on heartbeat (known quirk), treat as ok
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.chroma_url}/api/v1/heartbeat")
            services["chromadb"]["status"] = "ok" if r.status_code in (200, 410) else f"http {r.status_code}"
    except Exception as e:
        services["chromadb"]["status"] = str(e)

    # Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            services["ollama"]["status"] = "ok" if r.is_success else f"http {r.status_code}"
    except Exception as e:
        services["ollama"]["status"] = str(e)

    overall = "ok" if all(s["status"] == "ok" for s in services.values()) else "degraded"
    return {"status": overall, "services": services}
