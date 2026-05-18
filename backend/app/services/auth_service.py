from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, settings
from app.models.user import User
from app.schemas.auth_schema import LoginRequest, TokenData, TokenResponse, UserInfo

_http_bearer = HTTPBearer()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, data: LoginRequest) -> TokenResponse:
        result = await self.db.execute(select(User).where(User.username == data.username))
        user = result.scalar_one_or_none()
        if user is None or not _verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
        token = jwt.encode(
            {"sub": str(user.id), "username": user.username, "role": user.role, "exp": expire},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        return TokenResponse(
            access_token=token,
            user=UserInfo(username=user.username, role=user.role),
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_http_bearer)],
) -> TokenData:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return TokenData(
            user_id=int(payload["sub"]),
            username=payload["username"],
            role=payload["role"],
        )
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenData:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
