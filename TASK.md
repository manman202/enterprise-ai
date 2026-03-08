# TASK.md — Aiyedun Build Instructions for Claude Code
> **WHO READS THIS:** Claude Code running on the VPS at `/opt/aiyedun/enterprise-ai`
> **HOW TO USE:** Read this file fully before starting. Execute tasks in order. Never skip a phase.
> **WORKING DIRECTORY:** Always `/opt/aiyedun/enterprise-ai`
> **AFTER EVERY TASK:** `git add . && git commit && git push origin main`

---

## ⚠️ CRITICAL RULES — READ BEFORE ANYTHING ELSE

```
1. NEVER commit Rustom.md — it is already in .gitignore. Never touch it.
2. ALWAYS use conventional commits: type(scope): description
3. NEVER hardcode secrets — always use environment variables from .env
4. ALWAYS write comments in every file you create
5. ALWAYS make UI components mobile responsive
6. ALWAYS run the build (npm run build or pip install) to verify no errors before committing
7. Execute phases IN ORDER — do not jump ahead
```

---

## PROJECT CONTEXT

**Project:** Aiyedun — Offline-first Enterprise AI Knowledge Staff  
**Purpose:** A self-hosted AI platform that acts as institutional memory for enterprises. 100% offline, LAN-only, Active Directory governed.  
**VPS:** Ubuntu 24.04 — IP: 46.62.212.115  
**Domain:** aiyedun.online  
**GitLab:** https://gitlab.aiyedun.online (auto-mirrors to github.com/manman202/enterprise-ai)  
**Stack:** FastAPI + React 18 + PostgreSQL + ChromaDB + Ollama Mistral 7B + Docker Compose + Nginx  

**URLs when live:**
- User portal → https://aiyedun.online
- Admin dashboard → https://admin.aiyedun.online
- API → https://api.aiyedun.online
- GitLab → https://gitlab.aiyedun.online

---

## PHASE STATUS TRACKER

| Phase | Title | Status |
|---|---|---|
| Phase 1 | VPS Infrastructure, DNS, SSL, GitLab, CI/CD | ✅ DONE |
| Phase 2 | Docker Compose Stack + Dockerfiles | ✅ DONE |
| Phase 3 | Automation Scripts | ✅ DONE |
| Phase 4 | Full Documentation | ✅ DONE |
| Phase 5 | Backend — Auth + RAG + Chat API | ✅ DONE |
| Phase 6 | Frontend — User Chat Portal | ✅ DONE |
| Phase 7 | Admin Dashboard | ✅ DONE |
| Phase 8 | File Watcher + Teams Bot | ✅ DONE (file watcher; Teams deferred to V2) |
| Phase 9 | Tests + Production CI/CD | ✅ DONE |
| Phase 10 | Production Deployment + v1.0.0 Release | ✅ DONE (local; push pending SSH fix) |

---

## ─────────────────────────────────────────
## PHASE 2 — Docker Compose Stack + Dockerfiles
## ─────────────────────────────────────────

**GOAL:** Create the complete Docker infrastructure so all services can run together.

**FILES TO CREATE:**
- `infra/docker-compose.yml`
- `infra/docker-compose.dev.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `admin/Dockerfile`
- `admin/nginx.conf`
- `.env.example`

---

### TASK 2.1 — Create `infra/docker-compose.yml`

Create a Docker Compose file with these exact 6 services:

**Service 1 — postgres**
- Image: `postgres:16-alpine`
- Container name: `aiyedun-postgres`
- Restart: `always`
- Environment: `POSTGRES_DB=aiyedun`, `POSTGRES_USER=aiyedun_user`, `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-AiyedunDB2026!}`
- Volume: `postgres_data:/var/lib/postgresql/data`
- Network: `aiyedun-internal` only
- Healthcheck: `pg_isready -U aiyedun_user -d aiyedun` every 10s, 5 retries

**Service 2 — chromadb**
- Image: `chromadb/chroma:latest`
- Container name: `aiyedun-chromadb`
- Restart: `always`
- Volume: `chroma_data:/chroma/chroma`
- Network: `aiyedun-internal` only
- Healthcheck: `curl -f http://localhost:8000/api/v1/heartbeat` every 15s

**Service 3 — ollama**
- Image: `ollama/ollama:latest`
- Container name: `aiyedun-ollama`
- Restart: `always`
- Volume: `ollama_data:/root/.ollama`
- Environment: `OLLAMA_HOST=0.0.0.0`
- Network: `aiyedun-internal` only
- Healthcheck: `curl -f http://localhost:11434/api/tags` every 30s

**Service 4 — backend**
- Build: `./backend`
- Container name: `aiyedun-backend`
- Restart: `always`
- env_file: `.env`
- Ports: `127.0.0.1:8000:8000` (internal only, exposed via Nginx)
- Networks: `aiyedun-internal` AND `aiyedun-web`
- Depends on: postgres, chromadb, ollama (all with `condition: service_healthy`)
- Healthcheck: `curl -f http://localhost:8000/health` every 30s

**Service 5 — frontend**
- Build: `./frontend`
- Container name: `aiyedun-frontend`
- Restart: `always`
- Ports: `127.0.0.1:3000:3000`
- Network: `aiyedun-web` only
- Depends on: backend

**Service 6 — admin**
- Build: `./admin`
- Container name: `aiyedun-admin`
- Restart: `always`
- Ports: `127.0.0.1:3001:3000`
- Network: `aiyedun-web` only
- Depends on: backend

