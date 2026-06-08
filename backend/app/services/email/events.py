from dataclasses import dataclass
from typing import ClassVar


# ── Product events ────────────────────────────────────────────────────────────

@dataclass
class ProductCreatedEvent:
    event_type: ClassVar[str] = "product.created"
    product_id: int
    name: str
    description: str | None
    price: float


@dataclass
class ProductUpdatedEvent:
    event_type: ClassVar[str] = "product.updated"
    product_id: int
    name: str
    description: str | None
    price: float


@dataclass
class ProductDeletedEvent:
    event_type: ClassVar[str] = "product.deleted"
    product_id: int
    name: str


@dataclass
class ProductImageUpdatedEvent:
    event_type: ClassVar[str] = "product.image_updated"
    product_id: int
    name: str
    image_url: str


@dataclass
class ProductsIndexedEvent:
    event_type: ClassVar[str] = "products.indexed"
    count: int
    message: str


# ── Order events ──────────────────────────────────────────────────────────────

@dataclass
class OrderItemData:
    product_id: int
    quantity: int
    unit_price: float


@dataclass
class OrderPlacedEvent:
    event_type: ClassVar[str] = "order.placed"
    order_id: int
    user_id: int
    total: float
    items: list[OrderItemData]


@dataclass
class OrderStatusChangedEvent:
    event_type: ClassVar[str] = "order.status_changed"
    order_id: int
    user_id: int
    new_status: str


@dataclass
class OrderCancelledEvent:
    event_type: ClassVar[str] = "order.cancelled"
    order_id: int
    user_id: int


@dataclass
class OrderDeletedEvent:
    event_type: ClassVar[str] = "order.deleted"
    order_id: int
    user_id: int
