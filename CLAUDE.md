# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aiyedun is a fully self-hosted, offline-first enterprise AI knowledge platform. LAN-only, Active Directory-governed, zero internet dependency (V1).

**Planned stack:**
- **LLM:** Ollama + Mistral 7B (local, offline)
- **Vector DB:** ChromaDB
- **Database:** PostgreSQL 16
- **Backend:** FastAPI (Python 3.12)
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **CI/CD:** GitLab CE (primary) mirrored to GitHub

## Infrastructure

The `infra/` directory contains the Docker Compose stack. All services communicate over an internal bridge network (`aiyedun-internal`). A separate `aiyedun-web` network is reserved for public-facing services.

### Starting the stack

```bash
cd infra
docker compose up -d
```

### Service endpoints (within the stack)

| Service    | Internal address              |
|------------|-------------------------------|
| PostgreSQL | `aiyedun-postgres:5432`       |
| ChromaDB   | `aiyedun-chromadb:8000`       |
| Ollama     | `aiyedun-ollama:11434`        |

### Environment variables

Copy `.env.example` to `.env` before starting. The default `POSTGRES_PASSWORD` is set in `docker-compose.yml` but should be overridden via `.env` in real deployments.

## CI/CD Pipeline (GitLab)

Pipeline stages: `lint` → `test` → `build` → `deploy-dev` → `deploy-prod` → `mirror`

- Backend lint uses `flake8` on the `backend/` directory.
- Frontend lint runs against the `frontend/` directory (Node 20).
- The `mirror:github` job pushes `main` and `develop` branches to GitHub using the `GITHUB_TOKEN` CI variable.
- All current jobs are marked `allow_failure: true` as the backend/frontend code is not yet scaffolded.

## Backend Development

Located in `backend/`. FastAPI app entry point: `backend/app/main.py`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run dev server (hot reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Lint
flake8 app --max-line-length=120

# Tests
pytest tests/ -v

# Single test
pytest tests/path/to/test_file.py::test_name -v
```

### Backend structure

```
backend/
  app/
    main.py          # FastAPI app + router registration
    core/config.py   # Pydantic Settings — all env vars loaded here
    api/v1/
      router.py      # Mounts all v1 endpoint routers under /api/v1
      endpoints/     # One file per domain (health, chat, docs, ...)
    db/
      postgres.py    # SQLAlchemy async engine + Base + get_db() dependency
      chroma.py      # ChromaDB async client singleton
      ollama.py      # httpx wrapper + generate() helper for Ollama
    models/          # SQLAlchemy ORM models (import Base from db.postgres)
    schemas/         # Pydantic request/response schemas
```

All configuration is read from environment variables (see `backend/.env.example`). Copy it to `backend/.env` for local development.

The `/api/v1/health` endpoint checks connectivity to all three backing services (Postgres, ChromaDB, Ollama).

### Frontend

`frontend/` does not yet exist. Stack: React 18 + TypeScript + Tailwind CSS.
