# Shared Azure OpenAI and Redis clients used by all AI services.
# Centralised here so every service imports from one place instead of
# each constructing its own connection. Also owns cache key builders
# and TTL constants so those never drift out of sync across services.
import hashlib

import redis.asyncio as aioredis
from langchain_openai import AzureChatOpenAI
from openai import AsyncAzureOpenAI

from app.database import settings

redis_client: aioredis.Redis = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)

openai_client: AsyncAzureOpenAI = AsyncAzureOpenAI(
    azure_endpoint=settings.azure_openai_endpoint,
    api_key=settings.azure_openai_key,
    api_version=settings.azure_openai_api_version,
)

# LangChain wrapper used by ChatOrchestrator — separate from openai_client
# because LangChain chains require its own runnable interface.
langchain_llm: AzureChatOpenAI = AzureChatOpenAI(
    azure_endpoint=settings.azure_openai_endpoint,
    api_key=settings.azure_openai_key,
    api_version=settings.azure_openai_api_version,
    azure_deployment=settings.azure_openai_chat,
    temperature=0.7,
    max_tokens=500,
)

EMBED_TTL = 60 * 60 * 24 * 30  # 30 days
RECOMMEND_TTL = 300              # 5 minutes
PRODUCTS_TTL = 60               # 1 minute


def embed_key(text: str) -> str:
    return f"emb:{hashlib.md5(text.encode()).hexdigest()}"


def recommend_key(message: str) -> str:
    return f"rec:{hashlib.md5(message.strip().lower().encode()).hexdigest()}"


def products_key() -> str:
    return "products:all"
