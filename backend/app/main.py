import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from app.database import Base, SessionLocal, engine, settings
from app.routers import ai, auth, health, orders, products, users

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.models import order, product, product_embedding, user  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Additive migrations — safe to run on every startup
        await conn.execute(
            text("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS entra_oid VARCHAR(36)")
        )
        # Remove the unique constraint on username; Entra display names are not globally unique
        await conn.execute(text("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'users_username_key' AND conrelid = 'users'::regclass
                ) THEN
                    ALTER TABLE users DROP CONSTRAINT users_username_key;
                END IF;
            END $$;
        """))

    await _seed_admin()
    yield


async def _seed_admin() -> None:
    from app.models.user import User

    admin_email = settings.azure_entra_admin_email
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        if result.scalar_one_or_none() is None:
            session.add(User(
                email=admin_email,
                username="admin",
                is_active=True,
                role="admin",
            ))
            await session.commit()


if os.getenv("DEBUG_PORT"):
    import debugpy
    debugpy.listen(("0.0.0.0", int(os.getenv("DEBUG_PORT", "5678"))))
    print(f"[debugpy] listening on port {os.getenv('DEBUG_PORT')} — attach VS Code now")

app = FastAPI(title="API", lifespan=lifespan)

_extra_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", *_extra_origins],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    t0 = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - t0) * 1000, 1)
    logger.info(
        "%s %s %s %dms id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(auth.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "API is running"}
