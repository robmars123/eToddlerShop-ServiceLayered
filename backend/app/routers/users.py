from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate
from app.services.users.users_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


def get_user_service(db: Annotated[AsyncSession, Depends(get_db)]) -> UserService:
    return UserService(db)


@router.get("/", response_model=list[UserResponse])
async def list_users(service: Annotated[UserService, Depends(get_user_service)]):
    return await service.list_users()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
):
    return await service.create_user(data)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
):
    return await service.update_user(user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    service: Annotated[UserService, Depends(get_user_service)],
):
    await service.delete_user(user_id)
