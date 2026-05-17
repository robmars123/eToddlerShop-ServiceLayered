from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: float = Field(gt=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: float | None = Field(default=None, gt=0)


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    image_url: str | None

    model_config = {"from_attributes": True}
