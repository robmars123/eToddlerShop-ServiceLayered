import json
import logging
from collections.abc import AsyncGenerator
from uuid import uuid4

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import AzureChatOpenAI

from app.services.ai.chat_service import ChatService
from app.services.ai.orchestrator.history_repository import HistoryRepository

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a helpful shopping assistant for this store. "
    "Answer ONLY using the products listed below. "
    "Do NOT mention, invent, or reference any product not in this list. "
    "If no product matches the customer's request, say so honestly. "
    "Keep your response concise and friendly.\n\n"
    "Available products:\n{context}"
)

_NO_PRODUCTS_MSG = (
    "I don't have any product information yet. "
    "Please ask an admin to index the products first."
)


class ChatOrchestrator:
    """
    Wires RAG context → prompt template → LLM → Redis-backed history.

    Single responsibility: chain orchestration.
    Context building is delegated to ChatService (SRP).
    History storage is delegated to HistoryRepository (DIP).
    """

    def __init__(
        self,
        chat_service: ChatService,
        history_repo: HistoryRepository,
        llm: AzureChatOpenAI,
    ) -> None:
        self._context_builder = chat_service
        self._chain = self._build_chain(llm, history_repo)

    def _build_chain(self, llm: AzureChatOpenAI, history_repo: HistoryRepository) -> RunnableWithMessageHistory:
        prompt = ChatPromptTemplate.from_messages([
            ("system", _SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="history"),  # injected by RunnableWithMessageHistory
            ("human", "{input}"),
        ])
        return RunnableWithMessageHistory(
            prompt | llm | StrOutputParser(),
            get_session_history=history_repo.get,
            input_messages_key="input",
            history_messages_key="history",
        )

    def _config(self, session_id: str) -> dict:
        return {"configurable": {"session_id": session_id}}

    async def chat(self, message: str, session_id: str | None) -> str:
        context = await self._context_builder.build_context(message)
        if context is None:
            return _NO_PRODUCTS_MSG

        # No session_id = caller wants a one-shot stateless call; uuid ensures
        # the ephemeral key never collides with a real session in Redis.
        sid = session_id or str(uuid4())
        return await self._chain.ainvoke(
            {"input": message, "context": context},
            config=self._config(sid),
        )

    async def chat_stream(self, message: str, session_id: str | None) -> AsyncGenerator[str, None]:
        context = await self._context_builder.build_context(message)
        if context is None:
            yield f"data: {json.dumps({'delta': _NO_PRODUCTS_MSG})}\n\n"
            yield "data: [DONE]\n\n"
            return

        sid = session_id or str(uuid4())
        async for chunk in self._chain.astream(
            {"input": message, "context": context},
            config=self._config(sid),
        ):
            if chunk:
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        yield "data: [DONE]\n\n"
