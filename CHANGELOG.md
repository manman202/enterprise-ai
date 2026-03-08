# Changelog

All notable changes to Aiyedun are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-03-08

### Added

#### Infrastructure
- Docker Compose stack: PostgreSQL 16, ChromaDB, Ollama, FastAPI backend, React frontend, React admin panel
- Internal `aiyedun-internal` network (DB + AI services, no external access)
- `aiyedun-web` network for Nginx-accessible services
- Health checks on all six services
- `.env.example` with all environment variables documented

#### Automation Scripts
- `infra/scripts/setup.sh` — 20-step automated VPS provisioning from bare Ubuntu 24.04
- `infra/scripts/health-check.sh` — Docker containers, HTTPS endpoints, system resources
- `infra/scripts/backup.sh` — nightly PostgreSQL + ChromaDB + GitLab backup with 7-day retention
- `scripts/file_watcher_standalone.py` — standalone ingestion testing outside Docker

#### Backend (FastAPI + Python 3.12)
- **Authentication** — LDAP/Active Directory auth with JWT tokens; local DB fallback for dev
- **Models** — User, Conversation, Message, AuditLog, Document (SQLAlchemy async)
- **RAG Pipeline** — embed (all-MiniLM-L6-v2) → retrieve (ChromaDB) → generate (Ollama Mistral 7B)
- **Department RBAC** — ChromaDB queries filtered by user's AD department; Passerelle cross-dept zone
- **Document ingestion** — PDF, DOCX, XLSX, TXT with 500-char chunks and 50-char overlap
- **Chat API** — POST message, GET conversations/history, DELETE, WebSocket streaming
- **Document API** — upload, list, delete, reindex (admin only)
- **Admin API** — list/update/delete users, audit logs
- **File watcher** — watchdog-based auto-ingestion of WATCHED_PATHS directories on startup
- **Alembic migrations** — full schema up to Phase 5 models

#### Frontend — User Chat Portal (React 18 + TypeScript + Tailwind)
- Login page with deep blue gradient, icon inputs, password toggle
- Chat page — full sidebar (grouped conversations), MessageBubble with markdown, streaming typing indicator
- SourceCitation — collapsible document chips with department badges and relevance scores
- History page — searchable conversation table with open/delete actions
- Settings page — profile update + password change
- Dark/light mode, mobile-first with hamburger sidebar overlay

#### Admin Panel (React 18 + TypeScript + Tailwind + Recharts)
- Dashboard — 4 KPI cards, hourly/department charts (Recharts), service health grid, 30s auto-refresh
- Users — search, filter by role/status, initials avatars, activate/deactivate/promote/delete
- Knowledge — document table with department/status filters, re-index all, delete
- Audit Logs — filterable table, expandable JSON details, CSV export
- System Health — 10s auto-refresh, service status cards with latency
- Analytics — DAU, department breakdown, top topics, response time trends (Recharts)
- Deep blue sidebar with lucide-react icons, mobile hamburger overlay

#### CI/CD (GitLab)
- Stages: lint → test → build → security → deploy-dev → deploy-prod → mirror
- Backend lint: flake8 + black + isort
- Frontend/admin lint: tsc --noEmit + eslint
- Backend tests: pytest with PostgreSQL service, >60% coverage enforcement
- Docker builds tagged with commit SHA
- Trivy security scanning (report-only)
- Auto-deploy to dev on `develop` branch; manual deploy to production on `main`
- GitHub mirror on every push

#### Documentation
- `docs/SETUP.md` — 23-step guide from empty VPS to live production
- `docs/ARCHITECTURE.md` — full architecture with ASCII diagrams, planes, zones, RBAC
- `docs/API.md` — all endpoints documented with curl examples and WebSocket guide
- `docs/USER-GUIDE.md` — non-technical end-user guide with FAQ

#### Testing
- 45 backend tests: auth, chat, ingestion (chunking/extraction), RBAC department isolation
- In-memory SQLite for test isolation, mocked ChromaDB/Ollama/embeddings
- Frontend test suite with Vitest + Testing Library

### Technical Decisions
- **Offline-first**: zero internet dependency at runtime (Ollama + local embeddings)
- **LAN-only**: no public API exposure; all traffic via Nginx reverse proxy
- **No secrets in code**: all credentials via environment variables from `.env`
- **Stateless JWT**: no server-side session store required

---

## [Unreleased]

### Planned (V2)
- Microsoft Teams bot with Adaptive Cards
- Meeting transcription via Microsoft Graph API
- Multi-tenant support (multiple organizations)
- Real-time analytics from live query data
- GPU acceleration for Ollama (NVIDIA CUDA)
