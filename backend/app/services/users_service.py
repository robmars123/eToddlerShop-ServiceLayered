from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self) -> list[UserResponse]:
        result = await self.db.execute(select(User))
        return [UserResponse.model_validate(u) for u in result.scalars().all()]

    async def create_user(self, data: UserCreate) -> UserResponse:
        existing = await self.db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user = User(
            email=data.email,
            username=data.username,
            hashed_password=_pwd_context.hash(data.password),
            role=data.role,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
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
        return UserResponse.model_validate(user)

    async def delete_user(self, user_id: int) -> None:
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        await self.db.delete(user)
        await self.db.commit()
