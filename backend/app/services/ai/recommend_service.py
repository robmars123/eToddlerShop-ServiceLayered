import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.product_embedding import ProductEmbedding
from app.schemas.ai_schema import RecommendFilters, RecommendRequest, RecommendResponse
from app.services.ai._clients import (
    openai_client,
    products_key,
    recommend_key,
    redis_client,
    RECOMMEND_TTL,
)
from app.services.ai.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

_FILTER_EXTRACTION_PROMPT = (
    "You are the AI layer for an ecommerce platform. "
    "Extract structured filters from the user's natural language query. "
    "For the 'query' field: keep ALL semantic concepts from the original query — never drop or simplify terms. "
    "Only remove words that express hard filters (prices, numeric constraints). "
    "If the user mentions multiple things (e.g. 'balls and learning'), keep all of them in the query. "
    "Use price_exact (==) for 'price X / costs X / exactly X / priced at X'. "
    "Use price_min (>=) for 'at least / from / minimum / equal or above / equal to or greater than / no less than / $X and above / $X and up / starting at $X / X and above / X or above / X and up / X+'. "
    "Use price_max (<=) for 'up to / at most / maximum / equal or below / equal to or less than / no more than / $X and below / $X or below / X and below / X or below'. "
    "Use price_above (>) ONLY when the query is strictly exclusive with NO 'and/or' qualifier: 'above $X / over $X / more than $X / greater than $X' — never use price_above when 'and above' or 'or above' is present. "
    "Use price_below (<) ONLY when the query is strictly exclusive with NO 'and/or' qualifier: 'below $X / under $X / less than $X' — never use price_below when 'and below' or 'or below' is present. "
    "Only set one price field at a time unless the query specifies a range. "
    "Return ONLY valid JSON in exactly this shape, with no markdown, no code fences, no explanations:\n"
    '{"query": "<search phrase — preserve all concepts>", "filters": {"category": "", "age": null, '
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


class RecommendService:
    def __init__(self, db: AsyncSession, embedding_service: EmbeddingService) -> None:
        self.db = db
        self._embedding = embedding_service

    async def invalidate_search_cache(self) -> None:
        keys = await redis_client.keys("rec:*")
        if keys:
            await redis_client.delete(*keys)
        await redis_client.delete(products_key())

    async def _extract_filters(self, message: str) -> tuple[str, RecommendFilters]:
        response = await openai_client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": _FILTER_EXTRACTION_PROMPT},
                {"role": "user", "content": message},
            ],
            max_tokens=300,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(raw)
            return parsed.get("query", message), RecommendFilters(**parsed.get("filters", {}))
        except Exception:
            logger.warning("Filter extraction parse failed, falling back to raw message")
            return message, RecommendFilters()

    async def _vector_search(
        self, message: str, query: str, has_price_filter: bool
    ) -> list[ProductEmbedding]:
        query_vector = await self._embedding.get_embedding(message)
        distance = ProductEmbedding.embedding.cosine_distance(query_vector)

        # Pure price queries have an empty semantic query after extraction.
        # Skip distance threshold so all products reach the price filter.
        pure_price_query = has_price_filter and len(query.strip()) < 3

        if pure_price_query:
            result = await self.db.execute(
                select(ProductEmbedding).order_by(distance)
            )
        else:
            max_distance = 0.9 if has_price_filter else 0.75
            result = await self.db.execute(
                select(ProductEmbedding)
                .where(distance < max_distance)
                .order_by(distance)
                .limit(50)
            )
        return list(result.scalars().all())

    @staticmethod
    def _apply_price_filters(
        candidates: list[ProductEmbedding], filters: RecommendFilters
    ) -> list[ProductEmbedding]:
        if filters.price_exact is not None:
            candidates = [e for e in candidates if e.product_price == filters.price_exact]
        if filters.price_min is not None:
            candidates = [e for e in candidates if e.product_price >= filters.price_min]
        if filters.price_max is not None:
            candidates = [e for e in candidates if e.product_price <= filters.price_max]
        if filters.price_above is not None:
            candidates = [e for e in candidates if e.product_price > filters.price_above]
        if filters.price_below is not None:
            candidates = [e for e in candidates if e.product_price < filters.price_below]
        return candidates

    async def _rerank(
        self, message: str, candidates: list[ProductEmbedding], has_price_filter: bool
    ) -> list[int]:
        products_payload = "\n".join(
            f'[{e.product_id}] {e.product_name}: {e.product_description or "No description"}. '
            f'Price: ${e.product_price:.2f}'
            for e in candidates
        )
        rank_message = f'User query: "{message}"\n\nProducts:\n{products_payload}'
        response = await openai_client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": _RANKING_PROMPT},
                {"role": "user", "content": rank_message},
            ],
            max_tokens=500,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        try:
            ranked_ids: list[int] = json.loads(raw).get("rankedProductIds", [])
        except Exception:
            logger.warning("Ranking parse failed, returning vector search order")
            ranked_ids = [e.product_id for e in candidates]

        # With a price filter, ensure every price-matching product is included
        # even if the re-ranker excluded it as semantically irrelevant.
        if has_price_filter:
            ranked_set = set(ranked_ids)
            ranked_ids += [e.product_id for e in candidates if e.product_id not in ranked_set]

        return ranked_ids

    async def recommend(self, request: RecommendRequest) -> RecommendResponse:
        rec_key = recommend_key(request.message)
        cached = await redis_client.get(rec_key)
        if cached is not None:
            return RecommendResponse.model_validate_json(cached)

        query, filters = await self._extract_filters(request.message)

        has_price_filter = any(f is not None for f in [
            filters.price_exact, filters.price_min, filters.price_max,
            filters.price_above, filters.price_below,
        ])

        candidates = await self._vector_search(request.message, query, has_price_filter)
        candidates = self._apply_price_filters(candidates, filters)

        if not candidates:
            return RecommendResponse(ranked_product_ids=[], query=query, filters=filters)

        ranked_ids = await self._rerank(request.message, candidates, has_price_filter)

        response = RecommendResponse(ranked_product_ids=ranked_ids, query=query, filters=filters)
        await redis_client.set(rec_key, response.model_dump_json(), ex=RECOMMEND_TTL)
        return response
