import asyncio
import dataclasses
import json
import logging

import aio_pika

from app.database import settings

logger = logging.getLogger(__name__)

PRODUCT_EVENTS_QUEUE = "product_events"
ORDER_EVENTS_QUEUE = "order_events"

_channel: aio_pika.RobustChannel | None = None
_lock: asyncio.Lock = asyncio.Lock()


async def _get_channel() -> aio_pika.RobustChannel:
    global _channel
    if _channel is not None and not _channel.is_closed:
        return _channel
    async with _lock:
        if _channel is None or _channel.is_closed:
            conn = await aio_pika.connect_robust(settings.rabbitmq_url)
            ch = await conn.channel()
            await ch.declare_queue(PRODUCT_EVENTS_QUEUE, durable=True)
            await ch.declare_queue(ORDER_EVENTS_QUEUE, durable=True)
            _channel = ch
    return _channel


class EventPublisher:
    def __init__(self, queue: str) -> None:
        self._queue = queue

    async def publish(self, event) -> None:
        try:
            channel = await _get_channel()
            body = json.dumps({
                "type": event.event_type,
                "data": dataclasses.asdict(event),
            }).encode()
            await channel.default_exchange.publish(
                aio_pika.Message(body=body, delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
                routing_key=self._queue,
            )
            logger.info("Published %s → %s", event.event_type, self._queue)
        except Exception:
            logger.exception("Failed to publish %s", type(event).__name__)


def get_product_event_publisher() -> EventPublisher:
    return EventPublisher(PRODUCT_EVENTS_QUEUE)


def get_order_event_publisher() -> EventPublisher:
    return EventPublisher(ORDER_EVENTS_QUEUE)
