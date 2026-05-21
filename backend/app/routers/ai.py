from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.ai_schema import (
    ChatRequest,
    ChatResponse,
    EmbedProductsResponse,
    RecommendRequest,
    RecommendResponse,
    SpeechTokenResponse,
)
from app.schemas.auth_schema import TokenData
from app.services.auth.auth_service import require_admin
from app.services.ai.chat_service import ChatService
from app.services.ai.embedding_service import EmbeddingService
from app.services.ai.recommend_service import RecommendService
from app.services.ai.speech_service import SpeechService

router = APIRouter(prefix="/ai", tags=["AI"])


def get_embedding_service(db: Annotated[AsyncSession, Depends(get_db)]) -> EmbeddingService:
    return EmbeddingService(db)


def get_recommend_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
) -> RecommendService:
    return RecommendService(db, embedding)


def get_chat_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    recommend: Annotated[RecommendService, Depends(get_recommend_service)],
) -> ChatService:
    return ChatService(db, recommend)


def get_speech_service() -> SpeechService:
    return SpeechService()


@router.post("/embed-products", response_model=EmbedProductsResponse)
async def embed_products(
    service: Annotated[EmbeddingService, Depends(get_embedding_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    return await service.embed_products()


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    request: RecommendRequest,
    service: Annotated[RecommendService, Depends(get_recommend_service)],
):
    return await service.recommend(request)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return await service.chat(request)


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return StreamingResponse(
        service.chat_stream(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/speech-token", response_model=SpeechTokenResponse)
async def speech_token(
    speech: Annotated[SpeechService, Depends(get_speech_service)],
):
    token = await speech.issue_token()
    return SpeechTokenResponse(token=token, region=speech.region)
