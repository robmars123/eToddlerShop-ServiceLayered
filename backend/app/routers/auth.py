from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth_schema import TokenData, UserMeResponse
from app.services.auth.auth_service import AuthService, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


def _get_auth_service(db: Annotated[AsyncSession, Depends(get_db)]) -> AuthService:
    return AuthService(db)


@router.get("/me", response_model=UserMeResponse)
async def me(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    service: Annotated[AuthService, Depends(_get_auth_service)],
):
    """Return the current user's profile, provisioning a local record on first login."""
    return await service.me(current_user)
