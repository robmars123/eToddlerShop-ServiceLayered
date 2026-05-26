import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionLocal, settings

router = APIRouter(prefix="/health", tags=["Health"])

_start_time = time.monotonic()


async def _check_database() -> dict:
    t0 = time.monotonic()
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def _check_redis() -> dict:
    t0 = time.monotonic()
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def _check_storage() -> dict:
    import asyncio
    t0 = time.monotonic()
    def _ping():
        from azure.storage.blob import BlobServiceClient
        client = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
        client.get_account_information()
    try:
        await asyncio.to_thread(_ping)
        return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@router.get("")
async def health_check():
    db, redis, storage = (
        await _check_database(),
        await _check_redis(),
        await _check_storage(),
    )

    services = {"database": db, "redis": redis, "storage": storage}
    any_error = any(s["status"] != "ok" for s in services.values())

    return {
        "status": "degraded" if any_error else "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.monotonic() - _start_time),
        "environment": "debug" if settings.debug else "production",
        "services": services,
    }
