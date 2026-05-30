# Responsible for one thing: building the RAG product context string.
# The orchestrator layer owns prompt construction, history, and LLM calls.
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.product_embedding import ProductEmbedding
from app.schemas.ai_schema import RecommendRequest
from app.services.ai.recommend_service import RecommendService

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, db: AsyncSession, recommend_service: RecommendService) -> None:
        self.db = db
        self._recommend = recommend_service

    async def build_context(self, message: str) -> str | None:
        """Returns a formatted product context string, or None if nothing is indexed."""
        recommend_result = await self._recommend.recommend(RecommendRequest(message=message))

        if recommend_result.ranked_product_ids:
            id_list = recommend_result.ranked_product_ids[:10]
            rows = await self.db.execute(select(Product).where(Product.id.in_(id_list)))
            product_map = {p.id: p for p in rows.scalars().all()}
            products = [product_map[pid] for pid in id_list if pid in product_map]
        else:
            products = []

        # Broad queries ("list all", "show me everything") return no ranked IDs.
        # Fall back to all products so the assistant can still respond helpfully.
        if not products:
            has_embeddings = await self.db.execute(select(ProductEmbedding).limit(1))
            if not has_embeddings.scalar_one_or_none():
                return None
            fallback = await self.db.execute(select(Product).limit(10))
            products = list(fallback.scalars().all())

        if not products:
            return None

        return "\n".join(
            f"- {p.name}: {p.description or 'No description'}. Price: ${p.price:.2f}"
            for p in products
        )
