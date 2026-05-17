from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

_EMBEDDING_DIM = 1536


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    embedding: Mapped[list] = mapped_column(Vector(_EMBEDDING_DIM), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_description: Mapped[str | None] = mapped_column(String(1000))
    product_price: Mapped[float] = mapped_column(Float, nullable=False)
