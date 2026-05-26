from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.schemas.order_schema import OrderCreate, OrderItemResponse, OrderResponse, OrderStatus, OrderUpdate


def _to_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        status=OrderStatus(order.status),
        items=[
            OrderItemResponse(
                id=i.id,
                product_id=i.product_id,
                quantity=i.quantity,
                unit_price=i.unit_price,
            )
            for i in order.items
        ],
        created_at=order.created_at,
    )


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_orders(self) -> list[OrderResponse]:
        result = await self.db.execute(select(Order).options(selectinload(Order.items)))
        return [_to_response(o) for o in result.scalars().all()]

    async def list_user_orders(self, user_id: int) -> list[OrderResponse]:
        result = await self.db.execute(
            select(Order).where(Order.user_id == user_id).options(selectinload(Order.items))
        )
        return [_to_response(o) for o in result.scalars().all()]

    async def create_order(self, data: OrderCreate) -> OrderResponse:
        order = Order(
            user_id=data.user_id,
            status="pending",
            items=[
                OrderItem(product_id=i.product_id, quantity=i.quantity, unit_price=i.unit_price)
                for i in data.items
            ],
        )
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        result = await self.db.execute(
            select(Order).where(Order.id == order.id).options(selectinload(Order.items))
        )
        return _to_response(result.scalar_one())

    async def update_order_status(self, order_id: int, data: OrderUpdate) -> OrderResponse:
        result = await self.db.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if data.status is not None:
            order.status = data.status.value
        await self.db.commit()
        result2 = await self.db.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        )
        return _to_response(result2.scalar_one())

    async def cancel_order(self, order_id: int, user_id: int) -> OrderResponse:
        result = await self.db.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if order.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if order.status not in ("pending",):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel an order with status '{order.status}'",
            )
        order.status = "cancelled"
        await self.db.commit()
        await self.db.refresh(order)
        result2 = await self.db.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        )
        return _to_response(result2.scalar_one())

    async def delete_order(self, order_id: int) -> None:
        order = await self.db.get(Order, order_id)
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        await self.db.delete(order)
        await self.db.commit()
