import asyncio
from dotenv import load_dotenv
load_dotenv()

from _consumer import run_consumer, setup_logging
from app.services.email.email_service import ProductEmailService
from app.services.email.event_publisher import PRODUCT_EVENTS_QUEUE
from app.services.email.events import (
    ProductCreatedEvent,
    ProductDeletedEvent,
    ProductImageUpdatedEvent,
    ProductsIndexedEvent,
    ProductUpdatedEvent,
)

_DISPATCH = {
    ProductCreatedEvent.event_type:      (ProductCreatedEvent,      "on_product_created"),
    ProductUpdatedEvent.event_type:      (ProductUpdatedEvent,       "on_product_updated"),
    ProductDeletedEvent.event_type:      (ProductDeletedEvent,       "on_product_deleted"),
    ProductImageUpdatedEvent.event_type: (ProductImageUpdatedEvent,  "on_image_updated"),
    ProductsIndexedEvent.event_type:     (ProductsIndexedEvent,      "on_products_indexed"),
}


async def main() -> None:
    svc = ProductEmailService.from_settings()
    await run_consumer(PRODUCT_EVENTS_QUEUE, _DISPATCH, svc)


if __name__ == "__main__":
    setup_logging()
    asyncio.run(main())
