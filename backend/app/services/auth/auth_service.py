from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, settings
from app.models.user import User
from app.schemas.auth_schema import TokenData, UserMeResponse
from app.services.auth.entra_token_validator import validate_entra_token

_http_bearer = HTTPBearer()


async def _provision_user(claims: dict, db: AsyncSession) -> User:
    """Find or create a local user from Entra token claims.

    Lookup order:
    1. By entra_oid — fast path for returning users
    2. By email — links a pre-seeded record (e.g. admin) to the Entra identity
    3. Create new record — first login for an unknown user
    """
    oid: str = claims.get("oid") or claims.get("sub", "")
    email: str = (claims.get("email") or claims.get("preferred_username") or "").lower()
    display_name: str = claims.get("name") or email.split("@")[0] or "User"
    admin_oid: str = settings.azure_entra_admin_oid.strip()

    result = await db.execute(select(User).where(User.entra_oid == oid))
    user = result.scalar_one_or_none()
    if user:
        if admin_oid and oid == admin_oid and user.role != "admin":
            user.role = "admin"
            await db.commit()
            await db.refresh(user)
        return user

    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.entra_oid = oid
            if admin_oid and oid == admin_oid:
                user.role = "admin"
            await db.commit()
            await db.refresh(user)
            return user
    elif admin_oid and oid == admin_oid:
        # Admin token has no email claim — link OID to the pre-seeded admin record by email setting
        result = await db.execute(select(User).where(User.email == settings.azure_entra_admin_email))
        user = result.scalar_one_or_none()
        if user:
            user.entra_oid = oid
            user.role = "admin"
            await db.commit()
            await db.refresh(user)
            return user
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing email claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = "admin" if (admin_oid and oid == admin_oid) else "user"
    user = User(
        email=email,
        username=display_name[:150],
        entra_oid=oid,
        is_active=True,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_http_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenData:
    claims = validate_entra_token(credentials.credentials)
    user = await _provision_user(claims, db)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return TokenData(user_id=user.id, username=user.username, role=user.role)


async def require_admin(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenData:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def me(self, token_data: TokenData) -> UserMeResponse:
        result = await self.db.execute(select(User).where(User.id == token_data.user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserMeResponse(id=user.id, email=user.email, username=user.username, role=user.role)
