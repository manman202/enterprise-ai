"""
API v1 router — mounts all endpoint routers under /api/v1.
WebSocket routes are registered on the FastAPI app directly in main.py.
"""

from app.api.v1.endpoints import (admin, auth, chat, documents, health, search,
                                  settings)
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1")

# Auth (login, register, me, logout, refresh)
router.include_router(auth.router, tags=["auth"])

# Admin user management
router.include_router(admin.router, tags=["admin"])

# User profile and password settings
router.include_router(settings.router, tags=["settings"])

# Platform health check
router.include_router(health.router, tags=["health"])

# Chat + conversation management
router.include_router(chat.router, tags=["chat"])

# Document upload, list, delete, reindex
router.include_router(documents.router, tags=["documents"])

# Semantic search
router.include_router(search.router, tags=["search"])
