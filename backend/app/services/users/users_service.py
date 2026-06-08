import json

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.user import User
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate

_redis: aioredis.Redis = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)

_USERS_KEY = "users:all"
_USERS_TTL = 60


async def _cache_get(key: str) -> str | None:
    try:
        return await _redis.get(key)
    except Exception:
        return None


async def _cache_set(key: str, value: str, ex: int) -> None:
    try:
        await _redis.set(key, value, ex=ex)
    except Exception:
        pass


async def _cache_delete(key: str) -> None:
    try:
        await _redis.delete(key)
    except Exception:
        pass


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self) -> list[UserResponse]:
        cached = await _cache_get(_USERS_KEY)
        if cached is not None:
            return [UserResponse.model_validate(u) for u in json.loads(cached)]
        result = await self.db.execute(select(User))
        users = [UserResponse.model_validate(u) for u in result.scalars().all()]
        await _cache_set(_USERS_KEY, json.dumps([u.model_dump(mode="json") for u in users]), ex=_USERS_TTL)
        return users

    async def create_user(self, data: UserCreate) -> UserResponse:
        existing = await self.db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user = User(
            email=data.email,
            username=data.username,
            role=data.role,
            is_active=True,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        await _cache_delete(_USERS_KEY)
        return UserResponse.model_validate(user)

    async def update_user(self, user_id: int, data: UserUpdate) -> UserResponse:
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if data.username is not None:
            user.username = data.username
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.role is not None:
            user.role = data.role
        await self.db.commit()
        await self.db.refresh(user)
        await _cache_delete(_USERS_KEY)
        return UserResponse.model_validate(user)

    async def delete_user(self, user_id: int) -> None:
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        await self.db.delete(user)
        await self.db.commit()
        await _cache_delete(_USERS_KEY)
