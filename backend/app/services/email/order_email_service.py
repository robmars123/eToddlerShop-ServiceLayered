from app.services.email._base import BaseEmailService
from app.services.email.events import (
    OrderCancelledEvent,
    OrderDeletedEvent,
    OrderPlacedEvent,
    OrderStatusChangedEvent,
)


class OrderEmailService(BaseEmailService):
    async def on_order_placed(self, event: OrderPlacedEvent) -> None:
        lines = "\n".join(
            f"  - Product #{i.product_id}  qty {i.quantity}  @ ${i.unit_price:.2f}"
            for i in event.items
        )
        await self._send(f"New Order #{event.order_id} Placed", (
            f"A new order has been placed.\n\n"
            f"Order ID: {event.order_id}\n"
            f"User ID:  {event.user_id}\n"
            f"Total:    ${event.total:.2f}\n\n"
            f"Items:\n{lines}\n"
        ))

    async def on_order_status_changed(self, event: OrderStatusChangedEvent) -> None:
        await self._send(f"Order #{event.order_id} Status: {event.new_status.capitalize()}", (
            f"An order status has been updated.\n\n"
            f"Order ID:   {event.order_id}\n"
            f"User ID:    {event.user_id}\n"
            f"New Status: {event.new_status.upper()}\n"
        ))

    async def on_order_cancelled(self, event: OrderCancelledEvent) -> None:
        await self._send(f"Order #{event.order_id} Cancelled", (
            f"An order has been cancelled.\n\n"
            f"Order ID: {event.order_id}\n"
            f"User ID:  {event.user_id}\n"
        ))

    async def on_order_deleted(self, event: OrderDeletedEvent) -> None:
        await self._send(f"Order #{event.order_id} Deleted", (
            f"An order has been permanently deleted by an administrator.\n\n"
            f"Order ID: {event.order_id}\n"
            f"User ID:  {event.user_id}\n"
        ))
