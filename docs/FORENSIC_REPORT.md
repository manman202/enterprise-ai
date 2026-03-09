# Aiyedun — Forensic Audit Report

**Date:** 2026-03-09
**Auditor:** Claude Code (automated)
**VPS:** 46.62.212.115 | **Domain:** aiyedun.online
**Scope:** Full infrastructure, codebase, security, database, and operational state

---

## Executive Summary

Aiyedun is a fully self-hosted, offline-first enterprise AI knowledge platform built in two calendar days (2026-03-07 to 2026-03-09). It provides LAN-accessible AI chat powered by Mistral 7B via Ollama, with a React user portal, a React admin panel, a Tauri desktop agent, and a FastAPI backend with RAG (ChromaDB + sentence-transformers). The platform runs on a single Hetzner VPS (8 GB RAM, 76 GB OS disk + 90 GB volume) and is governed by GitLab CE with a full CI/CD pipeline mirrored to GitHub.

**Current production status:** All 7 core services are healthy and publicly reachable via HTTPS. Two users and 16 messages are recorded in the database. No documents have been indexed yet — the knowledge base is empty. The CI pipeline is failing on `lint:backend` in the latest run due to an unused import introduced by the analytics module.

**Overall health assessment: 🟡 YELLOW**
Services are running and accessible, but RAM is at 81 % utilisation, no production documents are indexed, the CI pipeline is currently broken (lint failure), AD/LDAP is not connected to a real directory server, and no disaster-recovery test has been performed.

---

## 1. Project Timeline

### Phase 0 — Project Initialisation (2026-03-07)

| Hash | Date | Description |
|------|------|-------------|
| `943f9e5` | 2026-03-07 | Initial commit |
| `a8d5c2c` | 2026-03-07 | feat(project): initial repository structure |
| `f874466` | 2026-03-07 | ci(pipeline): add GitLab CI/CD pipeline with mirror stage |
| `87608b6` | 2026-03-07 | infra(docker): add Docker Compose stack — postgres, chromadb, ollama |
| `bc4ba7f` | 2026-03-07 | docs: add CLAUDE.md with architecture and dev guidance |

### Phase 1 — Backend Scaffold (2026-03-07)

| Hash | Date | Description |
|------|------|-------------|
| `2417ec8` | 2026-03-07 | feat(backend): scaffold FastAPI backend with Postgres, ChromaDB, Ollama |
| `7e48ebb` | 2026-03-07 | feat(backend): scaffold Alembic async migrations |
| `0dce643` | 2026-03-07 | test(backend): scaffold pytest test suite with respx and ASGITransport |

### Phase 2 — Frontend & Infra Scaffold (2026-03-07)

| Hash | Date | Description |
|------|------|-------------|
| `6c2849e` | 2026-03-07 | feat(frontend): scaffold React 18 + TypeScript + Tailwind frontend |
| `430bfb5` | 2026-03-07 | infra(docker): add backend and frontend services to Compose stack |
| `f65fb1f` | 2026-03-07 | ci(pipeline): add build and deploy jobs for backend and frontend |
| `d45867d` | 2026-03-07 | test(frontend): scaffold Vitest + Testing Library test suite |

### Phase 3 — UI Components & Core Features (2026-03-07)

| Hash | Date | Description |
|------|------|-------------|
| `2f40b8c` | 2026-03-07 | feat(frontend): scaffold UI components and layout shell |
| `1a12322` | 2026-03-07 | test(frontend): add component tests for all UI and layout components |
| `7484324` | 2026-03-07 | feat(chat): scaffold end-to-end chat feature |
| `a07e3c4` | 2026-03-07 | feat(documents): scaffold end-to-end documents feature |
| `ed2b824` | 2026-03-07 | feat(search): scaffold end-to-end semantic search feature |

### Phase 4 — Auth, Admin & Settings (2026-03-08)

| Hash | Date | Description |
|------|------|-------------|
| `7c0dc03` | 2026-03-08 | feat(auth): scaffold end-to-end user authentication |
| `4de1492` | 2026-03-08 | feat(auth): scaffold user registration |
| `2d73fe1` | 2026-03-08 | feat(admin): scaffold end-to-end admin user management feature |
| `2f590c9` | 2026-03-08 | feat(settings): add user profile and password management |
| `0e57229` | 2026-03-08 | Add Claude agent rules for infra and backend |
| `f28e4be` | 2026-03-08 | Stop tracking local Claude settings |
| `45158dd` | 2026-03-08 | Ignore local Claude settings |

### Phase 5 — Full Backend & RAG Pipeline (2026-03-08)

| Hash | Date | Description |
|------|------|-------------|
| `eb8a9bc` | 2026-03-08 | feat(infra+docs): add Dockerfiles, Docker Compose stack, setup guide and full documentation |
| `25cc2e1` | 2026-03-08 | feat(backend): implement complete auth, RAG pipeline and chat API |
| `dd9439f` | 2026-03-08 | feat(frontend): build professional chat portal |
| `860bb98` | 2026-03-08 | chore: add dist/ to .gitignore and untrack build artifacts |
| `c2610e4` | 2026-03-08 | feat(ingestion): add automated file watcher service |
| `c78ce4f` | 2026-03-08 | test: add comprehensive backend test suite (45 tests passing) |

### Phase 6 — CI/CD Pipeline & v1.0.0 Release (2026-03-08)

| Hash | Date | Description |
|------|------|-------------|
| `422b79e` | 2026-03-08 | ci(pipeline): complete production CI/CD pipeline |
| `45d9e84` | 2026-03-08 | feat(release): Aiyedun v1.0.0 — production ready |
| `d2cb57c` | 2026-03-08 | chore(task): update phase status tracker — all phases complete |

### Phase 7 — Production Hardening & Bug Fixes (2026-03-08)

