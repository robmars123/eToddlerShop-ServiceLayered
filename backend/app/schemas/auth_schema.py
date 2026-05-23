from pydantic import BaseModel


class UserMeResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str


class TokenData(BaseModel):
    user_id: int
    username: str
    role: str
