from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.order_schema import OrderCreate, OrderResponse, OrderUpdate
from app.services.orders.orders_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


def get_order_service(db: Annotated[AsyncSession, Depends(get_db)]) -> OrderService:
    return OrderService(db)


@router.get("/", response_model=list[OrderResponse])
async def list_orders(service: Annotated[OrderService, Depends(get_order_service)]):
    return await service.list_orders()


@router.get("/user/{user_id}", response_model=list[OrderResponse])
async def list_user_orders(
    user_id: int,
    service: Annotated[OrderService, Depends(get_order_service)],
):
    return await service.list_user_orders(user_id)


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    service: Annotated[OrderService, Depends(get_order_service)],
):
    return await service.create_order(data)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    data: OrderUpdate,
    service: Annotated[OrderService, Depends(get_order_service)],
):
    return await service.update_order_status(order_id, data)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    service: Annotated[OrderService, Depends(get_order_service)],
):
    await service.delete_order(order_id)
