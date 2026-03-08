# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aiyedun is a fully self-hosted, offline-first enterprise AI knowledge platform. LAN-only, Active Directory-governed, zero internet dependency (V1).

**Stack:**
- **LLM:** Ollama + Mistral 7B (local, offline)
- **Vector DB:** ChromaDB
- **Database:** PostgreSQL 16
- **Backend:** FastAPI (Python 3.12)
- **User Portal:** React 18 + TypeScript + Tailwind CSS (`frontend/`)
- **Admin Panel:** React 18 + TypeScript + Tailwind CSS (`admin/`)
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
- All current jobs are marked `allow_failure: true`.

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

### Database migrations (Alembic)

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Generate a new migration from model changes
alembic revision --autogenerate -m "description"

# Downgrade one step
alembic downgrade -1
```

`alembic/env.py` imports `Base` from `app.db.postgres` and all models via `import app.models`. Add new model modules to that import so autogenerate detects them. The database URL is read from `settings.database_url` — no hardcoded URL in `alembic.ini`.

In Docker, `entrypoint.sh` runs `alembic upgrade head` automatically before starting uvicorn.

## Frontend Development

Located in `frontend/`. Vite + React 18 + TypeScript + Tailwind CSS.

```bash
cd frontend
npm install

# Dev server (port 3000, proxies /api → localhost:8000)
npm run dev

# Type-check + build
npm run build

# Lint
npm run lint
```

### Frontend structure

```
frontend/
  src/
    main.tsx        # Entry — BrowserRouter wraps App
    App.tsx         # Route definitions + nav shell
    index.css       # Tailwind directives
    api/client.ts   # Typed fetch wrapper (get/post against /api/v1)
    pages/          # One file per route
    components/     # Shared UI components
  index.html
  vite.config.ts    # Aliases @/ → src/, proxies /api to backend
  nginx.conf        # Production: SPA fallback + /api proxy to aiyedun-backend:8000
  Dockerfile        # Multi-stage: node build → nginx serve
```

In dev, Vite proxies `/api` to `http://localhost:8000` so no CORS config is needed. In production (Docker), nginx proxies `/api` to the `aiyedun-backend` container.

## Admin Panel Development

Located in `admin/`. Standalone Vite + React 18 + TypeScript + Tailwind CSS app. Restricted to users with `is_admin = true`. Runs on port **4000** (dev and production).

```bash
cd admin
npm install

# Dev server (port 4000, proxies /api → localhost:8000)
npm run dev

# Type-check + build
npm run build

# Lint
npm run lint
```

### Admin panel structure

```
admin/
  src/
    main.tsx              # Entry — BrowserRouter wraps App
    App.tsx               # Routes: /login, /dashboard, /users, /documents
    index.css             # Tailwind directives
    contexts/
      AuthContext.tsx     # Auth state; login() enforces is_admin check
    api/
      client.ts           # Typed fetch wrapper (TOKEN_KEY = aiyedun_admin_token)
      auth.ts             # login(), me() — AdminUser type
      admin.ts            # adminApi: listUsers, updateUser, deleteUser, listDocuments
      health.ts           # healthApi.check()
    pages/
      LoginPage.tsx       # Admin login (no registration link)
      DashboardPage.tsx   # Service health + user/document counts
      UsersPage.tsx       # Full user management table
      DocumentsPage.tsx   # Document list (read-only)
    components/
      ui/                 # Button, Badge, Card, Input, Spinner
      layout/             # Sidebar (with sign-out), PageHeader
  index.html
  vite.config.ts          # Aliases @/ → src/, proxies /api to backend
  nginx.conf              # Production: SPA fallback + /api proxy, port 4000
  Dockerfile              # Multi-stage: node build → nginx serve
```

The `AdminGuard` component in `App.tsx` redirects unauthenticated users to `/login`. The `login()` function in `AuthContext` rejects non-admin accounts with a clear error message before storing the token.
