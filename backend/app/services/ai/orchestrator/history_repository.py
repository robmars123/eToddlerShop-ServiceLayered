import json
from typing import Protocol

import redis
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, messages_from_dict, messages_to_dict

HISTORY_TTL = 3600  # 1 hour


class HistoryRepository(Protocol):
    """Abstracts history storage so the orchestrator never couples to Redis directly."""

    def get(self, session_id: str) -> BaseChatMessageHistory: ...
    def get_messages(self, session_id: str) -> list[BaseMessage]: ...


class _RedisMessageHistory(BaseChatMessageHistory):
    """
    Stores chat history as a JSON blob in Redis.
    Uses the sync redis client — RunnableWithMessageHistory calls add_message/messages
    synchronously, so async redis cannot be used here directly.
    The redis[asyncio] package already includes the sync client; no extra dependency needed.
    """

    def __init__(self, session_id: str, client: redis.Redis, ttl: int) -> None:
        self._key = f"chat_history:{session_id}"
        self._redis = client
        self._ttl = ttl

    @property
    def messages(self) -> list[BaseMessage]:
        raw = self._redis.get(self._key)
        if not raw:
            return []
        return messages_from_dict(json.loads(raw))

    def add_message(self, message: BaseMessage) -> None:
        current = self.messages
        current.append(message)
        self._redis.set(self._key, json.dumps(messages_to_dict(current)), ex=self._ttl)

    def clear(self) -> None:
        self._redis.delete(self._key)


class RedisHistoryRepository:
    """Concrete Redis implementation of HistoryRepository."""

    def __init__(self, redis_url: str, ttl: int = HISTORY_TTL) -> None:
        # One sync client shared across sessions — redis-py connection pool handles concurrency.
        self._client = redis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl

    def get(self, session_id: str) -> BaseChatMessageHistory:
        return _RedisMessageHistory(session_id, self._client, self._ttl)

    def get_messages(self, session_id: str) -> list[BaseMessage]:
        return self.get(session_id).messages