**Networks:**
- `aiyedun-internal`: `driver: bridge`, `internal: true` (NO external access — DB and AI services only)
- `aiyedun-web`: `driver: bridge` (Nginx-accessible services)

**Volumes:** `postgres_data`, `chroma_data`, `ollama_data`

---

### TASK 2.2 — Create `infra/docker-compose.dev.yml`

Dev overrides for hot reload development:
- backend: add volume `./backend:/app`, override command to `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- frontend: add volume `./frontend:/app`, override command to `npm run dev`
- admin: add volume `./admin:/app`, override command to `npm run dev`

---

### TASK 2.3 — Create `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
# Install system deps for LDAP and curl for healthcheck
RUN apt-get update && apt-get install -y \
    libldap2-dev libsasl2-dev curl \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### TASK 2.4 — Create `frontend/Dockerfile` and `frontend/nginx.conf`

Multi-stage Dockerfile:
- Stage 1 (builder): `node:20-alpine`, `npm ci`, `npm run build`
- Stage 2 (serve): `nginx:alpine`, copy build output to `/usr/share/nginx/html`, copy nginx.conf, expose port 3000

nginx.conf must:
- Listen on port 3000
- Serve `/usr/share/nginx/html`
- `try_files $uri $uri/ /index.html` for SPA routing
- Enable gzip compression

---

### TASK 2.5 — Create `admin/Dockerfile` and `admin/nginx.conf`

Same pattern as frontend Dockerfile and nginx.conf. Port 3000 internally.

---

### TASK 2.6 — Create `.env.example`

Document ALL environment variables with clear comments explaining each one:

```
# ── Database ──────────────────────────────────────────────────
POSTGRES_PASSWORD=           # Strong password for PostgreSQL

# ── Security ──────────────────────────────────────────────────
JWT_SECRET=                  # Minimum 32 characters random string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480       # 8 hours session

# ── Active Directory ──────────────────────────────────────────
AD_SERVER=ldap://192.168.1.10        # Your AD/LDAP server IP
AD_DOMAIN=yourcompany.local          # Your AD domain
AD_BASE_DN=DC=yourcompany,DC=local   # Base DN for user search
AD_SERVICE_ACCOUNT=aiyedun-svc       # Read-only service account
AD_SERVICE_PASSWORD=                 # Service account password

# ── Application ───────────────────────────────────────────────
APP_ENV=development
APP_PORT=8000
ALLOWED_ORIGINS=https://aiyedun.online,https://admin.aiyedun.online

# ── AI / LLM ──────────────────────────────────────────────────
OLLAMA_MODEL=mistral                 # LLM model name
OLLAMA_URL=http://ollama:11434       # Internal Docker URL
EMBEDDING_MODEL=all-MiniLM-L6-v2    # Local embedding model

# ── Vector Database ───────────────────────────────────────────
CHROMA_URL=http://chromadb:8000      # Internal Docker URL

# ── Database URL ──────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://aiyedun_user:PASSWORD@postgres:5432/aiyedun

# ── File Watching ─────────────────────────────────────────────
WATCHED_PATHS=[{"path":"/mnt/shares/RH","department":"RH"},{"path":"/mnt/shares/Finance","department":"Finance"}]
PASSERELLE_PATH=/mnt/shares/Passerelle

# ── Teams Integration (optional for V1) ───────────────────────
TEAMS_APP_ID=
TEAMS_APP_PASSWORD=
TEAMS_TENANT_ID=
```

---

### TASK 2.7 — Commit and Push

```
git add . && git commit -m "infra(docker): add complete Docker Compose stack and all Dockerfiles

- docker-compose.yml: 6 services with health checks and internal networking
- docker-compose.dev.yml: hot reload overrides for development
- backend/Dockerfile: Python 3.12-slim with LDAP system dependencies
- frontend/Dockerfile: Node 20 multi-stage build + Nginx Alpine on port 3000
- admin/Dockerfile: same pattern as frontend
- .env.example: all environment variables documented with comments
- Internal network isolation: DB and AI services have no external access" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 3 — Automation Scripts
## ─────────────────────────────────────────

**GOAL:** Create scripts to automate setup, monitor health, and backup data.

**FILES TO CREATE:**
- `infra/scripts/setup.sh`
- `infra/scripts/health-check.sh`
- `infra/scripts/backup.sh`

---

### TASK 3.1 — Create `infra/scripts/setup.sh`

A complete automated setup script. Someone with an empty Ubuntu 24.04 VPS must be able to run this single script and have the full Aiyedun infrastructure ready.

**Script requirements:**
- Start with `#!/bin/bash` and `set -e` (stop on any error)
- Define color variables: GREEN, RED, YELLOW, NC
- Define a `step()` function that prints a colored banner for each step
- Define a `success()` and `error()` function for status messages
- Record start time and show total duration at end

