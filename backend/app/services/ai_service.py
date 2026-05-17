import asyncio
import json
import logging
import time
from typing import Generic, TypeVar

import httpx
from fastapi import HTTPException
from openai import AsyncAzureOpenAI
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.product import Product
from app.models.product_embedding import ProductEmbedding
from app.schemas.ai_schema import (
    ChatRequest,
    ChatResponse,
    EmbedProductsResponse,
    RecommendFilters,
    RecommendRequest,
    RecommendResponse,
    SpeechTokenResponse,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Simple async TTL cache
# ---------------------------------------------------------------------------

T = TypeVar("T")
_NEVER_EXPIRES = float("inf")


class TTLCache(Generic[T]):
    def __init__(self, ttl: float | None = None, maxsize: int = 512) -> None:
        self._ttl = ttl
        self._maxsize = maxsize
        self._store: dict[str, tuple[T, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: T) -> None:
        async with self._lock:
            if key not in self._store and len(self._store) >= self._maxsize:
                self._store.pop(next(iter(self._store)))
            expires_at = (time.monotonic() + self._ttl) if self._ttl is not None else _NEVER_EXPIRES
            self._store[key] = (value, expires_at)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


# Embedding vectors are deterministic for a given model+text — cache forever.
_embedding_cache: TTLCache[list[float]] = TTLCache(ttl=None, maxsize=1024)

# Recommend results are product-data-dependent; expire after 5 minutes.
_recommend_cache: TTLCache[RecommendResponse] = TTLCache(ttl=300, maxsize=256)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_FILTER_EXTRACTION_PROMPT = (
    "You are the AI layer for an ecommerce platform. "
    "Extract structured filters from the user's natural language query. "
    "Use price_exact (==) for 'price X / costs X / exactly X / priced at X'. "
    "Use price_min (>=) for 'at least / from / minimum / equal or above / equal to or greater than / no less than / $X and above / $X and up / starting at $X'. "
    "Use price_max (<=) for 'up to / at most / maximum / equal or below / equal to or less than / no more than / $X and below'. "
    "Use price_above (>) ONLY when the query is strictly exclusive: 'above / over / more than / greater than' WITHOUT the word equal. "
    "Use price_below (<) ONLY when the query is strictly exclusive: 'below / under / less than' WITHOUT the word equal. "
    "Only set one price field at a time unless the query specifies a range. "
    "Return ONLY valid JSON in exactly this shape, with no markdown, no code fences, no explanations:\n"
    '{"query": "<search phrase>", "filters": {"category": "", "age": null, '
    '"price_exact": null, "price_min": null, "price_max": null, "price_above": null, "price_below": null, "tags": []}}'
)

_RANKING_PROMPT = (
    "You are the AI layer for an ecommerce platform. "
    "Given a user query and a list of candidate products, return ONLY the IDs of products "
    "that are genuinely relevant to the query. "
    "Rank them by relevance, most relevant first. "
    "Exclude any product that does not meaningfully match what the user is looking for. "
    "If no products are relevant, return an empty array. "
    "Return ONLY valid JSON in exactly this shape, with no markdown, no code fences, no explanations:\n"
    '{"rankedProductIds": [<id1>, <id2>, ...]}'
)

# ---------------------------------------------------------------------------
# AI service
# ---------------------------------------------------------------------------


class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
        )

    @staticmethod
    def _product_text(name: str, description: str | None, price: float) -> str:
        return f"{name}. {description or 'No description'}. Price: ${price:.2f}"

    async def _get_embedding(self, text: str) -> list[float]:
        cached = await _embedding_cache.get(text)
        if cached is not None:
            return cached
        response = await self._client.embeddings.create(
            input=text, model=settings.azure_openai_embeddings
        )
        vector = response.data[0].embedding
        await _embedding_cache.set(text, vector)
        return vector

    async def _json_completion(self, system_prompt: str, user_message: str) -> str:
        response = await self._client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=500,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content or "{}"

    async def _chat_completion(self, system_prompt: str, user_message: str) -> str:
        response = await self._client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""

    async def invalidate_search_cache(self) -> None:
        await _recommend_cache.clear()

    async def embed_single_product(
        self, product_id: int, name: str, description: str | None, price: float
    ) -> None:
        text = self._product_text(name, description, price)
        vector = await self._client.embeddings.create(
            input=text, model=settings.azure_openai_embeddings
        )
        embedding = vector.data[0].embedding
        stmt = (
            insert(ProductEmbedding)
            .values(
                product_id=product_id,
                embedding=embedding,
                product_name=name,
                product_description=description,
                product_price=price,
            )
            .on_conflict_do_update(
                index_elements=["product_id"],
                set_={
                    "embedding": embedding,
                    "product_name": name,
                    "product_description": description,
                    "product_price": price,
                },
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def embed_products(self) -> EmbedProductsResponse:
        result = await self.db.execute(select(Product))
        products = result.scalars().all()
        for product in products:
            text = self._product_text(product.name, product.description, product.price)
            response = await self._client.embeddings.create(
                input=text, model=settings.azure_openai_embeddings
            )
            embedding = response.data[0].embedding
            stmt = (
                insert(ProductEmbedding)
                .values(
                    product_id=product.id,
                    embedding=embedding,
                    product_name=product.name,
                    product_description=product.description,
                    product_price=product.price,
                )
                .on_conflict_do_update(
                    index_elements=["product_id"],
                    set_={
                        "embedding": embedding,
                        "product_name": product.name,
                        "product_description": product.description,
                        "product_price": product.price,
                    },
                )
            )
            await self.db.execute(stmt)
        await self.db.commit()
        return EmbedProductsResponse(
            indexed=len(products),
            message=f"Indexed {len(products)} product(s) successfully.",
        )

    async def recommend(self, request: RecommendRequest) -> RecommendResponse:
        cache_key = request.message.strip().lower()
        cached = await _recommend_cache.get(cache_key)
        if cached is not None:
            return cached

        # Phase 1: extract clean query + hard filters
        raw_filters = await self._json_completion(_FILTER_EXTRACTION_PROMPT, request.message)
        try:
            parsed = json.loads(raw_filters)
            query = parsed.get("query", request.message)
            filters = RecommendFilters(**parsed.get("filters", {}))
        except Exception:
            logger.warning("Filter extraction parse failed, falling back to raw message")
            query = request.message
            filters = RecommendFilters()

        # Phase 2: vector search
        has_price_filter = any(f is not None for f in [
            filters.price_exact, filters.price_min, filters.price_max,
            filters.price_above, filters.price_below,
        ])
        max_distance = 0.9 if has_price_filter else 0.65

        query_vector = await self._get_embedding(query)
        distance = ProductEmbedding.embedding.cosine_distance(query_vector)
        result = await self.db.execute(
            select(ProductEmbedding)
            .where(distance < max_distance)
            .order_by(distance)
            .limit(50)
        )
        similar = result.scalars().all()

        # Apply hard price filters
        if filters.price_exact is not None:
            similar = [e for e in similar if e.product_price == filters.price_exact]
        if filters.price_min is not None:
            similar = [e for e in similar if e.product_price >= filters.price_min]
        if filters.price_max is not None:
            similar = [e for e in similar if e.product_price <= filters.price_max]
        if filters.price_above is not None:
            similar = [e for e in similar if e.product_price > filters.price_above]
        if filters.price_below is not None:
            similar = [e for e in similar if e.product_price < filters.price_below]

        if not similar:
            return RecommendResponse(ranked_product_ids=[], query=query, filters=filters)

        # Phase 3: AI re-ranking
        products_payload = "\n".join(
            f'[{e.product_id}] {e.product_name}: {e.product_description or "No description"}. '
            f'Price: ${e.product_price:.2f}'
            for e in similar
        )
        rank_message = f'User query: "{request.message}"\n\nProducts:\n{products_payload}'
        raw_ranked = await self._json_completion(_RANKING_PROMPT, rank_message)
        try:
            ranked_ids: list[int] = json.loads(raw_ranked).get("rankedProductIds", [])
        except Exception:
            logger.warning("Ranking parse failed, returning vector search order")
            ranked_ids = [e.product_id for e in similar]

        if has_price_filter:
            ranked_set = set(ranked_ids)
            ranked_ids += [e.product_id for e in similar if e.product_id not in ranked_set]

        response = RecommendResponse(ranked_product_ids=ranked_ids, query=query, filters=filters)
        await _recommend_cache.set(cache_key, response)
        return response

    async def chat(self, request: ChatRequest) -> ChatResponse:
        query_vector = await self._get_embedding(request.message)
        distance = ProductEmbedding.embedding.cosine_distance(query_vector)
        result = await self.db.execute(
            select(ProductEmbedding).where(distance < 0.7).order_by(distance).limit(5)
        )
        similar = result.scalars().all()

        if not similar:
            return ChatResponse(
                message=(
                    "I don't have any product information yet. "
                    "Please ask an admin to index the products first."
                )
            )

        context = "\n".join(
            f"- {e.product_name}: {e.product_description or 'No description'}. "
            f"Price: ${e.product_price:.2f}"
            for e in similar
        )
        system_prompt = (
            "You are a helpful shopping assistant. "
            "Use only the following product catalog to answer the customer's question. "
            "Keep your response concise and friendly.\n\n"
            f"Available products:\n{context}"
        )
        reply = await self._chat_completion(system_prompt, request.message)
        return ChatResponse(message=reply)


# ---------------------------------------------------------------------------
# Speech service
# ---------------------------------------------------------------------------


class SpeechService:
    def __init__(self) -> None:
        self._key = settings.azure_speech_key
        self._endpoint = settings.azure_speech_endpoint.rstrip("/")
        self.region = settings.azure_speech_region

    async def issue_token(self) -> str:
        if not self._key:
            raise HTTPException(status_code=503, detail="Azure Speech Service is not configured.")
        url = f"{self._endpoint}/sts/v1.0/issueToken"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers={"Ocp-Apim-Subscription-Key": self._key})
                response.raise_for_status()
                return response.text
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Azure Speech token request failed: {e.response.status_code}",
            ) from e
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail="Could not reach Azure Speech Service.") from e