| Hash | Date | Description |
|------|------|-------------|
| `40037a8` | 2026-03-08 | fix(docker): add .dockerignore files and remove obsolete version key |
| `7832da8` | 2026-03-08 | fix(docker): fix healthchecks for containers without curl |
| `a1ae565` | 2026-03-08 | fix(docker): use 127.0.0.1 in frontend/admin healthcheck to avoid IPv6 issue |
| `799988a` | 2026-03-08 | fix(infra): expose backend port 8000 + remap admin to 3001 for nginx proxy |
| `9c2c134` | 2026-03-08 | fix(auth): replace passlib with direct bcrypt to fix bcrypt>=4.0 incompatibility |
| `dc455c6` | 2026-03-08 | fix(health): restructure response to {status, services} expected by admin dashboard |

### Phase 8 — CI Pipeline Repair & GitHub Mirror (2026-03-08)

| Hash | Date | Description |
|------|------|-------------|
| `555a1a6` | 2026-03-08 | fix(lint): fix all CI lint failures to unblock mirror:github stage |
| `c462d39` | 2026-03-08 | fix(lint): fix flake8 F821 noqa placement + re-run black on edited files |
| `412119b` | 2026-03-08 | fix(lint): add pyproject.toml with isort profile=black to fix formatting cycle |
| `7f7467c` | 2026-03-08 | fix(ci): add requirements-test.txt to avoid torch disk exhaustion in CI |
| `84cf60f` | 2026-03-08 | fix(test): fix PageHeader test selector |
| `7301176` | 2026-03-08 | feat(admin+backend): add real-time service health and knowledge sources manager |
| `4c358c6` | 2026-03-08 | ci(test): add allow_failure and 10m timeout to test:frontend |
| `426c3c2` | 2026-03-08 | fix(lint): remove unused imports in exchange and s3 connectors |
| `c7512fa` | 2026-03-08 | fix(lint): apply black/isort formatting to config.py and sync_scheduler.py |
| `7a4c69d` | 2026-03-08 | ci(build): add allow_failure to build stage |
| `cfaaacd` | 2026-03-08 | ci(mirror): fix alpine/git entrypoint override for mirror:github job |

### Phase 9 — Analytics, Advanced Upload & Desktop Agent (2026-03-08/09)

| Hash | Date | Description |
|------|------|-------------|
| `32a0f74` | 2026-03-08 | feat(analytics+upload): real analytics data and advanced file upload |
| `535d624` | 2026-03-09 | feat(desktop): add Tauri v2 desktop agent — tray, global shortcut, compact chat UI |
| `ac2b878` | 2026-03-09 | fix(desktop): complete all spec requirements — pass TypeScript build |

**Total commits:** 50 | **Development span:** 2 days (2026-03-07 → 2026-03-09)

---

## 2. Infrastructure

### 2.1 VPS Specifications

| Attribute | Value |
|-----------|-------|
| Provider | Hetzner Cloud |
| Hostname | ubuntu-8gb-hel1-1 |
| IP Address | 46.62.212.115 |
| OS | Ubuntu 24.04.4 LTS |
| Kernel | 6.8.0-101-generic (SMP PREEMPT_DYNAMIC) |
| Architecture | x86_64 |
| CPU | Shared vCPU (load avg: 0.67 / 0.54 / 0.46) |
| RAM | 7.6 GiB total, 6.1 GiB used, 1.5 GiB available |
| Swap | 8.0 GiB total, 3.6 GiB used |
| OS Disk (sda) | 76.3 GB |
| Volume (sdb) | 90 GB — mounted at `/mnt/HC_Volume_105055866` |
| Uptime | ~26 hours at time of audit |

### 2.2 Storage Layout

| Mount Point | Device | Size | Used | Free | Use% | Purpose |
|-------------|--------|------|------|------|------|---------|
| `/` | /dev/sda1 | 75 GB | 15 GB | 57 GB | 21% | OS, Docker images, app code |
| `/boot/efi` | /dev/sda15 | 253 MB | 146 KB | 252 MB | 1% | EFI boot |
| `/mnt/HC_Volume_105055866` | /dev/sdb | 89 GB | 55 GB | 30 GB | 65% | Docker volumes: Ollama (4.4 GB model), GitLab data, PostgreSQL data, ChromaDB data |
| `/run` | tmpfs | 776 MB | 1.7 MB | 774 MB | 1% | Runtime |
| `/dev/shm` | tmpfs | 3.8 GB | 0 | 3.8 GB | 0% | Shared memory |

**⚠️ Warning:** Volume `/mnt/HC_Volume_105055866` is at 65% (55 GB / 89 GB). Docker build cache alone consumes 26.54 GB. If left unmanaged, this will fill within weeks.

### 2.3 Network & Security

**Nginx reverse proxy** serves four virtual hosts over HTTPS:

| Domain | Backend | Notes |
|--------|---------|-------|
| `aiyedun.online` | `127.0.0.1:3000` | User portal + WebSocket at `/ws/` → :8000 |
| `admin.aiyedun.online` | `127.0.0.1:3001` | Admin panel |
| `api.aiyedun.online` | `127.0.0.1:8000` | REST API + WebSocket, `client_max_body_size 50M` |
| `gitlab.aiyedun.online` | `127.0.0.1:8929` | GitLab CE, `client_max_body_size 512M` |

All HTTP traffic redirects to HTTPS. WebSocket upgrade headers correctly forwarded.

