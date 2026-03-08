from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, chat, documents, health, search, settings

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router, tags=["auth"])
router.include_router(admin.router, tags=["admin"])
router.include_router(settings.router, tags=["settings"])
router.include_router(health.router, tags=["health"])
router.include_router(chat.router, tags=["chat"])
router.include_router(documents.router, tags=["documents"])
router.include_router(search.router, tags=["search"])
