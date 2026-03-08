from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.postgres import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.settings import PasswordChangeRequest, ProfileUpdateRequest

router = APIRouter(prefix="/users")


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.username is None and body.email is None:
        return current_user

    if body.username and body.username != current_user.username:
        clash = await db.execute(select(User).where(User.username == body.username))
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        current_user.username = body.username

    if body.email and body.email != current_user.email:
        clash = await db.execute(select(User).where(User.email == body.email))
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already taken")
        current_user.email = body.email

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=204)
async def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Passwords do not match")

    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