**SSL Certificates** (Let's Encrypt via Certbot):

| Certificate | Issued | Expires | Auto-renew |
|-------------|--------|---------|------------|
| `aiyedun.online` (wildcard covers all subdomains) | 2026-03-07 | **2026-06-05** | Yes (Certbot) |

**Firewall:** UFW not in use. Host firewall state unknown — rely on Hetzner Cloud firewall rules (not audited here).

**Fail2ban:** Not installed / not verified.

**Open host ports observed:**
- `:443` — HTTPS (nginx)
- `:80` — HTTP (nginx, redirects to HTTPS)
- `:2222` — GitLab SSH
- `:3000` — Frontend (also exposed via nginx)

### 2.4 Docker Services

| Container | Image | Status | Health | Host Port(s) | Internal Network |
|-----------|-------|--------|--------|--------------|-----------------|
| `aiyedun-backend` | `aiyedun/backend:latest` (13 GB) | Up 4 h | ✅ healthy | `127.0.0.1:8000→8000` | internal |
| `aiyedun-frontend` | `aiyedun/frontend:latest` (74 MB) | Up 9 h | ✅ healthy | `0.0.0.0:3000→3000` | internal + web |
| `aiyedun-admin` | `aiyedun/admin:latest` (74 MB) | Up 4 h | ✅ healthy | `127.0.0.1:3001→4000` | internal |
| `aiyedun-postgres` | `postgres:16-alpine` (395 MB) | Up 9 h | ✅ healthy | — | internal only |
| `aiyedun-chromadb` | `chromadb/chroma:latest` (806 MB) | Up 9 h | ✅ healthy | — | internal only |
| `aiyedun-ollama` | `ollama/ollama:latest` (9.04 GB) | Up 9 h | ✅ healthy | — | internal only |
| `gitlab` | `gitlab/gitlab-ce:latest` (6.07 GB) | Up 9 h | ✅ healthy | `2222→22`, `8929→80` | bridge |
| `gitlab-runner` | `gitlab/gitlab-runner:latest` (473 MB) | Up 8 h | — | — | bridge |

**Docker networks:**
- `infra_aiyedun-internal` — bridge network for all application services (postgres, chromadb, ollama, backend)
- `infra_aiyedun-web` — bridge network for public-facing services

**Docker volumes:**
- `infra_postgres_data` — PostgreSQL data
- `infra_chroma_data` — ChromaDB vector data
- `infra_ollama_data` — Ollama model cache (mistral:latest, 4.4 GB)
- `infra_backup_data` — Backup target volume

**⚠️ Docker storage summary:**
- Images: 48.5 GB (97% reclaimable from stopped containers — but all are active)
- Build cache: 26.54 GB (12.8 GB reclaimable)
- Containers: 102.5 MB in use

---

## 3. Codebase Inventory

### 3.1 Repository Structure

```
enterprise-ai/
├── backend/                    FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/endpoints/   REST API handlers (9 modules)
│   │   ├── core/               Config, auth, embeddings, RAG, security
│   │   ├── db/                 Postgres, ChromaDB, Ollama clients
│   │   ├── models/             SQLAlchemy ORM models (6 models)
│   │   ├── schemas/            Pydantic request/response schemas
│   │   └── services/           Ingestion, file watcher, sync scheduler
│   │       └── connectors/     5 knowledge source connectors
│   ├── alembic/                DB migrations (4 versions)
│   ├── tests/                  pytest test suite (11 test files)
│   ├── requirements.txt        Production dependencies (16 packages)
│   ├── requirements-test.txt   CI test dependencies (no torch)
│   ├── requirements-dev.txt    Dev dependencies
│   ├── pyproject.toml          black + isort configuration
│   ├── Dockerfile
│   └── entrypoint.sh           Runs alembic upgrade head then uvicorn
├── frontend/                   User portal (React 18 + TypeScript + Tailwind)
│   ├── src/
│   │   ├── pages/              10 pages (Chat, History, Documents, Search…)
│   │   ├── components/         30+ components with unit tests
│   │   ├── api/                Typed fetch wrappers
│   │   └── contexts/           AuthContext
│   └── Dockerfile
├── admin/                      Admin panel (React 18 + TypeScript + Tailwind)
│   ├── src/
│   │   ├── pages/              8 pages (Dashboard, Users, Knowledge, Analytics…)
│   │   ├── components/         UI + layout + knowledge upload modal
│   │   └── api/                5 API client modules
│   └── Dockerfile
├── desktop/                    Tauri v2 desktop agent
│   ├── src/                    React 19 + TypeScript UI
│   │   ├── pages/              4 pages (Login, Chat, HistoryPanel, SettingsPanel)
│   │   └── components/         SourceCitation, NotificationManager
│   ├── src-tauri/              Rust backend
│   │   ├── src/                main.rs, lib.rs, commands.rs
│   │   └── icons/              Full icon set (all platforms)
│   └── package.json
├── infra/
│   ├── docker-compose.yml      Full stack definition (6 services)
│   └── scripts/
│       ├── backup.sh           PostgreSQL + ChromaDB backup
│       └── health-check.sh     Service health check
├── docs/                       Project documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── USER-GUIDE.md
│   └── FORENSIC_REPORT.md      ← This file
├── scripts/
│   └── file_watcher_standalone.py
├── .gitlab-ci.yml              Full CI/CD pipeline definition
├── CLAUDE.md                   AI assistant instructions
├── TASK.md                     Phase tracker (all phases complete)
├── CHANGELOG.md
└── README.md
```

### 3.2 Lines of Code

| Component | Files | Lines of Code |
|-----------|-------|--------------|
| Backend (Python) | 63 source + 11 test | ~6,800 |
| Frontend (TypeScript/TSX) | 74 | ~4,200 |
| Admin (TypeScript/TSX) | 25 | ~3,500 |
| Desktop (TypeScript/TSX) | 11 | ~2,100 |
| Desktop Rust | 3 | ~190 |
| Infra / Shell scripts | 2 | ~200 |
| YAML / Config | ~12 | ~600 |
| Markdown docs | ~12 | ~2,000 |
| **Total** | **~213** | **~19,601** |

### 3.3 Backend API Endpoints

All endpoints are mounted under `/api/v1`.

**Auth** — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | None | Login with username + password → JWT token |
| POST | `/auth/register` | None | Self-register new user account |
| GET | `/auth/me` | User | Get current user profile |
| POST | `/auth/logout` | User | Logout (client clears token) |
| POST | `/auth/refresh` | User | Refresh JWT token |

**Chat** — `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat/message` | User | Send message, get RAG response (also via WebSocket) |
| GET | `/chat/conversations` | User | List user's conversations |
| GET | `/chat/history/{id}` | User | Get message history for a conversation |
| DELETE | `/chat/conversations/{id}` | User | Delete a conversation |
| WS | `/ws/chat/{conversation_id}` | Token query param | Streaming chat via WebSocket |

**Documents** — `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/documents` | Admin | Upload and ingest a document |
| GET | `/documents` | User | List indexed documents |
| DELETE | `/documents/{id}` | Admin | Delete document from index |
| POST | `/documents/reindex` | Admin | Reindex all documents |

**Search** — `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/search` | User | Semantic similarity search |

**Settings** — `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/me` | User | Update profile (full_name, department) |
| POST | `/me/password` | User | Change password |

**Admin** — `/api/v1/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | List all users |
| PATCH | `/admin/users/{id}` | Admin | Update user (is_active, is_admin, etc.) |
| DELETE | `/admin/users/{id}` | Admin | Delete user |

**Knowledge Sources** — `/api/v1/knowledge-sources`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `` | Admin | List all knowledge sources |
| GET | `/{id}` | Admin | Get single knowledge source |
| POST | `` | Admin | Create new knowledge source |
| PATCH | `/{id}` | Admin | Update knowledge source config |
| DELETE | `/{id}` | Admin | Delete knowledge source |
| POST | `/{id}/sync` | Admin | Trigger manual sync |
| GET | `/{id}/sync-history` | Admin | Get sync history |
| POST | `/test-connection` | Admin | Test connector credentials |
| POST | `/{id}/upload` | Admin | Direct file upload to source |
| GET | `/scan-path` | Admin | Scan a local path for files |

**Analytics** — `/api/v1/analytics`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/overview` | Admin | KPI summary (users, queries, docs, uptime) |
| GET | `/queries-per-hour` | Admin | Hourly query chart data |
| GET | `/queries-per-department` | Admin | Queries by department |
| GET | `/top-documents` | Admin | Most-referenced documents |
| GET | `/daily-active-users` | Admin | DAU trend |
| GET | `/response-times` | Admin | Response time distribution |

**Health** — `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Simple health check (returns `{status, services}`) |
| GET | `/health/services` | None | Detailed health with system metrics |

### 3.4 Database Schema

**Table: `users`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID primary key |
| username | varchar | NOT NULL | UNIQUE |
| email | varchar | NOT NULL | UNIQUE |
| hashed_password | varchar | NULL | NULL for LDAP-only accounts |
| is_active | boolean | NOT NULL | Default true |
| is_admin | boolean | NOT NULL | Default false |
| full_name | varchar | NULL | Display name |
| department | varchar | NULL | Used for analytics |
| ad_groups | text | NULL | JSON list of AD group memberships |
| last_login | timestamp | NULL | Last successful login |
| created_at | timestamp | NOT NULL | |

**Table: `conversations`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID |
| user_id | varchar | NOT NULL | FK → users.id |
| title | varchar | NOT NULL | Auto-generated from first message |
| message_count | integer | NOT NULL | Denormalized counter |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

**Table: `messages`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID |
| conversation_id | varchar | NOT NULL | FK → conversations.id |
| role | varchar | NOT NULL | `"user"` or `"assistant"` |
| content | text | NOT NULL | Message text |
| sources | text | NULL | JSON list of RAG source citations |
| tokens_used | integer | NULL | Token count from Ollama |
| created_at | timestamp | NOT NULL | |

**Table: `documents`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID |
| filename | varchar | NOT NULL | Original filename |
| size | integer | NOT NULL | Bytes |
| filepath | varchar | NULL | Server-side path |
| department | varchar | NULL | Routing metadata |
| file_hash | varchar | NULL | SHA-256 for dedup |
| status | varchar | NOT NULL | `pending` / `indexed` / `error` |
| chunks_count | integer | NULL | Number of ChromaDB chunks |
| ingested_at | timestamp | NULL | |
| error_message | text | NULL | Ingestion error detail |
| created_at | timestamp | NOT NULL | |

**Table: `knowledge_sources`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID |
| name | varchar | NOT NULL | Display name |
| department | varchar | NULL | |
| source_type | varchar | NOT NULL | `local` / `smb` / `exchange` / `sharepoint` / `s3` |
| config | text | NULL | JSON connector config (encrypted in future) |
| status | varchar | NOT NULL | `idle` / `syncing` / `error` |
| is_active | boolean | NOT NULL | |
| last_sync_at | timestamp | NULL | |
| last_sync_status | varchar | NULL | |
| last_sync_count | integer | NULL | Files synced |
| last_error | text | NULL | |
| created_at | timestamp | NOT NULL | |
| created_by | varchar | NULL | FK → users.id |

**Table: `audit_logs`**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | varchar | NOT NULL | UUID |
| user_id | varchar | NULL | FK → users.id (NULL for system actions) |
| action | varchar | NOT NULL | e.g. `login`, `upload_document` |
| resource | varchar | NULL | Resource identifier |
| outcome | varchar | NOT NULL | `success` / `failure` |
| details | text | NULL | JSON extra context |
| ip_address | varchar | NULL | Client IP |
| created_at | timestamp | NOT NULL | |

### 3.5 Frontend Pages (User Portal)

| Page | Route | Description |
|------|-------|-------------|
| LoginPage | `/login` | AD/local login with gradient background |
| RegisterPage | `/register` | Self-registration form |
| ChatPage | `/chat` | Primary AI chat interface with sidebar |
| HistoryPage | `/history` | Browse past conversations |
| DocumentsPage | `/documents` | Browse indexed documents |
| SearchPage | `/search` | Semantic similarity search |
| AdminPage | `/admin` | User management (admin only, deprecated by admin panel) |
| HealthPage | `/health` | Service status page |
| SettingsPage | `/settings` | Profile + password management |

### 3.6 Admin Pages (Admin Panel)

| Page | Route | Description |
|------|-------|-------------|
| LoginPage | `/login` | Admin-only login (rejects non-admins) |
| DashboardPage | `/dashboard` | KPI cards, service health grid, system metrics |
| UsersPage | `/users` | Full user management (CRUD, toggle admin/active) |
| DocumentsPage | `/documents` | Read-only document list |
| KnowledgePage | `/knowledge` | Knowledge sources CRUD + sync management |
| AnalyticsPage | `/analytics` | Query trends, department breakdown, response times |
| AuditPage | `/audit` | Audit log viewer |
| HealthPage | `/health` | Detailed service health page |

### 3.7 Desktop Agent (Tauri v2)

| Feature | Implementation | Status |
|---------|---------------|--------|
| System tray | Tauri tray-icon plugin | ✅ Implemented |
| Global shortcut Ctrl+Shift+A | tauri-plugin-global-shortcut | ✅ Implemented |
| Autostart on login | tauri-plugin-autostart | ✅ Implemented |
| Encrypted token store | tauri-plugin-store | ✅ Implemented |
| OS notifications | tauri-plugin-notification | ✅ Implemented |
| Login page | React (420 px compact) | ✅ Implemented |
| Chat page with streaming | WebSocket + React | ✅ Implemented |
| History panel | Slide-in drawer | ✅ Implemented |
| Settings panel | Slide-in drawer | ✅ Implemented |
| Source citations | Inline chips with tooltip | ✅ Implemented |
| File upload | `<input type="file">` + API | ✅ Implemented |
| AppImage / .deb build | Tauri bundler (CI job) | ✅ Defined (CI allow_failure) |

### 3.8 Knowledge Source Connectors

| Type | Library | Source File | Status |
|------|---------|-------------|--------|
| Local filesystem | Python stdlib + aiofiles | `connectors/local.py` | ✅ Implemented |
| SMB/CIFS file share | smbprotocol 1.15.0 | `connectors/smb.py` | ✅ Implemented |
| Exchange / Outlook EWS | exchangelib 5.6.0 | `connectors/exchange.py` | ✅ Implemented |
| Exchange IMAP | imaplib (stdlib) | `connectors/exchange.py` | ✅ Implemented |
| SharePoint / Graph API | msal 1.32.3 | `connectors/sharepoint.py` | ✅ Implemented |
| S3-compatible storage | boto3 1.37.23 | `connectors/s3.py` | ✅ Implemented |

All connectors implement the `BaseConnector` abstract class with `test_connection()`, `list_files()`, `download_file()`, and `sync()` methods.

---

## 4. CI/CD Pipeline

### 4.1 Pipeline Stages

| Stage | Job | Current Status | `allow_failure` | Notes |
|-------|-----|----------------|-----------------|-------|
| lint | lint:backend | ❌ FAILING | No | F401 unused import in `analytics.py:27` introduced by latest commit |
| lint | lint:frontend | ✅ Passing | No | ESLint v9 flat config |
| lint | lint:admin | ✅ Passing | No | ESLint v9 flat config |
| test | test:backend | ❌ fails | Yes | Disk exhaustion: sentence-transformers/torch pulls ~3 GB in CI |
| test | test:frontend | ❌ fails | Yes | Coverage generation hangs; killed by 10-minute timeout |
| build | build:backend | ❌ fails | Yes | GitLab Container Registry not configured |
| build | build:frontend | ❌ fails | Yes | Same — registry credentials missing |
| build | build:admin | ❌ fails | Yes | Same |
| build | build:desktop | ❌ fails | Yes | webkit2gtk-4.1 + Rust compile in CI (very slow) |
| security | security:scan | ❌ fails | Yes | Depends on build artifacts |
| deploy-prod | deploy:prod | manual | Yes | SSH deploy — not triggered |
| mirror | mirror:github | ✅ Passing (pipeline 43) | Yes | `alpine/git` image with `entrypoint: [""]` |

**Latest pipeline:** #46 — FAILED on `lint:backend` (unused import in `analytics.py`)
**Last fully successful pipeline:** #43 (2026-03-08)

### 4.2 GitHub Mirror

Mirror target: `github.com/manman202/enterprise-ai`
Mirror mechanism: `git push --force` from `alpine/git` container
Authentication: `GITHUB_TOKEN` CI variable (PAT)

**Last 5 commits mirrored (confirmed on GitHub API):**

| Hash | Description |
|------|-------------|
| `ac2b878` | fix(desktop): complete all spec requirements — pass TypeScript build |
| `535d624` | feat(desktop): add Tauri v2 desktop agent — tray, global shortcut, compact chat UI |
| `32a0f74` | feat(analytics+upload): real analytics data and advanced file upload |
| `cfaaacd` | ci(mirror): fix alpine/git entrypoint override for mirror:github job |
| `7a4c69d` | ci(build): add allow_failure to build stage |

**Mirror status:** ✅ Confirmed working as of pipeline #43. Pipeline #46 failed before reaching mirror stage due to lint:backend failure.

---

## 5. Security Audit

### 5.1 Secrets Management

| Check | Status | Notes |
|-------|--------|-------|
| `.env` tracked in git | ✅ SAFE | Listed in `.gitignore`, confirmed not tracked (`git ls-files` returns nothing) |
| `Rustom.md` tracked in git | ✅ SAFE | Explicitly listed in `.gitignore` |
| `.env.*` files tracked | ✅ SAFE | Covered by `.gitignore` pattern `.env.*` |
| `*.pem` / `*.key` tracked | ✅ SAFE | Covered by `.gitignore` |
| `secrets/` directory tracked | ✅ SAFE | Covered by `.gitignore` |
| `.claude/` settings tracked | ✅ SAFE | Removed and added to `.gitignore` |
| Hardcoded passwords in source | ✅ NONE FOUND | All credentials loaded from environment variables via `config.py` |
| `SECRET_KEY` default value | ⚠️ WARNING | Default is `"changeme"` — must be overridden via `.env` in production |
| Connector config encryption | ⚠️ GAP | `knowledge_sources.config` stores connector credentials as plain JSON in PostgreSQL. Encryption noted as future work. |

### 5.2 Authentication

| Aspect | Implementation | Status |
|--------|---------------|--------|
| Auth method | JWT (HS256) + bcrypt password hashing | ✅ Implemented |
| Token storage | `Authorization: Bearer` header | ✅ Standard |
| Token lifetime | 8 hours (configurable via `JWT_EXPIRE_HOURS`) | ✅ |
| LDAP/AD integration | ldap3 library, `ad_server` config | ⚠️ Code present, not connected to real AD |
| Password hashing | `bcrypt.hashpw()` / `bcrypt.checkpw()` directly (passlib removed) | ✅ |
| RBAC — user endpoints | All protected with `Depends(get_current_user)` | ✅ |
| RBAC — admin endpoints | All protected with `Depends(get_current_admin)` | ✅ |
| Admin panel guard | `AdminGuard` component in `admin/src/App.tsx` | ✅ |
| Admin login check | `is_admin = true` enforced in `AuthContext.login()` | ✅ |
| Public endpoints | `/auth/login`, `/auth/register`, `/health`, `/health/services` | ✅ Intentional |

### 5.3 Network Security

**CORS configuration:**
CORS is configured via `settings.allowed_origins` (comma-separated list from environment variable). The `CORSMiddleware` uses `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. In production, `ALLOWED_ORIGINS` should be set to the exact frontend domains.

**Internal network isolation:**
- PostgreSQL, ChromaDB, and Ollama are on the `infra_aiyedun-internal` Docker bridge network only — not exposed to host
- Backend binds to `127.0.0.1:8000` — accessible only via nginx proxy
- Admin binds to `127.0.0.1:3001` — accessible only via nginx proxy
- Only frontend has a `0.0.0.0:3000` binding (also proxied via nginx)

**External attack surface:**
- Port 80/443 (nginx — correctly proxied)
- Port 2222 (GitLab SSH — brute force risk)
- No UFW firewall confirmed active

---

## 6. Known Issues & Technical Debt

| # | Issue | Severity | Component | Recommended Fix |
|---|-------|----------|-----------|-----------------|
| 1 | `lint:backend` failing in pipeline #46 — unused import `app.models.user.User` in `analytics.py:27` | **HIGH** | CI / Backend | Remove the unused import |
| 2 | `test:backend` always fails — sentence-transformers/torch pulls ~3 GB, exhausts CI disk (5.4 GB free on `/dev/sdb`) | **HIGH** | CI / Backend | ChromaDB mock in test conftest not preventing heavy deps; consider Docker layer caching or larger CI runner |
| 3 | `test:frontend` coverage generation hangs — killed by 10-minute timeout | **MEDIUM** | CI / Frontend | Investigate V8 coverage provider hanging; try `--reporter=text` only in CI |
| 4 | `build:*` — GitLab Container Registry not configured | **MEDIUM** | CI / Infra | Enable registry in GitLab admin settings, or configure an external registry |
| 5 | AD/LDAP not connected to real directory server — `ad_server` env var is empty | **HIGH** | Backend / Auth | Configure with actual AD server details for production use |
| 6 | Knowledge sources table empty — no documents indexed yet | **HIGH** | Backend / Data | Configure at least one knowledge source and trigger sync |
| 7 | ChromaDB has no collections — knowledge base is empty | **HIGH** | ChromaDB / RAG | Index documents; RAG returns no sources until then |
| 8 | RAM at 81.3% (6.1 GB / 7.6 GB used) — swap in use at 45% | **HIGH** | Infra | Upgrade to 16 GB RAM instance, or offload GitLab to separate server |
| 9 | `/mnt/HC_Volume_105055866` at 65% (55 GB / 89 GB) — 26.5 GB is Docker build cache | **MEDIUM** | Infra | Run `docker builder prune` periodically; add automated cleanup cron |
| 10 | `api.aiyedun.online/health` returns 404 — no route at `/health` (correct path is `/api/v1/health/services`) | **LOW** | Backend / Nginx | Add nginx alias or backend redirect from `/health` to `/api/v1/health` |
| 11 | Connector credentials stored as plain JSON in `knowledge_sources.config` column | **MEDIUM** | Backend / Security | Encrypt connector config at rest using Fernet or similar |
| 12 | `SECRET_KEY` defaults to `"changeme"` in config.py | **MEDIUM** | Backend / Security | Verify `SECRET_KEY` is set to a strong 32+ char value in production `.env` |
| 13 | No UFW firewall active — GitLab SSH port 2222 exposed to internet | **MEDIUM** | Infra / Security | Enable UFW with allow 80, 443, 2222 only; block all else |
| 14 | Audit logs table is empty — no events recorded | **LOW** | Backend / Audit | Verify audit log writes are working; add login/logout audit events |
| 15 | Desktop agent Rust/Tauri build not tested locally — `build:desktop` CI job cannot complete | **LOW** | CI / Desktop | Install Rust + webkit2gtk-4.1 on CI runner or use a pre-built container |
| 16 | Backend Docker image is 13 GB (sentence-transformers + torch) | **MEDIUM** | Backend / Docker | Multi-stage Dockerfile to separate model from app; or use ONNX runtime |

---

## 7. Database State

### Tables (as of audit date)

| Table | Row Count | Notes |
|-------|-----------|-------|
| `messages` | 16 | Test conversation data |
| `users` | 2 | 1 regular user + 1 admin (test accounts) |
| `conversations` | 1 | One test conversation |
| `alembic_version` | 1 | Migration tracking |
| `knowledge_sources` | 0 | No sources configured |
| `audit_logs` | 0 | Audit events not being written |
| `documents` | 0 | No documents indexed |

### Alembic Migrations Applied

| Version | Description |
|---------|-------------|
| 0001 | Add documents table |
| 0002 | Add users table |
| 0003 | Add is_admin to users |
| 0004 | Phase 5 models (conversations, messages, knowledge_sources, audit_logs) |

### ChromaDB

- **Collections:** 0 — no documents have been vectorized
- **Access:** Internal Docker network only (port 8000 on `aiyedun-chromadb`)
- **Persistence:** `infra_chroma_data` Docker volume

### Ollama Models Loaded

| Model | Size | Status |
|-------|------|--------|
| `mistral:latest` | 4.4 GB | ✅ Loaded and responding |

Ollama is responding healthy with the model active. RAG generation is ready; it is the document indexing that is missing.

---

## 8. Public URLs Status

Tested at 2026-03-09 01:22 UTC:

| URL | HTTP Status | Response Time | Notes |
|-----|-------------|--------------|-------|
| `https://aiyedun.online` | **200** | 123 ms | ✅ User portal serving correctly |
| `https://admin.aiyedun.online` | **200** | 74 ms | ✅ Admin panel serving correctly |
| `https://api.aiyedun.online/health` | **404** | 124 ms | ⚠️ No route at `/health`; use `/api/v1/health/services` |
| `https://api.aiyedun.online/api/v1/health/services` | **200** | 500 ms | ✅ All 7 services healthy |
| `https://gitlab.aiyedun.online` | **302** | 80 ms | ✅ Redirects to `/users/sign_in` (expected) |

**Live health response (from API):**
```json
{
  "services": {
    "postgres":  { "status": "healthy", "response_ms": 67 },
    "chromadb":  { "status": "healthy", "response_ms": 63 },
    "ollama":    { "status": "healthy", "response_ms": 48, "model_loaded": "mistral:latest" },
    "backend":   { "status": "healthy", "response_ms": 1 },
    "frontend":  { "status": "healthy", "response_ms": 43 },
    "admin":     { "status": "healthy", "response_ms": 35 },
    "gitlab":    { "status": "healthy", "response_ms": 251 }
  },
  "system": {
    "cpu_percent": 10.2, "ram_percent": 81.3,
    "ram_used_gb": 5.8, "ram_total_gb": 7.6,
    "disk_used_gb": 54, "disk_total_gb": 88, "disk_percent": 64.6,
    "swap_used_gb": 3.6, "swap_total_gb": 8.0
  }
}
```

---

## 9. Backup & Recovery

### Backup Schedule

| Job | Schedule | Command |
|-----|----------|---------|
| PostgreSQL + ChromaDB backup | Daily at 02:00 (crontab of `devops` user) | `/opt/aiyedun/enterprise-ai/infra/scripts/backup.sh` |

### Backup Location

```
/opt/aiyedun/backups/
├── postgres/   aiyedun_pg_YYYYMMDD_HHMMSS.sql.gz
├── chroma/     aiyedun_chroma_YYYYMMDD_HHMMSS.tar.gz
└── backup.log
```

### Last Backup (from log)

| Timestamp | PostgreSQL | ChromaDB | Total Size |
|-----------|------------|----------|------------|
| 2026-03-08 16:08:40 | `aiyedun_pg_20260308_160840.sql.gz` (4.0 KB) | `aiyedun_chroma_20260308_160840.tar.gz` (4.0 KB) | 24 KB |

**Note:** Backup sizes are 4 KB because the database and ChromaDB are essentially empty (test data only). In production with real data these will be significantly larger.

### Retention Policy

Backups older than 7 days are automatically deleted. Currently 1 backup set retained.

### Recovery Procedure (Brief)

1. Stop backend: `docker compose -f infra/docker-compose.yml stop backend`
2. Restore PostgreSQL: `zcat backup.sql.gz | docker exec -i aiyedun-postgres psql -U aiyedun_user aiyedun`
3. Restore ChromaDB: `docker run --rm -v infra_chroma_data:/data -v /opt/aiyedun/backups/chroma:/backup busybox tar -xzf /backup/aiyedun_chroma_YYYYMMDD.tar.gz -C /data`
4. Restart all services: `docker compose -f infra/docker-compose.yml up -d`

**⚠️ Backup gap:** Ollama model is not backed up (it can be re-pulled with `ollama pull mistral`). GitLab data is not backed up by this script (GitLab has its own backup mechanism).

---

## 10. Next Steps & Roadmap

### Immediate — This Week (Critical Fixes)

1. **Fix `lint:backend` pipeline** — remove unused `User` import in `analytics.py:27`. This unblocks mirror:github.
2. **Configure AD/LDAP** — connect to real Active Directory server; test login with company credentials.
3. **Index first knowledge source** — configure a local directory or SMB share and trigger sync to populate ChromaDB. Without documents, RAG returns no results.
4. **Enable UFW firewall** — `ufw allow 80,443,2222/tcp && ufw enable` to reduce attack surface.
5. **Verify `SECRET_KEY`** — confirm `.env` has a strong, random 32+ character secret key (not `"changeme"`).
6. **Clean Docker build cache** — `docker builder prune -f` to reclaim ~12.8 GB on the volume.

### Short Term — This Month (Feature Completion)

1. **Enable GitLab Container Registry** — configure in GitLab Admin → Settings → Registry; update CI variables. This will make `build:*` jobs pass.
2. **Fix `test:frontend` coverage** — disable cobertura reporter in CI or switch to `--coverage.provider=istanbul` to fix hang.
3. **Encrypt knowledge source credentials** — encrypt `knowledge_sources.config` at rest before connecting real SMB/Exchange credentials.
4. **Add audit log events** — ensure login, logout, document upload, and admin actions write to `audit_logs`.
5. **Load test Ollama** — measure response time under concurrent users; Mistral 7B on CPU is ~30–60 s per response.
6. **RAM monitoring alert** — set up alert when RAM > 85% (currently at 81%). Consider offloading GitLab CE to a separate VM.
7. **Test desktop agent build** — build AppImage locally on a Linux machine with webkit2gtk-4.1; distribute to test users.
8. **User onboarding** — create user accounts for actual employees; test end-to-end SSO via AD.

### Long Term — V2 Roadmap

1. **Multi-server deployment** — separate GitLab onto its own server; add a dedicated GPU server for Ollama to enable sub-5-second responses.
2. **Model upgrade** — evaluate Mistral 7B Instruct v0.3, Llama 3.1 8B, or Phi-4 for better French language support.
3. **Real-time knowledge sync** — webhooks from SharePoint/Exchange for instant document ingestion without polling.
4. **Teams integration** — bot that answers questions directly in Microsoft Teams channels.
5. **Role-based knowledge access** — restrict which documents/sources each AD group can access via RAG.
6. **Document chunking strategy** — evaluate semantic chunking vs. fixed-size chunking for better retrieval quality.
7. **Analytics persistence** — real-time analytics stored in TimescaleDB or ClickHouse instead of computed on-demand from messages table.
8. **Mobile-responsive web** — optimise chat portal for mobile (currently desktop-first).
9. **Feedback loop** — thumbs up/down on responses to tune retrieval quality.
10. **Automated quality testing** — RAG evaluation with RAGAS or similar framework.

---

## Appendix A — Environment Variables

All variables are loaded by `backend/app/core/config.py` via `pydantic-settings`.

| Variable | Required | Set in Prod | Description |
|----------|----------|-------------|-------------|
| `APP_ENV` | No | Yes | `development` or `production` |
| `APP_PORT` | No | No | Backend port (default: 8000) |
| `SECRET_KEY` | **Yes** | ⚠️ Verify | JWT signing secret (min 32 chars) |
| `JWT_EXPIRE_HOURS` | No | No | Session duration (default: 8) |
| `ALLOWED_ORIGINS` | No | Should be set | CORS allowed origins (comma-separated) |
| `POSTGRES_HOST` | **Yes** | Yes | PostgreSQL hostname |
| `POSTGRES_PORT` | No | No | PostgreSQL port (default: 5432) |
| `POSTGRES_DB` | **Yes** | Yes | Database name |
| `POSTGRES_USER` | **Yes** | Yes | Database user |
| `POSTGRES_PASSWORD` | **Yes** | Yes | Database password |
| `CHROMA_HOST` | **Yes** | Yes | ChromaDB hostname |
| `CHROMA_PORT` | No | No | ChromaDB port (default: 8000) |
| `OLLAMA_HOST` | **Yes** | Yes | Ollama hostname |
| `OLLAMA_PORT` | No | No | Ollama port (default: 11434) |
| `OLLAMA_MODEL` | No | No | Model name (default: `mistral`) |
| `AD_SERVER` | No | ❌ Not set | LDAP URL e.g. `ldap://192.168.1.10` |
| `AD_DOMAIN` | No | ❌ Not set | e.g. `yourcompany.local` |
| `AD_BASE_DN` | No | ❌ Not set | e.g. `DC=yourcompany,DC=local` |
| `AD_SERVICE_ACCOUNT` | No | ❌ Not set | Read-only AD service account |
| `AD_SERVICE_PASSWORD` | No | ❌ Not set | Service account password |
| `EMBEDDING_MODEL` | No | No | sentence-transformers model (default: `all-MiniLM-L6-v2`) |
| `WATCHED_PATHS` | No | No | JSON array of `{path, department}` for file watcher |
| `PASSERELLE_PATH` | No | No | Manual document drop zone path |
| `TEAMS_APP_ID` | No | ❌ Not set | Microsoft Teams bot app ID |
| `TEAMS_APP_PASSWORD` | No | ❌ Not set | Teams bot password |
| `TEAMS_TENANT_ID` | No | ❌ Not set | Azure AD tenant ID |
| `FRONTEND_PORT` | No | No | Frontend nginx port (default: 3000) |
| `ADMIN_PORT` | No | No | Admin nginx port (default: 4000) |
| `GITLAB_URL` | No | No | GitLab web URL for health check |

---

## Appendix B — Dependency List

### Backend (Python) — `requirements.txt`

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.115.6 | Web framework |
| uvicorn[standard] | 0.32.1 | ASGI server |
| python-multipart | 0.0.20 | File upload support |
| websockets | 13.1 | WebSocket protocol |
| pydantic-settings | 2.7.0 | Environment config |
| email-validator | 2.2.0 | Email validation |
| sqlalchemy[asyncio] | 2.0.36 | ORM (async) |
| asyncpg | 0.30.0 | PostgreSQL async driver |
| alembic | 1.14.0 | Database migrations |
| chromadb | 0.6.3 | Vector store client |
| httpx | 0.28.1 | Async HTTP client |
| PyJWT | 2.10.1 | JWT encoding/decoding |
| bcrypt | 4.3.0 | Password hashing |
| ldap3 | 2.9.1 | LDAP/AD client |
| sentence-transformers | 3.3.1 | Local embedding model |
| pypdf | 4.3.1 | PDF text extraction |
| python-docx | 1.1.2 | DOCX text extraction |
| openpyxl | 3.1.5 | XLSX text extraction |
| aiofiles | 24.1.0 | Async file I/O |
| watchdog | 6.0.0 | File system monitoring |
| psutil | 6.1.1 | System metrics |
| smbprotocol | 1.15.0 | SMB/CIFS connector |
| exchangelib | 5.6.0 | Exchange/EWS connector |
| msal | 1.32.3 | SharePoint/Graph API auth |
| boto3 | 1.37.23 | S3-compatible storage |

### Frontend (npm) — `frontend/package.json`

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM renderer |
| react-router-dom | ^6.28.0 | SPA routing |
| react-markdown | ^10.1.0 | Render AI responses as Markdown |
| lucide-react | ^0.577.0 | Icon library |

**Dev deps:** TypeScript 5.7, Vite 6, Vitest 2, Testing Library, Tailwind CSS 3, ESLint 9

### Admin (npm) — `admin/package.json`

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM renderer |
| react-router-dom | ^6.26.2 | SPA routing |
| recharts | ^2.13.0 | Charts (analytics + dashboard) |
| lucide-react | ^0.577.0 | Icon library |

**Dev deps:** TypeScript 5.5, Vite 5, Tailwind CSS 3, ESLint 9

### Desktop (npm) — `desktop/package.json`

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.1.0 | UI framework |
| react-dom | ^19.1.0 | DOM renderer |
| @tauri-apps/api | ^2 | Tauri v2 JavaScript API |
| @tauri-apps/plugin-autostart | ^2.5.1 | System autostart |
| @tauri-apps/plugin-global-shortcut | ^2.3.1 | Ctrl+Shift+A shortcut |
| @tauri-apps/plugin-notification | ^2.3.3 | OS notifications |
| @tauri-apps/plugin-store | ^2.4.2 | Encrypted token storage |
| @tauri-apps/plugin-opener | ^2 | Open URLs in browser |
| axios | ^1.13.6 | HTTP client |
| zustand | ^5.0.11 | State management |
| lucide-react | ^0.577.0 | Icon library |

---

*Report generated automatically by Claude Code on 2026-03-09.*
*View online: https://gitlab.aiyedun.online/root/enterprise-ai/-/blob/main/docs/FORENSIC_REPORT.md*
