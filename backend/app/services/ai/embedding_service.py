# Generates and persists vector embeddings for products using Azure OpenAI.
# Embeddings are stored in the product_embeddings table (pgvector) and used
# by RecommendService for cosine similarity search. Individual embeddings are
# cached in Redis for 30 days since the same text always produces the same vector.
import json
import logging

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.product_embedding import ProductEmbedding
from app.schemas.ai_schema import EmbedProductsResponse
from app.database import settings
from app.services.ai._clients import embed_key, openai_client, redis_client, EMBED_TTL

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _product_text(name: str, description: str | None, price: float) -> str:
        return f"{name}. {description or 'No description'}. Price: ${price:.2f}"

    async def get_embedding(self, text: str) -> list[float]:
        key = embed_key(text)
        cached = await redis_client.get(key)
        if cached is not None:
            return json.loads(cached)
        response = await openai_client.embeddings.create(
            input=text, model=settings.azure_openai_embeddings
        )
        vector = response.data[0].embedding
        await redis_client.set(key, json.dumps(vector), ex=EMBED_TTL)
        return vector

    async def embed_single_product(
        self, product_id: int, name: str, description: str | None, price: float
    ) -> None:
        text = self._product_text(name, description, price)
        response = await openai_client.embeddings.create(
            input=text, model=settings.azure_openai_embeddings
        )
        embedding = response.data[0].embedding
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
            response = await openai_client.embeddings.create(
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

    async def delete_product_embedding(self, product_id: int) -> None:
        await self.db.execute(
            ProductEmbedding.__table__.delete().where(
                ProductEmbedding.product_id == product_id
            )
        )
        await self.db.commit()
