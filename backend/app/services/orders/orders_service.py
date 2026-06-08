from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.schemas.order_schema import (
    OrderAnalytics, OrderCreate, OrderItemResponse, OrderPeriodStat,
    OrderResponse, OrderStatus, OrderUpdate,
)


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

    async def get_analytics(self) -> OrderAnalytics:
        async def _grouped(trunc: str) -> list[OrderPeriodStat]:
            rows = await self.db.execute(
                select(
                    func.date_trunc(trunc, Order.created_at).label("period"),
                    func.count(func.distinct(Order.id)).label("count"),
                    func.coalesce(
                        func.sum(OrderItem.unit_price * OrderItem.quantity), 0
                    ).label("revenue"),
                )
                .join(OrderItem, OrderItem.order_id == Order.id)
                .where(Order.status != "cancelled")
                .group_by("period")
                .order_by("period")
            )
            fmt = {"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[trunc]
            return [
                OrderPeriodStat(
                    period=row.period.strftime(fmt),
                    count=row.count,
                    revenue=round(float(row.revenue), 2),
                )
                for row in rows
            ]

        by_day, by_month, by_year = (
            await _grouped("day"),
            await _grouped("month"),
            await _grouped("year"),
        )
        # Totals from all-time data before slicing for display windows
        total_orders = sum(s.count for s in by_year)
        total_revenue = round(sum(s.revenue for s in by_year), 2)
        return OrderAnalytics(
            by_day=by_day[-30:],
            by_month=by_month[-12:],
            by_year=by_year,
            total_orders=total_orders,
            total_revenue=total_revenue,
        )

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

    async def delete_order(self, order_id: int) -> int:
        order = await self.db.get(Order, order_id)
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        user_id = order.user_id
        await self.db.delete(order)
        await self.db.commit()
        return user_id
