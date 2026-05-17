from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    message: str


class EmbedProductsResponse(BaseModel):
    indexed: int
    message: str


class RecommendRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class RecommendFilters(BaseModel):
    category: str = ""
    age: int | None = None
    price_exact: float | None = None   # exact ==      e.g. "price 50", "costs $50"
    price_min: float | None = None     # inclusive >=  e.g. "at least $50", "from $50"
    price_max: float | None = None     # inclusive <=  e.g. "up to $50", "at most $50"
    price_above: float | None = None   # exclusive >   e.g. "above $50", "over $50"
    price_below: float | None = None   # exclusive <   e.g. "below $50", "under $50"
    tags: list[str] = Field(default_factory=list)


class RecommendResponse(BaseModel):
    ranked_product_ids: list[int]
    query: str
    filters: RecommendFilters


class SpeechTokenResponse(BaseModel):
    token: str
    region: str
