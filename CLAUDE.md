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

## Repository Status

The `backend/` and `frontend/` directories do not yet exist — the project is in its initial scaffolding phase. When adding them:
- Backend goes in `backend/` (Python 3.12, FastAPI)
- Frontend goes in `frontend/` (React 18 + TypeScript + Tailwind CSS)
- The GitLab CI lint jobs (`cd backend` / frontend checks) will need to be updated from placeholders to real commands once code exists.
