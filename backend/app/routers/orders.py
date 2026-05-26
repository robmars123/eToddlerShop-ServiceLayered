from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth_schema import TokenData
from app.schemas.order_schema import OrderAnalytics, OrderCreate, OrderResponse, OrderUpdate
from app.services.auth.auth_service import get_current_user, require_admin
from app.services.orders.orders_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


def get_order_service(db: Annotated[AsyncSession, Depends(get_db)]) -> OrderService:
    return OrderService(db)


@router.get("/analytics", response_model=OrderAnalytics)
async def get_order_analytics(
    service: Annotated[OrderService, Depends(get_order_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    return await service.get_analytics()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    service: Annotated[OrderService, Depends(get_order_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    return await service.list_orders()


@router.get("/my", response_model=list[OrderResponse])
async def list_my_orders(
    service: Annotated[OrderService, Depends(get_order_service)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
):
    """Return orders belonging to the currently authenticated user."""
    return await service.list_user_orders(current_user.user_id)


@router.get("/user/{user_id}", response_model=list[OrderResponse])
async def list_user_orders(
    user_id: int,
    service: Annotated[OrderService, Depends(get_order_service)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
):
    """Admins can view any user's orders; regular users can only view their own."""
    if current_user.role != "admin" and current_user.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return await service.list_user_orders(user_id)


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    service: Annotated[OrderService, Depends(get_order_service)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
):
    """Create an order for the authenticated user. user_id from token always takes precedence."""
    order_data = data.model_copy(update={"user_id": current_user.user_id})
    return await service.create_order(order_data)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    service: Annotated[OrderService, Depends(get_order_service)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
):
    """Cancel a pending order. Only the order owner may cancel."""
    return await service.cancel_order(order_id, current_user.user_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    data: OrderUpdate,
    service: Annotated[OrderService, Depends(get_order_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    return await service.update_order_status(order_id, data)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    service: Annotated[OrderService, Depends(get_order_service)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    await service.delete_order(order_id)
