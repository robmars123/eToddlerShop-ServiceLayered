import asyncio
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import settings
from app.models.product import Product
from app.schemas.product_schema import ProductCreate, ProductResponse, ProductUpdate

_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class ProductService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_products(self) -> list[ProductResponse]:
        result = await self.db.execute(select(Product))
        return [ProductResponse.model_validate(p) for p in result.scalars().all()]

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
        return ProductResponse.model_validate(product)

    async def delete_product(self, product_id: int) -> None:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        await self.db.delete(product)
        await self.db.commit()

    async def upload_image(self, product_id: int, filename: str, content: bytes) -> ProductResponse:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        products_dir = Path(settings.upload_dir) / "products"
        products_dir.mkdir(parents=True, exist_ok=True)
        if product.image_url:
            old_file = products_dir / Path(product.image_url).name
            if old_file.exists():
                await asyncio.to_thread(old_file.unlink)
        suffix = Path(filename).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            suffix = ".jpg"
        dest = products_dir / f"{product_id}_{uuid.uuid4().hex}{suffix}"
        await asyncio.to_thread(dest.write_bytes, content)
        product.image_url = f"/uploads/products/{dest.name}"
        await self.db.commit()
        await self.db.refresh(product)
        return ProductResponse.model_validate(product)
