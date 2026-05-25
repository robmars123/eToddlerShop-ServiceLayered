from typing import AsyncGenerator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Settings(BaseSettings):
    database_url: str
    debug: bool = False
    upload_dir: str = "uploads"

    # Azure Entra External ID (CIAM) — Native Authentication
    azure_entra_tenant_id: str = ""
    azure_entra_client_id: str = ""
    # Full authority URL, e.g. https://{subdomain}.ciamlogin.com/{tenant-id}
    azure_entra_authority: str = ""
    # Audience claim in the access token — usually equals client_id for single-app setups
    azure_entra_audience: str = ""
    # Email of the pre-seeded admin user (matched on first Entra login to grant admin role)
    azure_entra_admin_email: str = ""
    # OID of the admin user from Entra — used when email claim is absent (CIAM external users)
    azure_entra_admin_oid: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_key: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"
    azure_openai_embeddings: str = "text-embedding-3-small"
    azure_openai_chat: str = "gpt-4o-mini"

    azure_speech_endpoint: str = ""
    azure_speech_key: str = ""
    azure_speech_region: str = "centralus"

    azure_storage_connection_string: str = ""
    azure_storage_container: str = "products"

    cors_origins: str = ""
    database_ssl: bool = False
    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

_connect_args = {"ssl": True} if settings.database_ssl else {}
engine = create_async_engine(settings.database_url, echo=settings.debug, connect_args=_connect_args)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
