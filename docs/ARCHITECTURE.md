# Aiyedun — Architecture Reference

---

## 1. Overall Platform

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AIYEDUN ENTERPRISE AI                              │
│                      Self-hosted · Offline-first · LAN                     │
├───────────────────────┬─────────────────────────┬───────────────────────────┤
│    User Portal        │     Admin Panel          │      REST API             │
│  React 18 + TS        │   React 18 + TS          │     FastAPI               │
│  Vite · Tailwind      │   Vite · Tailwind        │     Python 3.12           │
│  port 3000            │   port 4000              │     port 8000             │
└──────────┬────────────┴──────────┬──────────────┴──────────┬────────────────┘
           │                       │                           │
           └───────────────────────┼───────────────────────────┘
                                   │  aiyedun-web network
                                   ▼
                        ┌──────────────────────┐
                        │   FastAPI Backend     │
                        │   aiyedun-backend     │
                        └──────────┬───────────┘
                                   │  aiyedun-internal network
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
   ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │   PostgreSQL 16  │  │   ChromaDB      │  │   Ollama         │
   │   aiyedun-       │  │   aiyedun-      │  │   aiyedun-       │
   │   postgres:5432  │  │   chromadb:8000 │  │   ollama:11434   │
   │                  │  │                 │  │                  │
   │  Users, Docs     │  │  Vector store   │  │  Mistral 7B      │
   │  metadata        │  │  embeddings     │  │  LLM inference   │
   └──────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## 2. The Four Planes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLANE 1 — PRESENTATION                                                     │
│  ┌────────────────────────┐    ┌────────────────────────┐                  │
│  │   User Portal          │    │   Admin Panel          │                  │
│  │   /login  /chat        │    │   /dashboard  /users   │                  │
│  │   /docs   /search      │    │   /documents           │                  │
│  │   /settings            │    │   (is_admin=true only) │                  │
│  └────────────────────────┘    └────────────────────────┘                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  PLANE 2 — API / ORCHESTRATION                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   FastAPI  /api/v1/{auth, chat, docs, search, admin, users, health} │   │
│  │   JWT auth · Alembic migrations · async SQLAlchemy · Pydantic       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  PLANE 3 — DATA                                                             │
│  ┌──────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐ │
│  │  PostgreSQL 16   │   │   ChromaDB      │   │   Docker volumes        │ │
│  │  users / docs    │   │   embeddings    │   │   postgres_data         │ │
│  │  metadata        │   │   similarity    │   │   chroma_data           │ │
│  └──────────────────┘   └─────────────────┘   │   ollama_data           │ │
│                                                └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  PLANE 4 — INFERENCE                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Ollama — serves Mistral 7B locally over HTTP at :11434            │   │
│  │   No internet required · No API keys · Fully air-gapped capable     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Six Network Zones

```
  Internet / LAN clients
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  ZONE 1 — PUBLIC EDGE                                      │
│  Nginx reverse proxy (host network)                        │
│  aiyedun.online → :3000                                    │
│  admin.aiyedun.online → :4000                              │
│  api.aiyedun.online → :8000                                │
│  TLS terminated here (Let's Encrypt / Certbot)             │
└────────────────────────────────────────────────────────────┘
        │ (proxied internally)
        ▼
┌────────────────────────────────────────────────────────────┐
│  ZONE 2 — aiyedun-web (Docker bridge network)              │
│  Services: backend, frontend, admin                        │
│  Exposed ports: 3000, 4000, 8000 (host-bound)             │
└────────────────────────────────────────────────────────────┘
        │ (backend bridges both networks)
        ▼
┌────────────────────────────────────────────────────────────┐
│  ZONE 3 — aiyedun-internal (Docker bridge network)         │
│  Services: postgres, chromadb, ollama, backend             │
│  No host-bound ports — unreachable from outside            │
└────────────────────────────────────────────────────────────┘
        │
   ┌────┴────┬──────────┐
   ▼         ▼          ▼
ZONE 4    ZONE 5     ZONE 6
Postgres  ChromaDB   Ollama
:5432     :8000      :11434
(volume)  (volume)   (volume)
```

---

## 4. Ten-Step Request Workflow

A user submits a chat message. Here is the complete path:

```
  Browser (user types message + clicks Send)
      │
      │  HTTPS POST https://aiyedun.online/api/v1/chat
      ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 1 — Nginx (host)                           │
  │  Terminates TLS, forwards to 127.0.0.1:3000      │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 2 — Frontend container (nginx, port 3000)  │
  │  /api/ path → proxy_pass to aiyedun-backend:8000 │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 3 — FastAPI router                         │
  │  Matches POST /api/v1/chat                       │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 4 — JWT authentication (deps.py)           │
  │  Bearer token validated, user resolved           │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 5 — chat endpoint                          │
  │  Validates request body (Pydantic)               │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 6 — ChromaDB query (optional RAG)          │
  │  Semantic search over uploaded documents         │
  │  Returns top-k document excerpts + metadata      │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 7 — Prompt assembly                        │
  │  User message + retrieved context combined       │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 8 — Ollama generate()                      │
  │  POST http://aiyedun-ollama:11434/api/generate   │
  │  Mistral 7B produces response (local, offline)   │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 9 — Response serialised (Pydantic)         │
  │  ChatResponse { response: string }               │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │  STEP 10 — Browser renders response              │
  │  Citations shown if RAG sources were returned    │
  └──────────────────────────────────────────────────┘
```
