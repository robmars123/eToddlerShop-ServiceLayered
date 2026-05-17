from typing import Annotated

from fastapi import APIRouter, Depends
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
from app.services.ai_service import AIService, SpeechService
from app.services.auth_service import require_admin

router = APIRouter(prefix="/ai", tags=["AI"])


def get_ai_service(db: Annotated[AsyncSession, Depends(get_db)]) -> AIService:
    return AIService(db)


def get_speech_service() -> SpeechService:
    return SpeechService()


@router.post("/embed-products", response_model=EmbedProductsResponse)
async def embed_products(
    service: Annotated[AIService, Depends(get_ai_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    return await service.embed_products()


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    request: RecommendRequest,
    service: Annotated[AIService, Depends(get_ai_service)],
):
    return await service.recommend(request)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    service: Annotated[AIService, Depends(get_ai_service)],
):
    return await service.chat(request)


@router.get("/speech-token", response_model=SpeechTokenResponse)
async def speech_token(speech: Annotated[SpeechService, Depends(get_speech_service)]):
    token = await speech.issue_token()
    return SpeechTokenResponse(token=token, region=speech.region)
