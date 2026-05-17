from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8)
    role: str = "user"


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=150)
    is_active: bool | None = None
    role: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    role: str

    model_config = {"from_attributes": True}
