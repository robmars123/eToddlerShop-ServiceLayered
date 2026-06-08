import asyncio
from dotenv import load_dotenv
load_dotenv()

from _consumer import run_consumer, setup_logging
from app.services.email.event_publisher import ORDER_EVENTS_QUEUE
from app.services.email.events import (
    OrderCancelledEvent,
    OrderDeletedEvent,
    OrderItemData,
    OrderPlacedEvent,
    OrderStatusChangedEvent,
)
from app.services.email.order_email_service import OrderEmailService

_DISPATCH = {
    OrderPlacedEvent.event_type:        (OrderPlacedEvent,        "on_order_placed"),
    OrderStatusChangedEvent.event_type: (OrderStatusChangedEvent, "on_order_status_changed"),
    OrderCancelledEvent.event_type:     (OrderCancelledEvent,     "on_order_cancelled"),
    OrderDeletedEvent.event_type:       (OrderDeletedEvent,       "on_order_deleted"),
}


def _deserialize(event_type: str, data: dict):
    if event_type == OrderPlacedEvent.event_type:
        data["items"] = [OrderItemData(**i) for i in data.pop("items", [])]
    return _DISPATCH[event_type][0](**data)


async def main() -> None:
    svc = OrderEmailService.from_settings()
    await run_consumer(ORDER_EVENTS_QUEUE, _DISPATCH, svc, deserialize=_deserialize)


if __name__ == "__main__":
    setup_logging()
    asyncio.run(main())
