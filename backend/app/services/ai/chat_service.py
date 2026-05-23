# RAG-based chat service grounded on the live product catalogue.
# Calls RecommendService internally to retrieve relevant products, builds a
# context string from the products table (never from cached embeddings),
# and streams GPT-4o-mini responses as SSE chunks. The system prompt explicitly
# prevents the model from referencing products outside the provided context.
import json
import logging
from collections.abc import AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.product import Product
from app.models.product_embedding import ProductEmbedding
from app.schemas.ai_schema import ChatRequest, ChatResponse, RecommendRequest
from app.services.ai._clients import openai_client
from app.services.ai.recommend_service import RecommendService

logger = logging.getLogger(__name__)

_NO_PRODUCTS_MSG = (
    "I don't have any product information yet. "
    "Please ask an admin to index the products first."
)

_SYSTEM_PROMPT_TEMPLATE = (
    "You are a helpful shopping assistant for this store. "
    "Answer ONLY using the products listed below. "
    "Do NOT mention, invent, or reference any product not in this list. "
    "If no product matches the customer's request, say so honestly. "
    "Keep your response concise and friendly.\n\n"
    "Available products:\n{context}"
)


class ChatService:
    def __init__(self, db: AsyncSession, recommend_service: RecommendService) -> None:
        self.db = db
        self._recommend = recommend_service

    async def _build_context(self, message: str) -> str | None:
        """Returns a formatted product context string, or None if nothing is indexed."""
        recommend_result = await self._recommend.recommend(RecommendRequest(message=message))

        if recommend_result.ranked_product_ids:
            id_list = recommend_result.ranked_product_ids[:10]
            rows = await self.db.execute(
                select(Product).where(Product.id.in_(id_list))
            )
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

    async def chat(self, request: ChatRequest) -> ChatResponse:
        context = await self._build_context(request.message)
        if context is None:
            return ChatResponse(message=_NO_PRODUCTS_MSG)

        system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(context=context)
        response = await openai_client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        return ChatResponse(message=response.choices[0].message.content or "")

    async def chat_stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        context = await self._build_context(request.message)
        if context is None:
            yield f"data: {json.dumps({'delta': _NO_PRODUCTS_MSG})}\n\n"
            yield "data: [DONE]\n\n"
            return

        system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(context=context)
        stream = await openai_client.chat.completions.create(
            model=settings.azure_openai_chat,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            max_tokens=500,
            temperature=0.7,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        yield "data: [DONE]\n\n"
