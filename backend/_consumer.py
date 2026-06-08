import asyncio
import json
import logging
import sys

import aio_pika

from app.database import settings

logger = logging.getLogger("notifier")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )


async def run_consumer(queue_name: str, dispatch: dict, svc, *, deserialize=None) -> None:
    logger.info("Connecting to RabbitMQ at %s", settings.rabbitmq_url)
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    async def handle(message: aio_pika.IncomingMessage) -> None:
        try:
            body = json.loads(message.body)
            event_type: str = body["type"]
            entry = dispatch.get(event_type)
            if entry is None:
                logger.warning("Unknown event type, discarding: %s", event_type)
                await message.nack(requeue=False)
                return
            event_class, method_name = entry
            event = deserialize(event_type, body["data"]) if deserialize else event_class(**body["data"])
            await getattr(svc, method_name)(event)
            await message.ack()
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            logger.error("Malformed message, discarding: %s", exc)
            await message.nack(requeue=False)
        except Exception:
            logger.exception("Transient error processing message, requeuing")
            await message.nack(requeue=True)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=10)
        queue = await channel.declare_queue(queue_name, durable=True)
        await queue.consume(handle)
        logger.info("Notifier ready — consuming from '%s'", queue_name)
        await asyncio.Event().wait()
