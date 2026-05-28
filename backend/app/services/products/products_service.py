import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import redis.asyncio as aioredis
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, ContentSettings, generate_blob_sas
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.product import Product
from app.schemas.product_schema import ProductCreate, ProductResponse, ProductUpdate

_redis: aioredis.Redis = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)

_PRODUCTS_KEY = "products:all"
_PRODUCTS_TTL = 60  # 1 minute


async def _cache_get(key: str) -> str | None:
    try:
        return await _redis.get(key)
    except Exception:
        return None


async def _cache_set(key: str, value: str, ex: int) -> None:
    try:
        await _redis.set(key, value, ex=ex)
    except Exception:
        pass


async def _cache_delete(key: str) -> None:
    try:
        await _redis.delete(key)
    except Exception:
        pass

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _blob_client() -> BlobServiceClient:
    return BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)


class ProductService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_products(self) -> list[ProductResponse]:
        cached = await _cache_get(_PRODUCTS_KEY)
        if cached is not None:
            return [ProductResponse.model_validate(p) for p in json.loads(cached)]
        result = await self.db.execute(select(Product))
        products = [ProductResponse.model_validate(p) for p in result.scalars().all()]
        await _cache_set(_PRODUCTS_KEY, json.dumps([p.model_dump() for p in products]), ex=_PRODUCTS_TTL)
        return products

    async def get_products_by_ids(self, ids: list[int]) -> list[ProductResponse]:
        result = await self.db.execute(select(Product).where(Product.id.in_(ids)))
        product_map = {p.id: ProductResponse.model_validate(p) for p in result.scalars().all()}
        return [product_map[i] for i in ids if i in product_map]

    async def get_product(self, product_id: int) -> ProductResponse:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return ProductResponse.model_validate(product)

    async def create_product(self, data: ProductCreate) -> ProductResponse:
        product = Product(name=data.name, description=data.description, price=data.price)
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        await _cache_delete(_PRODUCTS_KEY)
        return ProductResponse.model_validate(product)

    async def update_product(self, product_id: int, data: ProductUpdate) -> ProductResponse:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        if data.name is not None:
            product.name = data.name
        if data.description is not None:
            product.description = data.description
        if data.price is not None:
            product.price = data.price
        await self.db.commit()
        await self.db.refresh(product)
        await _cache_delete(_PRODUCTS_KEY)
        return ProductResponse.model_validate(product)

    async def delete_product(self, product_id: int) -> None:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        if product.image_url:
            self._delete_blob(product.image_url)
        await self.db.delete(product)
        await self.db.commit()
        await _cache_delete(_PRODUCTS_KEY)

    async def upload_image(self, product_id: int, filename: str, content: bytes) -> ProductResponse:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        suffix = Path(filename).suffix.lower()
        content_type = _CONTENT_TYPES.get(suffix, "image/jpeg")
        if suffix not in _CONTENT_TYPES:
            suffix = ".jpg"

        blob_name = f"{product_id}_{uuid.uuid4().hex}{suffix}"

        if product.image_url:
            self._delete_blob(product.image_url)

        blob_url = self._upload_blob(blob_name, content, content_type)
        product.image_url = blob_url
        await self.db.commit()
        await self.db.refresh(product)
        await _cache_delete(_PRODUCTS_KEY)
        return ProductResponse.model_validate(product)

    def _upload_blob(self, blob_name: str, content: bytes, content_type: str) -> str:
        client = _blob_client()
        container = client.get_container_client(settings.azure_storage_container)
        container.upload_blob(
            name=blob_name,
            data=content,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        sas_token = generate_blob_sas(
            account_name=client.account_name,
            container_name=settings.azure_storage_container,
            blob_name=blob_name,
            account_key=client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(days=365 * 10),
        )
        return f"https://{client.account_name}.blob.core.windows.net/{settings.azure_storage_container}/{blob_name}?{sas_token}"

    def _delete_blob(self, blob_url: str) -> None:
        blob_name = blob_url.split("/")[-1].split("?")[0]
        try:
            _blob_client().get_blob_client(
                container=settings.azure_storage_container,
                blob=blob_name,
            ).delete_blob()
        except Exception:
            pass
