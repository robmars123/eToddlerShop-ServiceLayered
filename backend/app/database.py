from typing import AsyncGenerator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Settings(BaseSettings):
    database_url: str
    debug: bool = False
    jwt_secret_key: str = "change-this-to-a-long-random-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    upload_dir: str = "uploads"

    azure_openai_endpoint: str = ""
    azure_openai_key: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"
    azure_openai_embeddings: str = "text-embedding-3-small"
    azure_openai_chat: str = "gpt-4o-mini"

    azure_speech_endpoint: str = ""
    azure_speech_key: str = ""
    azure_speech_region: str = "centralus"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
