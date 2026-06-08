from app.services.email._base import BaseEmailService
from app.services.email.events import (
    ProductCreatedEvent,
    ProductDeletedEvent,
    ProductImageUpdatedEvent,
    ProductsIndexedEvent,
    ProductUpdatedEvent,
)


class ProductEmailService(BaseEmailService):
    async def on_product_created(self, event: ProductCreatedEvent) -> None:
        await self._send(f"Product Added: {event.name}", (
            f"A new product has been added to the catalog.\n\n"
            f"ID:          {event.product_id}\n"
            f"Name:        {event.name}\n"
            f"Description: {event.description or '—'}\n"
            f"Price:       ${event.price:.2f}\n"
        ))

    async def on_product_updated(self, event: ProductUpdatedEvent) -> None:
        await self._send(f"Product Updated: {event.name}", (
            f"A product has been updated in the catalog.\n\n"
            f"ID:          {event.product_id}\n"
            f"Name:        {event.name}\n"
            f"Description: {event.description or '—'}\n"
            f"Price:       ${event.price:.2f}\n"
        ))

    async def on_product_deleted(self, event: ProductDeletedEvent) -> None:
        await self._send(f"Product Deleted: {event.name}", (
            f"A product has been removed from the catalog.\n\n"
            f"ID:   {event.product_id}\n"
            f"Name: {event.name}\n"
        ))

    async def on_image_updated(self, event: ProductImageUpdatedEvent) -> None:
        await self._send(f"Product Image Updated: {event.name}", (
            f"The image for a product has been updated.\n\n"
            f"ID:        {event.product_id}\n"
            f"Name:      {event.name}\n"
            f"Image URL: {event.image_url}\n"
        ))

    async def on_products_indexed(self, event: ProductsIndexedEvent) -> None:
        await self._send(f"AI Index Complete: {event.count} product(s) indexed", (
            f"A manual AI indexing run has completed.\n\n"
            f"Products indexed: {event.count}\n"
            f"Message:          {event.message}\n"
        ))
