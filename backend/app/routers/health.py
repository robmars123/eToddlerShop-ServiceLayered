import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionLocal, settings

router = APIRouter(prefix="/health", tags=["Health"])

_start_time = time.monotonic()
_TIMEOUT = 3.0  # seconds per service check


async def _guarded(coro) -> dict:
    """Run a check coroutine with a hard timeout; never raises."""
    try:
        return await asyncio.wait_for(coro, timeout=_TIMEOUT)
    except asyncio.TimeoutError:
        return {"status": "error", "error": f"timed out after {_TIMEOUT}s"}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def _check_database() -> dict:
    t0 = time.monotonic()
    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}


async def _check_redis() -> dict:
    import redis.asyncio as aioredis
    t0 = time.monotonic()
    r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
    await r.ping()
    await r.aclose()
    return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}


async def _check_storage() -> dict:
    t0 = time.monotonic()
    def _ping():
        from azure.storage.blob import BlobServiceClient
        BlobServiceClient.from_connection_string(
            settings.azure_storage_connection_string
        ).get_account_information()
    await asyncio.to_thread(_ping)
    return {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}


@router.get("")
async def health_check():
    uptime = round(time.monotonic() - _start_time)

    db, redis, storage = await asyncio.gather(
        _guarded(_check_database()),
        _guarded(_check_redis()),
        _guarded(_check_storage()),
    )

    services = {
        "api":      {"status": "ok", "uptime_seconds": uptime},
        "database": db,
        "redis":    redis,
        "storage":  storage,
    }
    any_error = any(s["status"] != "ok" for s in services.values())

    return {
        "status": "degraded" if any_error else "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": uptime,
        "environment": "debug" if settings.debug else "production",
        "services": services,
    }
