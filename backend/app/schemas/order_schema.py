from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)


class OrderCreate(BaseModel):
    user_id: int
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    items: list[OrderItemResponse]
    created_at: datetime | None

    model_config = {"from_attributes": True}


class OrderPeriodStat(BaseModel):
    period: str
    count: int
    revenue: float


class OrderAnalytics(BaseModel):
    by_day: list[OrderPeriodStat]
    by_month: list[OrderPeriodStat]
    by_year: list[OrderPeriodStat]
    total_orders: int
    total_revenue: float
