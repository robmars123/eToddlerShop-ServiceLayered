import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from app.database import Base, SessionLocal, engine, settings
from app.routers import ai, auth, orders, products, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import models here so SQLAlchemy registers them before create_all
    from app.models import order, product, product_embedding, user  # noqa: F401

    Path(settings.upload_dir, "products").mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)")
        )

    await _seed_admin()
    yield


async def _seed_admin() -> None:
    import bcrypt
    from app.models.user import User

    hashed = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode()
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none() is None:
            session.add(User(
                email="admin@example.com",
                username="admin",
                hashed_password=hashed,
                is_active=True,
                role="admin",
            ))
            await session.commit()


if os.getenv("DEBUG_PORT"):
    import debugpy
    debugpy.listen(("0.0.0.0", int(os.getenv("DEBUG_PORT", "5678"))))
    print(f"[debugpy] listening on port {os.getenv('DEBUG_PORT')} — attach VS Code now")

app = FastAPI(title="API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir, html=False), name="uploads")


@app.get("/")
def root():
    return {"message": "API is running"}
