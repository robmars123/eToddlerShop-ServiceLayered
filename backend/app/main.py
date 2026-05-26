import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from app.database import Base, SessionLocal, engine, settings
from app.routers import ai, auth, health, orders, products, users

# Requests allowed per minute per IP, keyed by path prefix
_RATE_LIMITS: list[tuple[str, int]] = [
    ("/api/v1/ai",     20),   # AI endpoints are expensive
    ("/api/v1/auth",   20),   # Brute-force protection
    ("/api/v1/orders", 40),   # Order creation / listing
    ("",              120),   # Everything else
]

_rate_redis: aioredis.Redis | None = None

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

    global _rate_redis
    _rate_redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    yield

    await _rate_redis.aclose()


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
async def rate_limit_middleware(request: Request, call_next):
    # Never rate-limit CORS preflight — OPTIONS must reach CORSMiddleware
    if request.method == "OPTIONS" or _rate_redis is None:
        return await call_next(request)

    ip = request.client.host if request.client else "unknown"
    path = request.url.path
    origin = request.headers.get("origin", "")

    limit = next(cap for prefix, cap in _RATE_LIMITS if path.startswith(prefix))
    key = f"rl:{ip}:{path.split('/')[3] if path.startswith('/api/v1/') else 'global'}"

    try:
        async with _rate_redis.pipeline(transaction=False) as pipe:
            pipe.incr(key)
            pipe.expire(key, 60)
            count, _ = await pipe.execute()

        if count > limit:
            logger.warning("Rate limit hit: ip=%s path=%s count=%d limit=%d", ip, path, count, limit)
            # Mirror the origin so the browser doesn't treat this as a CORS failure
            cors_headers = {"Access-Control-Allow-Origin": origin} if origin else {}
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(limit),
                    **cors_headers,
                },
            )
    except Exception:
        pass  # Redis unavailable — fail open rather than block legitimate traffic

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(limit)
    return response


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