**Steps to include (in this order):**
1. Check running as root (exit if not)
2. System update: `apt update && apt upgrade -y`
3. Install packages: curl wget git vim htop ufw fail2ban build-essential ca-certificates gnupg lsb-release python3-pip unzip nodejs npm
4. Create 8GB swap: fallocate, chmod 600, mkswap, swapon, add to /etc/fstab, set vm.swappiness=10
5. Configure UFW: deny incoming, allow outgoing, allow 22/80/443, enable
6. Configure fail2ban: write /etc/fail2ban/jail.local with SSH protection, enable, start
7. Create aiyedun user with sudo group
8. Install Docker CE from official repo (full steps: GPG key, apt source, install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin, add aiyedun to docker group)
9. Install Nginx: apt install, enable, start
10. Install Certbot: apt install certbot python3-certbot-nginx
11. Create directory structure: mkdir -p /opt/aiyedun/gitlab/{config,logs,data} /opt/aiyedun/gitlab-runner/config
12. Start GitLab CE Docker container (full docker run command with all parameters)
13. Wait for GitLab to be ready (loop checking until port 8929 responds, max 5 minutes)
14. Start GitLab Runner Docker container
15. Clone the repository: `git clone https://gitlab.aiyedun.online/root/enterprise-ai.git /opt/aiyedun/enterprise-ai`
16. Copy .env.example to .env with instructions to fill in
17. Start Docker Compose stack: `cd /opt/aiyedun/enterprise-ai && docker compose -f infra/docker-compose.yml up -d`
18. Wait for services to be healthy (loop checking docker compose ps)
19. Pull Ollama model: `docker exec aiyedun-ollama ollama pull mistral`
20. Run health check: `bash infra/scripts/health-check.sh`
21. Print completion message with all URLs

---

### TASK 3.2 — Create `infra/scripts/health-check.sh`

Check every component and print colored status. Format: `✓ ServiceName` in green or `✗ ServiceName` in red.

**Check these items:**

Section 1 — Docker Containers:
- PostgreSQL: `docker exec aiyedun-postgres pg_isready -U aiyedun_user`
- ChromaDB: `curl -sf http://localhost:8001/api/v1/heartbeat`
- Ollama: `curl -sf http://localhost:11434/api/tags`
- Backend API: `curl -sf http://localhost:8000/health`
- Frontend: `curl -sf http://localhost:3000`
- Admin UI: `curl -sf http://localhost:3001`

Section 2 — Public HTTPS Endpoints:
- `https://aiyedun.online`
- `https://admin.aiyedun.online`
- `https://api.aiyedun.online/health`
- `https://gitlab.aiyedun.online`

Section 3 — System Resources (just print values, no pass/fail):
- RAM: used / total
- Swap: used / total
- Disk: used / total / percentage
- CPU: current usage %
- Docker disk usage: `docker system df`

Section 4 — Backup Status:
- Show last backup date from `/opt/aiyedun/backups/`
- Show next scheduled backup time

---

### TASK 3.3 — Create `infra/scripts/backup.sh`

Nightly backup script with error handling.

**Script structure:**
```
BACKUP_DIR="/opt/aiyedun/backups/$(date +%Y-%m-%d_%H%M)"
RETAIN_DAYS=7
LOG="/var/log/aiyedun-backup.log"
```

