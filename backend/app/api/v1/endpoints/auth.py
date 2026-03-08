"""
Authentication endpoints — login (LDAP + local fallback), register, me, logout, refresh.

Login flow:
  1. If AD_SERVER configured → LDAP authenticate → upsert user in DB → return JWT
  2. Else → verify hashed_password in DB → return JWT
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.auth import ldap_authenticate
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.postgres import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a user.
    Tries LDAP first (if configured), then falls back to local password check.
    On LDAP success: upserts user record in the database.
    """
    user: User | None = None

    # ── LDAP path ────────────────────────────────────────────────────────────
    if settings.ldap_enabled:
        ad_info = ldap_authenticate(body.username, body.password)
        if ad_info is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        # Upsert: create or update the user record from AD attributes
        result = await db.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(username=body.username)
            db.add(user)

        user.full_name = ad_info.get("full_name") or body.username
        user.email = ad_info.get("email") or f"{body.username}@{settings.ad_domain}"
        user.department = ad_info.get("department") or ""
        user.ad_groups = json.dumps(ad_info.get("groups", []))
        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)

    # ── Local DB path (dev mode — no AD server configured) ───────────────────
    else:
        result = await db.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        if not verify_password(body.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    token = create_access_token(user.id)
    logger.info("User '%s' logged in (LDAP=%s)", body.username, settings.ldap_enabled)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new local user account (dev/testing only when AD is not configured).
    In production with AD, users are auto-provisioned on first login.
    """
    existing = await db.execute(select(User).where((User.username == body.username) | (User.email == body.email)))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already taken",
        )

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.post("/logout", status_code=200)
async def logout():
    """
    Stateless logout — JWT tokens cannot be invalidated server-side.
    The client must discard the token. Returns 200 as confirmation.
    """
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Issue a fresh JWT for a currently authenticated user.
    Call this before the current token expires to extend the session.
    """
    token = create_access_token(current_user.id)
    return TokenResponse(access_token=token)
