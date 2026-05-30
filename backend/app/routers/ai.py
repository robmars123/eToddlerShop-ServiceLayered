from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, settings
from app.schemas.ai_schema import (
    ChatHistoryMessage,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    EmbedProductsResponse,
    RecommendRequest,
    RecommendResponse,
    SpeechTokenResponse,
)
from app.schemas.auth_schema import TokenData
from app.services.ai._clients import langchain_llm
from app.services.ai.chat_service import ChatService
from app.services.ai.embedding_service import EmbeddingService
from app.services.ai.orchestrator.chat_orchestrator import ChatOrchestrator
from app.services.ai.orchestrator.history_repository import RedisHistoryRepository
from app.services.ai.recommend_service import RecommendService
from app.services.ai.speech_service import SpeechService
from app.services.auth.auth_service import require_admin

router = APIRouter(prefix="/ai", tags=["AI"])


def get_embedding_service(db: Annotated[AsyncSession, Depends(get_db)]) -> EmbeddingService:
    return EmbeddingService(db)


def get_recommend_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
) -> RecommendService:
    return RecommendService(db, embedding)


def get_chat_orchestrator(
    db: Annotated[AsyncSession, Depends(get_db)],
    recommend: Annotated[RecommendService, Depends(get_recommend_service)],
) -> ChatOrchestrator:
    chat_service = ChatService(db, recommend)
    history_repo = RedisHistoryRepository(settings.redis_url)
    return ChatOrchestrator(chat_service, history_repo, langchain_llm)


def get_history_repo() -> RedisHistoryRepository:
    return RedisHistoryRepository(settings.redis_url)


def get_speech_service() -> SpeechService:
    return SpeechService()


@router.get("/chat/history", response_model=ChatHistoryResponse)
async def chat_history(
    session_id: str,
    repo: Annotated[RedisHistoryRepository, Depends(get_history_repo)],
):
    messages = repo.get_messages(session_id)
    # Convert LangChain message types to the simple role/content shape the client expects.
    return ChatHistoryResponse(messages=[
        ChatHistoryMessage(
            role="user" if m.type == "human" else "assistant",
            content=m.content,
        )
        for m in messages
    ])


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
    orchestrator: Annotated[ChatOrchestrator, Depends(get_chat_orchestrator)],
):
    message = await orchestrator.chat(request.message, request.session_id)
    return ChatResponse(message=message)


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    orchestrator: Annotated[ChatOrchestrator, Depends(get_chat_orchestrator)],
):
    return StreamingResponse(
        orchestrator.chat_stream(request.message, request.session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/speech-token", response_model=SpeechTokenResponse)
async def speech_token(
    speech: Annotated[SpeechService, Depends(get_speech_service)],
):
    token = await speech.issue_token()
    return SpeechTokenResponse(token=token, region=speech.region)
