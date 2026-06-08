from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth_schema import TokenData
from app.schemas.product_schema import ProductBatchRequest, ProductCreate, ProductResponse, ProductUpdate
from app.services.auth.auth_service import require_admin
from app.services.ai.embedding_service import EmbeddingService
from app.services.products.products_service import ProductService
from app.services.ai.recommend_service import RecommendService
from app.services.email.event_publisher import EventPublisher, get_product_event_publisher
from app.services.email.events import (
    ProductCreatedEvent,
    ProductDeletedEvent,
    ProductImageUpdatedEvent,
    ProductUpdatedEvent,
)

router = APIRouter(prefix="/products", tags=["Products"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def get_product_service(db: Annotated[AsyncSession, Depends(get_db)]) -> ProductService:
    return ProductService(db)


def get_embedding_service(db: Annotated[AsyncSession, Depends(get_db)]) -> EmbeddingService:
    return EmbeddingService(db)


def get_recommend_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
) -> RecommendService:
    return RecommendService(db, embedding)


@router.get("/", response_model=list[ProductResponse])
async def list_products(service: Annotated[ProductService, Depends(get_product_service)]):
    return await service.list_products()


@router.post("/batch", response_model=list[ProductResponse])
async def get_products_batch(
    data: ProductBatchRequest,
    service: Annotated[ProductService, Depends(get_product_service)],
):
    return await service.get_products_by_ids(data.ids)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    service: Annotated[ProductService, Depends(get_product_service)],
):
    return await service.get_product(product_id)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    background_tasks: BackgroundTasks,
    service: Annotated[ProductService, Depends(get_product_service)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
    recommend: Annotated[RecommendService, Depends(get_recommend_service)],
    publisher: Annotated[EventPublisher, Depends(get_product_event_publisher)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    product = await service.create_product(data)
    background_tasks.add_task(embedding.embed_single_product, product.id, product.name, product.description, product.price)
    background_tasks.add_task(recommend.invalidate_search_cache)
    background_tasks.add_task(publisher.publish, ProductCreatedEvent(
        product_id=product.id, name=product.name, description=product.description, price=product.price,
    ))
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    background_tasks: BackgroundTasks,
    service: Annotated[ProductService, Depends(get_product_service)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
    recommend: Annotated[RecommendService, Depends(get_recommend_service)],
    publisher: Annotated[EventPublisher, Depends(get_product_event_publisher)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    product = await service.update_product(product_id, data)
    background_tasks.add_task(embedding.embed_single_product, product.id, product.name, product.description, product.price)
    background_tasks.add_task(recommend.invalidate_search_cache)
    background_tasks.add_task(publisher.publish, ProductUpdatedEvent(
        product_id=product.id, name=product.name, description=product.description, price=product.price,
    ))
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    background_tasks: BackgroundTasks,
    service: Annotated[ProductService, Depends(get_product_service)],
    embedding: Annotated[EmbeddingService, Depends(get_embedding_service)],
    recommend: Annotated[RecommendService, Depends(get_recommend_service)],
    publisher: Annotated[EventPublisher, Depends(get_product_event_publisher)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    name = await service.delete_product(product_id)
    background_tasks.add_task(embedding.delete_product_embedding, product_id)
    background_tasks.add_task(recommend.invalidate_search_cache)
    background_tasks.add_task(publisher.publish, ProductDeletedEvent(product_id=product_id, name=name))


@router.post("/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    product_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    service: Annotated[ProductService, Depends(get_product_service)],
    publisher: Annotated[EventPublisher, Depends(get_product_event_publisher)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image type. Use JPEG, PNG, WebP, or GIF.")
    content = await file.read(_MAX_IMAGE_BYTES + 1)
    if len(content) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller.")
    product = await service.upload_image(product_id, file.filename or "image", content)
    background_tasks.add_task(publisher.publish, ProductImageUpdatedEvent(
        product_id=product_id, name=product.name, image_url=product.image_url or "",
    ))
    return product