**Steps:**
1. Create backup directory
2. Log start time to LOG file
3. Backup PostgreSQL: `docker exec aiyedun-postgres pg_dump -U aiyedun_user aiyedun | gzip > $BACKUP_DIR/postgres.sql.gz`
4. Backup ChromaDB: `docker run --rm -v aiyedun_chroma_data:/data alpine tar czf - /data > $BACKUP_DIR/chromadb.tar.gz`
5. Backup GitLab: `docker exec gitlab gitlab-backup create` then copy to backup dir
6. Delete backups older than RETAIN_DAYS: `find /opt/aiyedun/backups/ -type d -mtime +$RETAIN_DAYS -exec rm -rf {} +`
7. Log completion with file sizes using `ls -lh $BACKUP_DIR`
8. Each step wrapped in error handling — if step fails, log error and continue (don't stop the whole backup)

Add at top of file as comment:
```
# INSTALL CRON JOB:
# (crontab -l 2>/dev/null; echo "0 2 * * * /opt/aiyedun/enterprise-ai/infra/scripts/backup.sh") | crontab -
```

---

### TASK 3.4 — Make scripts executable and commit

```bash
chmod +x infra/scripts/setup.sh infra/scripts/health-check.sh infra/scripts/backup.sh

git add infra/scripts/ && git commit -m "infra(scripts): add setup, health-check and backup scripts

- setup.sh: 20-step automated VPS setup from scratch to live
- health-check.sh: verify Docker services, HTTPS endpoints, system resources
- backup.sh: nightly PostgreSQL + ChromaDB + GitLab backup with 7-day retention
- All scripts have colored output, error handling, and clear logging" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 4 — Full Documentation
## ─────────────────────────────────────────

**GOAL:** Create exhaustive documentation. Any developer must be able to read these docs and deploy or use Aiyedun without asking anyone.

**FILES TO CREATE:**
- `docs/SETUP.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/USER-GUIDE.md`

---

### TASK 4.1 — Create `docs/SETUP.md`

**This is the most important documentation file.** It must guide a developer from an empty Ubuntu 24.04 VPS to a fully running Aiyedun platform. Every command must be exact. Every step must be explained.

**Required sections:**

1. Prerequisites (hardware requirements, domain name, GitHub account, SSH access)
2. DNS Configuration (table of 5 A records, how to verify with dig)
3. Connect to VPS (ssh command)
4. System Update & Base Packages (commands + explanation)
5. Create Swap — why it's needed for Ollama CPU, all commands
6. Firewall Configuration (UFW commands + why only 22/80/443)
7. Fail2ban Setup (config file + commands)
8. Create Deploy User
9. Docker Installation (full official CE install steps)
10. Nginx Installation & Virtual Hosts Configuration (install + 4 server blocks)
11. SSL Certificates — Let's Encrypt (certbot command + verify auto-renewal)
12. GitLab CE Installation (docker run command, get initial password, UI configuration steps)
13. GitLab Runner (docker run + register command)
14. GitHub Personal Access Token (steps to create PAT, scopes needed)
15. GitHub Mirror Configuration (GitLab UI steps)
16. CI/CD Variables (how to add GITHUB_TOKEN and DEPLOY_SSH_KEY)
17. Clone & Configure Repository (git clone + cp .env.example + edit .env)
18. Start Docker Compose Stack (docker compose up -d + verify healthy)
19. Pull Ollama Model (docker exec + test command)
20. Verify Everything (run health-check.sh + test each URL)
21. Schedule Backup Cron (crontab command)
22. Troubleshooting (10 common issues with solutions)
23. Maintenance (update, restart, logs, manual backup commands)

---

### TASK 4.2 — Create `docs/ARCHITECTURE.md`

Include these sections with ASCII diagrams where applicable:

1. Overview (what Aiyedun is and its core principles)
2. Platform Overview (ASCII diagram of full VPS with all services)
3. The 4 Architecture Planes (User & Control, AI & Retrieval, Connector & Data, Security & Governance) — for each: component list + roles
4. The 6 Network Deployment Zones (table: zone, services, access level)
5. The 7 Capability Layers (table: layer, name, purpose)
6. Data Sources — T-Resources (T1 to T6 with examples and access restrictions)
7. Active Directory & RBAC Model (all 8 AD groups, how enforcement works)
8. End-to-End Request Workflow (ASCII flowchart of all 10 steps)
9. Knowledge Ingestion Pipeline (ASCII diagram from file to ChromaDB)
10. Technology Stack (full table: component, technology, version, purpose)
11. Infrastructure & Ports (table: service, container, internal port, external port, network)
12. Security Model (auth flow, encryption, audit logging, network rules)
13. V1 vs V2 Scope (what is in MVP vs deferred)

---

### TASK 4.3 — Create `docs/API.md`

For every API endpoint that exists in `backend/app/api/`, document:
- HTTP method + full path
- Short description
- Auth required: yes/no (and what role)
- Request body (JSON with field types and descriptions)
- Success response (JSON example)
- Error responses (common error codes and meanings)
- Example curl command

Also document the WebSocket endpoint:
- `wss://api.aiyedun.online/ws/chat/{conversation_id}`
- Connection flow
- Message format (send and receive)
- How streaming tokens arrive

---

### TASK 4.4 — Create `docs/USER-GUIDE.md`

Write for non-technical end users (employees using the portal):

1. What is Aiyedun? (simple explanation, no technical jargon)
2. How to access the portal (just open browser, go to URL)
3. How to login (company username and password)
4. How to ask a question (type in the chat box, press send)
5. Understanding the response (what the answer looks like, what source citations mean)
6. How to continue a conversation (just keep typing)
7. How to start a new conversation
8. How to find an old conversation
9. What Aiyedun can do (answer questions about company documents, projects, policies)
10. What Aiyedun cannot do (browse internet, access personal emails, modify anything)
11. Privacy and confidentiality (your queries are logged for audit, only your department docs visible)
12. Mobile usage (access from phone browser, tips for mobile)
13. FAQ (10 questions with clear answers)
14. Who to contact for help

---

### TASK 4.5 — Commit all documentation

```
git add docs/ && git commit -m "docs: add complete project documentation

- SETUP.md: exhaustive 23-step guide from empty VPS to live production
- ARCHITECTURE.md: full architecture with ASCII diagrams, planes, zones, RBAC
- API.md: all endpoints documented with curl examples and WebSocket guide
- USER-GUIDE.md: non-technical end-user guide with FAQ" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 5 — Backend: Auth + RAG + Chat API
## ─────────────────────────────────────────

**GOAL:** Build the complete backend API — authentication with LDAP/AD, RAG pipeline, and chat endpoints.

---

### TASK 5.1 — Core Configuration & Database Models

Create these files:

**`backend/app/core/config.py`** — Pydantic Settings class loading all variables from .env. Every setting must have a description comment.

**`backend/app/db/postgres.py`** — SQLAlchemy async engine, AsyncSession factory, Base declarative class, `get_db()` dependency, `create_all_tables()` startup function.

**`backend/app/models/user.py`** — User model: id (UUID), username, email, full_name, department, ad_groups (JSON), is_active, is_admin, created_at, last_login

**`backend/app/models/conversation.py`** — Conversation: id (UUID), user_id (FK→User), title, created_at, updated_at, message_count

**`backend/app/models/message.py`** — Message: id (UUID), conversation_id (FK), role (user/assistant), content (Text), sources (JSON), created_at, tokens_used

**`backend/app/models/audit_log.py`** — AuditLog: id (UUID), user_id, action, resource, outcome (allow/deny), details (JSON), ip_address, created_at

**`backend/app/models/document.py`** — Document: id (UUID), filename, filepath, department, file_size, file_hash (MD5), status (pending/ingested/failed), chunks_count, ingested_at, error_message

---

### TASK 5.2 — Authentication System (LDAP + JWT)

**`backend/app/core/auth.py`**:
- `ldap_authenticate(username, password)` → connects to AD, verifies credentials, returns user info dict (full_name, email, department, groups) or None
- Falls back to local DB auth if AD_SERVER is not set (for dev/testing without AD)
- `create_access_token(data, expires_delta)` → returns JWT string
- `get_current_user(token)` → FastAPI dependency, validates JWT, returns User
- `require_admin(user)` → raises HTTP 403 if user is not admin

**`backend/app/api/v1/endpoints/auth.py`**:
- `POST /api/v1/auth/login` → authenticate → upsert user in DB → return JWT + user info
- `GET /api/v1/auth/me` → return current user from JWT
- `POST /api/v1/auth/logout` → return success (stateless JWT)
- `POST /api/v1/auth/refresh` → return new token if current is valid

---

### TASK 5.3 — RAG Pipeline

**`backend/app/db/chroma.py`** — ChromaDB client:
- `get_collection(name)` — get or create collection
- `query(collection_names, query_embedding, n_results)` — query multiple collections, returns chunks with metadata

**`backend/app/db/ollama.py`** — Ollama HTTP client using httpx:
- `generate(prompt, model)` → str
- `generate_stream(prompt, model)` → AsyncGenerator[str]
- `health_check()` → bool

**`backend/app/core/embeddings.py`**:
- Load `sentence-transformers/all-MiniLM-L6-v2` locally on startup
- `embed_text(text)` → list[float]

**`backend/app/core/ingestion.py`**:
- `extract_text(file_path)` → dispatch by extension (.pdf/.docx/.xlsx/.txt)
- `chunk_text(text, size=500, overlap=50)` → list[str]
- `ingest_document(file_path, department)` → stores chunks in ChromaDB, updates Document in DB

**`backend/app/core/rag.py`**:
- `build_rag_prompt(question, chunks, history)` → prompt string
  - Prompt instructs model: answer from context only, cite sources by filename, say "Je ne trouve pas cette information" if context empty
- `rag_query(question, user_departments, history, stream)` → (answer, sources)
  - Embeds question → queries ChromaDB filtered by user's departments → builds prompt → calls Ollama

---

### TASK 5.4 — Chat & Document Endpoints

**`backend/app/api/v1/endpoints/chat.py`**:
- `POST /api/v1/chat/message` — body: {message, conversation_id?} → runs RAG → returns {response, sources, conversation_id}
- `GET /api/v1/chat/conversations` — list user's conversations
- `GET /api/v1/chat/history/{conversation_id}` — get all messages
- `DELETE /api/v1/chat/conversations/{id}` — delete conversation
- `WebSocket /ws/chat/{conversation_id}` — streaming: receive message, stream tokens back in real-time

**`backend/app/api/v1/endpoints/documents.py`**:
- `POST /api/v1/documents/upload` (admin only) — upload file → ingest → return status
- `GET /api/v1/documents/` — list all documents with metadata
- `DELETE /api/v1/documents/{id}` (admin only) — remove from ChromaDB and DB
- `POST /api/v1/documents/reindex` (admin only) — re-ingest all documents

---

### TASK 5.5 — Commit Backend

```
git add backend/ && git commit -m "feat(backend): implement complete auth, RAG pipeline and chat API

- LDAP authentication with JWT tokens and local fallback for dev
- SQLAlchemy models: User, Conversation, Message, AuditLog, Document
- ChromaDB client with department-filtered RBAC queries
- Ollama HTTP client with streaming support
- Local embedding service (all-MiniLM-L6-v2)
- Document ingestion: PDF, DOCX, XLSX with chunking
- RAG engine: embed → retrieve → prompt → answer with citations
- Chat API: message, history, conversations, WebSocket streaming
- Document management: upload, list, delete, reindex" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 6 — Frontend: User Chat Portal
## ─────────────────────────────────────────

**GOAL:** Build a professional, beautiful chat portal. Think ChatGPT quality but with Aiyedun deep blue branding.

**DESIGN RULES:**
- Primary color: `#1e3a5f` (deep blue)
- Secondary: `#2563eb` (bright blue for buttons)
- Background light: `#f8fafc` | Background dark: `#0f172a`
- Font: Inter (Google Fonts or system-ui)
- Dark/light mode toggle
- Mobile-first: must work perfectly on 375px screen width
- Smooth animations on all interactions

---

### TASK 6.1 — Auth & State

**`frontend/src/contexts/AuthContext.tsx`**:
- user state, token (memory only — no localStorage for security)
- `login(username, password)` → calls POST /api/v1/auth/login
- `logout()` → clears state and redirects to /login
- `isAuthenticated` computed boolean

---

### TASK 6.2 — Login Page

**`frontend/src/pages/LoginPage.tsx`**:
- Full screen gradient background (deep blue #1e3a5f → navy #0f172a)
- Centered white card (max-width 400px, rounded corners, shadow)
- Aiyedun logo or styled text logo at top
- Tagline: "Your institutional memory. Always available."
- Username field with user icon
- Password field with lock icon + show/hide toggle
- "Sign in" button — full width, bright blue, loading spinner when authenticating
- Error message in red if login fails
- Footer: "Aiyedun v1.0 — Confidential — Internal use only"
- Fully responsive on mobile

---

### TASK 6.3 — Chat Page (Main Interface)

**`frontend/src/pages/ChatPage.tsx`**:

This is the most important UI component. Build it like a professional messaging app.

**Layout (desktop):**
```
┌─────────────────┬──────────────────────────────────────┐
│   SIDEBAR       │         CHAT AREA                    │
│   260px wide    │         flex-grow                    │
│                 │                                      │
│ [Logo + User]   │  [Top bar: title + dept badge]       │
│                 │                                      │
│ [+ New Chat]    │  [Messages scrollable area]          │
│                 │                                      │
│ [Conv list]     │  [Input area at bottom]              │
│                 │                                      │
└─────────────────┴──────────────────────────────────────┘
```

**Sidebar content:**
- Aiyedun logo + username + department badge at top
- "New conversation" button (+ icon, full width)
- Conversations grouped by: Today / Yesterday / This week / Older
- Each item: conversation title (first 40 chars) + relative timestamp
- Active conversation highlighted with blue background
- On mobile: sidebar is a slide-in drawer, toggle with hamburger icon

**Chat area — messages:**
- User messages: right-aligned, blue bubble (#2563eb), white text
- Assistant messages: left-aligned, white card with subtle shadow, dark text
- Each assistant message has: Aiyedun avatar (A icon in deep blue), message content (markdown rendered), source citations below, copy button on hover
- Typing indicator: three animated dots while waiting for response
- Auto-scroll to bottom on new message
- Empty state (no messages): "Bonjour [name] 👋" + tagline + 3 suggested question chips

**Chat area — input:**
- Textarea that auto-expands (1 line to max 5 lines)
- Placeholder: "Posez votre question à Aiyedun..."
- Send button (paper plane icon) — disabled when empty
- Keyboard: Enter sends, Shift+Enter adds new line
- Character count shown when > 500 characters

**Mobile layout (< 768px):**
- Sidebar hidden by default
- Hamburger menu button top-left opens sidebar as overlay
- Full screen chat
- Input stuck to bottom

---

### TASK 6.4 — Message Components

**`frontend/src/components/chat/MessageBubble.tsx`**:
- Renders markdown (use `react-markdown` with syntax highlighting)
- User bubble: right-aligned, blue
- Assistant bubble: left-aligned, white card
- Timestamp shown on hover
- Copy to clipboard button (appears on hover for assistant messages)
- Show sources section below assistant messages

**`frontend/src/components/chat/SourceCitation.tsx`**:
- Renders as a collapsible section "Sources (3)"
- When expanded: shows chips for each source
- Each chip: document icon + filename (truncated) + department badge
- Relevance score shown as subtle percentage

**`frontend/src/components/chat/TypingIndicator.tsx`**:
- Three animated bouncing dots
- Same style as assistant message bubble

---

### TASK 6.5 — History Page

**`frontend/src/pages/HistoryPage.tsx`**:
- Table of all conversations
- Columns: Title, Date, Message count, Department filter used
- Search bar to filter by title
- Click any row to open that conversation
- Delete button with confirmation dialog
- Empty state message

---

### TASK 6.6 — Commit Frontend

```
git add frontend/ && git commit -m "feat(frontend): build professional chat portal

- Deep blue Aiyedun branding, dark/light mode toggle
- Login page: gradient background, animated card, error handling
- Chat page: sidebar + message area + streaming WebSocket
- MessageBubble: markdown rendering, copy button, hover animations
- SourceCitation: collapsible chips with department badges
- TypingIndicator: animated dots while AI responds
- History page: searchable conversation list with delete
- Mobile responsive: slide-in sidebar, full-screen chat on mobile
- Keyboard shortcuts: Enter to send, Shift+Enter for newline" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 7 — Admin Dashboard
## ─────────────────────────────────────────

**GOAL:** Build a complete, professional admin dashboard with all management capabilities.

**DESIGN RULES:**
- Fixed sidebar (240px) with deep blue background
- White content area
- Use recharts for all charts
- Professional data tables with sorting and filtering
- Status indicators: green dot = healthy, red = down, yellow = degraded

---

### TASK 7.1 — Layout & Navigation

**`admin/src/components/layout/AdminSidebar.tsx`**:
- Deep blue (#1e3a5f) background, white text
- "AIYEDUN" logo at top + "Admin Panel" subtitle
- Navigation items with icons (use lucide-react):
  - Dashboard (LayoutDashboard icon)
  - Users (Users icon)
  - Knowledge (BookOpen icon)
  - Audit Logs (FileText icon)
  - Analytics (BarChart2 icon)
  - System Health (Activity icon)
  - Settings (Settings icon)
- Active item: white background, deep blue text
- Bottom: logged-in username + Logout button
- On mobile: hamburger toggle, sidebar slides in as overlay

---

### TASK 7.2 — Dashboard Overview Page

**`admin/src/pages/DashboardPage.tsx`**:

Row 1 — 4 KPI Cards:
- Total Active Users (with +X% vs last week in green/red)
- Queries Today (with peak hour shown)
- Documents Indexed (with last ingestion timestamp)
- System Health % (color: green >90%, yellow 70-90%, red <70%)

Row 2 — 2 Charts side by side:
- Line chart: Queries per hour (last 24 hours) — use recharts LineChart
- Bar chart: Queries by department (last 7 days) — use recharts BarChart with department colors

Row 3 — Service Health Grid (2x3 cards):
- Each card: service name + colored status dot + response time (ms) + uptime %
- Services: PostgreSQL, ChromaDB, Ollama, Backend API, Frontend, Admin UI

Row 4 — Recent Activity Feed:
- Last 10 audit events
- Each item: icon + description + username + relative timestamp

Auto-refresh every 30 seconds.

---

### TASK 7.3 — Users Management Page

**`admin/src/pages/UsersPage.tsx`**:
- Search bar (filter by username or name)
- Filter dropdowns: by department, by status (active/inactive), by role (admin/user)
- Data table with columns: Avatar initials, Username, Full Name, Department, AD Groups (chips), Last Login, Status badge, Actions
- Actions per row: Activate/Deactivate toggle, Promote/Demote admin, View query history
- Pagination: 20 users per page
- Export to CSV button
- Total count shown: "Showing 20 of 147 users"

---

### TASK 7.4 — Audit Logs Page

**`admin/src/pages/AuditPage.tsx`**:
- Filter bar: date range picker, user search, action type dropdown, outcome (allow/deny)
- Data table: Timestamp, User, Action, Resource, Outcome (green ALLOW / red DENY badge), IP Address
- Click any row to expand full details in a side panel
- Export to CSV
- Real-time updates (new logs appear at top without full refresh)

---

### TASK 7.5 — Knowledge Management Page

**`admin/src/pages/KnowledgePage.tsx`**:

Section 1 — Watched Sources:
- Table: Path, Department, Last Scan, Document Count, Status
- Add new source button (modal with path + department fields)
- Remove source button
- "Scan now" button per source

Section 2 — Ingested Documents:
- Table: Filename, Department, File Size, Chunks, Status, Ingested At
- Filter by department and status
- Delete document button (removes from ChromaDB)
- "Re-index all" button with confirmation

Section 3 — Ingestion Queue:
- Show pending/in-progress ingestions
- Progress bars for active ingestions

---

### TASK 7.6 — System Health Page

**`admin/src/pages/HealthPage.tsx`**:
- Auto-refresh every 10 seconds
- CPU usage: progress bar + percentage
- RAM: progress bar (used / total + swap used / total)
- Disk: progress bar (used / total / percentage)
- Docker containers table: name, status, uptime, CPU%, RAM usage
- Response time chart (last 1 hour): line chart for each service
- Error rate gauge: queries that returned no answer vs total

---

### TASK 7.7 — Analytics Page

**`admin/src/pages/AnalyticsPage.tsx`**:
- Date range selector: Last 7 days / 30 days / 90 days / Custom
- Charts:
  - Daily active users (line chart)
  - Queries by department (pie chart with legend)
  - Top 10 topics/intents (horizontal bar chart)
  - Average response time trend (line chart)
  - No-answer rate (queries where Aiyedun had no relevant documents) (gauge)
  - Document access frequency (which docs are cited most) (bar chart)

---

### TASK 7.8 — Commit Admin Dashboard

```
git add admin/ && git commit -m "feat(admin): build complete professional admin dashboard

- Fixed sidebar navigation with deep blue branding and icons
- Dashboard: KPI cards, hourly/department charts, service health grid
- Users: searchable table with activate/deactivate and admin promote
- Audit logs: filterable table with expand details and CSV export
- Knowledge: watched sources management, document list, re-index
- System Health: CPU/RAM/Disk bars, Docker containers, response times
- Analytics: DAU, department breakdown, topics, response time trends
- All pages auto-refresh and mobile responsive" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 8 — File Watcher + Teams Integration
## ─────────────────────────────────────────

### TASK 8.1 — File Watcher Service

Create `backend/app/services/file_watcher.py`:
- Uses `watchdog` library to monitor directories defined in `WATCHED_PATHS` env var
- On new or modified file: call `ingest_document()` from `core/ingestion.py`
- Supported: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.txt`, `.md`
- Skip if file already ingested (check MD5 hash in Document table)
- Log every event: file detected, ingestion started, chunks created, time taken, errors
- Start as background task in `backend/app/main.py` lifespan

Create `scripts/file_watcher_standalone.py` for running outside Docker (testing purposes).

Commit:
```
git add . && git commit -m "feat(ingestion): add automated file watcher service

- watchdog-based monitoring of configured department directories
- Auto-ingest on new/modified files (PDF, DOCX, XLSX, TXT)
- Duplicate prevention via MD5 file hash
- Background task started with FastAPI lifespan
- Standalone script for testing" && git push origin main
```

---

### TASK 8.2 — Teams Bot

Create `backend/app/services/teams_bot.py`:
- `botframework-integration-aiohttp` based Teams bot
- Handles @Aiyedun mentions in Teams channels
- Resolves Teams user identity to AD username for RBAC
- Formats responses as Teams Adaptive Cards with source citations
- `on_message_activity`: extract message → get user dept from AD → RAG query → send Adaptive Card

Create `backend/app/services/meeting_transcription.py`:
- Connect to Microsoft Graph API using MSAL
- `get_meeting_transcript(meeting_id)` → returns transcript text
- `generate_meeting_summary(transcript)` → calls Ollama to summarize into: decisions, action_items, topics, participants
- `post_summary_to_channel(channel_id, summary)` → posts formatted card to Teams channel

Create `docs/TEAMS-SETUP.md` — step-by-step guide to register the bot in Azure AD portal.

Commit:
```
git add . && git commit -m "feat(teams): add Teams bot and meeting integration

- Teams bot responds to @Aiyedun mentions with Adaptive Cards
- Meeting transcription via Microsoft Graph API
- Post-meeting summary generation via Ollama
- Azure AD bot registration guide" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 9 — Tests + Production CI/CD
## ─────────────────────────────────────────

### TASK 9.1 — Backend Test Suite

Create comprehensive tests:

**`backend/tests/conftest.py`** — fixtures: test DB (SQLite), mock ChromaDB, mock Ollama, test users (regular + admin), test JWT tokens, async HTTP client

**`backend/tests/test_auth.py`** — test login success/failure, JWT validation, token expiry, admin guard rejection

**`backend/tests/test_chat.py`** — test message endpoint, RBAC filtering (RH user only sees RH sources), conversation history, WebSocket streaming

**`backend/tests/test_ingestion.py`** — test PDF/DOCX extraction, chunking logic, duplicate detection

**`backend/tests/test_rbac.py`** — test department isolation, Passerelle cross-dept access, admin bypass, audit log creation

Commit:
```
git add backend/tests/ && git commit -m "test: add comprehensive backend test suite

- Auth tests: LDAP mock, JWT, admin guard
- Chat tests: RAG response, RBAC department filtering
- Ingestion tests: PDF/DOCX extraction, chunking, dedup
- RBAC tests: department isolation, Passerelle, audit logs
- Coverage target: >60%" && git push origin main
```

---

### TASK 9.2 — Production CI/CD Pipeline

Update `.gitlab-ci.yml` with the complete production pipeline:

**Stages:** lint → test → build → security → deploy-dev → deploy-prod → mirror

- `lint:backend` — flake8 + black --check + isort --check (fail on error)
- `lint:frontend` — eslint + tsc --noEmit (fail on error)
- `lint:admin` — eslint + tsc --noEmit (fail on error)
- `test:backend` — pytest with PostgreSQL service container, fail if coverage < 60%
- `test:frontend` — vitest run
- `build:backend` — docker build, tag with $CI_COMMIT_SHA
- `build:frontend` — docker build, tag with $CI_COMMIT_SHA
- `build:admin` — docker build, tag with $CI_COMMIT_SHA
- `security:scan` — trivy scan all images, report only (no fail)
- `deploy:dev` — SSH to VPS, git pull develop, docker compose up --build (runs on develop branch)
- `deploy:prod` — SSH to VPS, git pull main, docker compose up --build (runs on main, MANUAL trigger)
- `mirror:github` — push to github.com/manman202/enterprise-ai
- Rules: lint+test run on ALL pushes. build+security on develop+main. deploy-dev on develop. deploy-prod on main (manual).

Commit:
```
git add .gitlab-ci.yml && git commit -m "ci(pipeline): complete production CI/CD pipeline

- Full lint: flake8+black+isort (backend), eslint+tsc (frontend+admin)
- Tests with coverage enforcement (>60%)
- Docker builds with SHA tagging
- Trivy security scanning
- Auto deploy to dev on develop branch
- Manual deploy to prod on main branch
- GitHub mirror on every push" && git push origin main
```

---

## ─────────────────────────────────────────
## PHASE 10 — Production Release v1.0.0
## ─────────────────────────────────────────

### TASK 10.1 — Final Production Deployment

Execute these steps in order:

1. Start full stack: `docker compose -f infra/docker-compose.yml up -d`
2. Verify all healthy: `docker compose -f infra/docker-compose.yml ps`
3. Pull model: `docker exec aiyedun-ollama ollama pull mistral`
4. Test model: `docker exec aiyedun-ollama ollama run mistral "Hello"`
5. Run health check: `bash infra/scripts/health-check.sh`
6. Schedule backup cron: `(crontab -l 2>/dev/null; echo "0 2 * * * /opt/aiyedun/enterprise-ai/infra/scripts/backup.sh") | crontab -`
7. Run first backup: `bash infra/scripts/backup.sh`
8. Update CHANGELOG.md with v1.0.0 release notes
9. Tag release:
```bash
git tag -a v1.0.0 -m "Aiyedun v1.0.0 — Initial Production Release

Features:
- Offline-first enterprise AI chat portal (https://aiyedun.online)
- AD/LDAP authentication with JWT
- RAG pipeline: ChromaDB + Ollama Mistral 7B
- Department-based RBAC access control
- Admin dashboard (https://admin.aiyedun.online)
- Microsoft Teams bot integration
- Automated file watcher document ingestion
- GitLab CE + GitHub mirror CI/CD
- Full test suite with >60% coverage
- Complete documentation"
git push origin v1.0.0
```

10. Final commit:
```
git add . && git commit -m "feat(release): Aiyedun v1.0.0 — production ready

All services live and verified:
- https://aiyedun.online — User portal
- https://admin.aiyedun.online — Admin dashboard
- https://api.aiyedun.online — Backend API
- https://gitlab.aiyedun.online — GitLab CE
- Ollama Mistral 7B loaded and responding
- Backup scheduled at 02:00 daily
- Tagged v1.0.0" && git push origin main
```

---

## COMPLETION CHECKLIST

Use this to verify everything is done before declaring v1.0.0 complete:

- [ ] All Docker services running and healthy
- [ ] https://aiyedun.online loads and shows login page
- [ ] https://admin.aiyedun.online loads and shows admin login
- [ ] https://api.aiyedun.online/health returns `{"status":"healthy"}`
- [ ] https://gitlab.aiyedun.online is accessible
- [ ] Login works with test credentials
- [ ] Chat message returns a response with source citations
- [ ] Admin dashboard shows real data
- [ ] GitLab pipeline passes all stages on push
- [ ] GitHub mirror receives every push
- [ ] Backup script runs without errors
- [ ] Cron job scheduled for 02:00 daily
- [ ] All docs in `docs/` folder complete
- [ ] CHANGELOG.md has v1.0.0 entry
- [ ] Git tag v1.0.0 created and pushed
- [ ] Rustom.md was NEVER committed ✅

---

*TASK.md — Aiyedun Build Instructions*  
*VPS: 46.62.212.115 | Domain: aiyedun.online | Repo: /opt/aiyedun/enterprise-ai*
