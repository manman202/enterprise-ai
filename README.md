# Aiyedun — Enterprise AI Knowledge Staff

> Fully self-hosted, offline-first enterprise AI platform.
> LAN-only | AD-governed | Zero internet dependency (V1)

## Quick Links
- **Portal:** https://aiyedun.online (port 3000)
- **Admin:** https://admin.aiyedun.online (port 4000)
- **API:** https://api.aiyedun.online (port 8000)
- **GitLab:** https://gitlab.aiyedun.online

## Stack
- **LLM:** Ollama + Mistral 7B (local, offline)
- **Vector DB:** ChromaDB
- **Database:** PostgreSQL 16
- **Backend:** FastAPI (Python 3.12)
- **User Portal:** React 18 + TypeScript + Tailwind CSS (`frontend/`)
- **Admin Panel:** React 18 + TypeScript + Tailwind CSS (`admin/`)
- **CI/CD:** GitLab CE → GitHub mirror

## Services

| Service       | Port | Description                          |
|---------------|------|--------------------------------------|
| Backend API   | 8000 | FastAPI — all `/api/v1/*` endpoints  |
| User Portal   | 3000 | Chat, search, documents, settings    |
| Admin Panel   | 4000 | User management, health, documents   |
| PostgreSQL    | 5432 | Primary database (internal only)     |
| ChromaDB      | 8000 | Vector store (internal only)         |
| Ollama        | 11434| LLM inference (internal only)        |

## Getting Started

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Start the full stack
cd infra
docker compose up -d
```

See `CLAUDE.md` for detailed development instructions for each service.
