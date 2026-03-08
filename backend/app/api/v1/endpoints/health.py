"""
Health endpoints.
  GET /api/v1/health         — basic check (postgres, chromadb, ollama) — used by Docker healthcheck
  GET /api/v1/health/services — detailed check for all 7 services + system metrics
All service checks in /health/services run in parallel with a 3-second timeout.
"""

import asyncio
import time
from datetime import datetime, timezone

import httpx
import psutil
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.postgres import AsyncSessionLocal

router = APIRouter()


# ── Individual service check helpers ──────────────────────────────────────────


async def _check_postgres() -> dict:
    """Check PostgreSQL connectivity and measure response time."""
    start = time.monotonic()
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "response_ms": round((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_ms": round((time.monotonic() - start) * 1000),
            "error": str(e)[:120],
        }


async def _check_chromadb() -> dict:
    """Check ChromaDB connectivity. HTTP 410 on heartbeat is a known quirk — treat as healthy."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.chroma_url}/api/v1/heartbeat")
            ok = r.status_code in (200, 410)
            return {"status": "healthy" if ok else "unhealthy", "response_ms": round((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_ms": round((time.monotonic() - start) * 1000),
            "error": str(e)[:120],
        }


async def _check_ollama() -> dict:
    """Check Ollama and report which model is loaded."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            if r.is_success:
                models = [m.get("name", "") for m in r.json().get("models", [])]
                # Prefer the configured model name
                loaded = next((m for m in models if settings.ollama_model in m), None) or (
                    models[0] if models else None
                )
                return {
                    "status": "healthy",
                    "response_ms": round((time.monotonic() - start) * 1000),
                    "model_loaded": loaded,
                }
            return {"status": "unhealthy", "response_ms": round((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_ms": round((time.monotonic() - start) * 1000),
            "error": str(e)[:120],
        }


async def _check_http(url: str) -> dict:
    """Generic HTTP liveness probe — GET the URL and expect any non-5xx response."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(url, follow_redirects=True)
            ok = r.status_code < 500
            return {"status": "healthy" if ok else "unhealthy", "response_ms": round((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_ms": round((time.monotonic() - start) * 1000),
            "error": str(e)[:120],
        }


def _system_metrics() -> dict:
    """Collect CPU, RAM, disk, and swap metrics via psutil."""
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    swap = psutil.swap_memory()
    return {
        "cpu_percent": round(cpu, 1),
        "ram_used_gb": round(ram.used / 1024**3, 1),
        "ram_total_gb": round(ram.total / 1024**3, 1),
        "ram_percent": round(ram.percent, 1),
        "disk_used_gb": int(disk.used / 1024**3),
        "disk_total_gb": int(disk.total / 1024**3),
        "disk_percent": round(disk.percent, 1),
        "swap_used_gb": round(swap.used / 1024**3, 1),
        "swap_total_gb": round(swap.total / 1024**3, 1),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/health")
async def health():
    """Basic health check — postgres, chromadb, ollama. Used by Docker healthcheck."""
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


@router.get("/health/services")
async def health_services():
    """
    Detailed health check for all 7 platform services plus system metrics.
    All service checks run in parallel (asyncio.gather) with a 3-second timeout each.
    The backend check is a self-report (1 ms) since this endpoint executing means the backend is up.
    """
    # Backend self-report — if we're serving the request, we're healthy
    backend_result = {"status": "healthy", "response_ms": 1}

    # All external checks run in parallel
    (
        postgres_result,
        chromadb_result,
        ollama_result,
        frontend_result,
        admin_result,
        gitlab_result,
    ) = await asyncio.gather(
        _check_postgres(),
        _check_chromadb(),
        _check_ollama(),
        _check_http(f"http://aiyedun-frontend:{settings.frontend_port}/"),
        _check_http(f"http://aiyedun-admin:{settings.admin_port}/"),
        _check_http(settings.gitlab_url),
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "postgres": postgres_result,
            "chromadb": chromadb_result,
            "ollama": ollama_result,
            "backend": backend_result,
            "frontend": frontend_result,
            "admin": admin_result,
            "gitlab": gitlab_result,
        },
        "system": _system_metrics(),
    }
