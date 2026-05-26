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
    if not oid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing identity claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    real_email: str = (claims.get("email") or claims.get("preferred_username") or "").lower()
    # Use synthetic placeholder when Entra doesn't return an email claim —
    # keeps the NOT NULL DB constraint satisfied while remaining unique per identity.
    email: str = real_email or f"{oid}@entraoid.local"

    raw_name = claims.get("name") or ""
    display_name: str = (
        raw_name if raw_name and raw_name.lower() not in ("unknown", "user") else ""
    ) or (real_email.split("@")[0] if real_email else "") or "User"

    admin_oid: str = settings.azure_entra_admin_oid.strip()
    # Any App Role assigned in Azure makes this user an admin.
    # Assign/remove roles in Azure Portal → App registrations → App roles → Users and groups.
    token_roles: list = claims.get("roles") or []
    is_admin: bool = bool(token_roles) or bool(admin_oid and oid == admin_oid)

    # 1. Fast path — returning user already linked by OID; sync role and name from token on every login
    result = await db.execute(select(User).where(User.entra_oid == oid))
    user = result.scalar_one_or_none()
    if user:
        desired_role = "admin" if is_admin else "user"
        real_name = display_name if display_name != "User" else None
        changed = False
        if user.role != desired_role:
            user.role = desired_role
            changed = True
        if real_name and user.username in ("User", "user", "unknown", ""):
            user.username = real_name[:150]
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)
        return user

    # 2. Link pre-existing record (matched by real email or pre-seeded admin email)
    if real_email:
        result = await db.execute(select(User).where(User.email == real_email))
        user = result.scalar_one_or_none()
        if user:
            user.entra_oid = oid
            user.role = "admin" if is_admin else "user"
            await db.commit()
            await db.refresh(user)
            return user
    elif admin_oid and oid == admin_oid:
        # Admin token has no email claim — find the pre-seeded admin record by settings email
        result = await db.execute(select(User).where(User.email == settings.azure_entra_admin_email))
        user = result.scalar_one_or_none()
        if user:
            user.entra_oid = oid
            user.role = "admin"
            await db.commit()
            await db.refresh(user)
            return user

    # 3. First login — create a new local record
    role = "admin" if is_admin else "user"
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
