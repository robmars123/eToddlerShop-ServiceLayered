"""
Shared test fixtures.

HOW TO RUN
----------
Install test dependencies (one-time):
    cd backend
    uv pip install -e ".[test]"

Run all tests:
    cd backend
    pytest

Run a specific file:
    pytest tests/test_auth_service.py -v

Run a single test:
    pytest tests/test_auth_service.py::test_admin_promoted_via_token_roles -v
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.schemas.auth_schema import TokenData
from app.services.auth.auth_service import get_current_user

# Register models with Base.metadata so create_all knows about their tables.
# ProductEmbedding is intentionally excluded — it uses pgvector's Vector type
# which is a PostgreSQL extension and cannot run in SQLite.
from app.models.order import Order, OrderItem  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.user import User  # noqa: F401


# ── In-memory SQLite engine ───────────────────────────────────────────────────
# StaticPool forces all async sessions to share a single underlying connection.
# This is required for SQLite :memory: — each new connection would otherwise
# open its own empty database, making tables created in one session invisible
# to another.

_ENGINE = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_SESSION_FACTORY = async_sessionmaker(_ENGINE, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def mock_redis():
    """
    Replace the module-level Redis client with a no-op AsyncMock for every test.

    get() returns None so the products service always falls through to the DB
    (cache miss), making test behaviour predictable without a running Redis.
    """
    stub = AsyncMock()
    stub.get.return_value = None   # simulate cache miss → reads from DB
    stub.set.return_value = True
    stub.delete.return_value = 1
    with patch("app.services.products.products_service._redis", stub):
        yield


@pytest_asyncio.fixture(autouse=True)
async def reset_db():
    """Drop and recreate all tables before every test — guarantees a clean slate."""
    async with _ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db():
    """Direct async DB session for service-layer unit tests."""
    async with _SESSION_FACTORY() as session:
        yield session


# ── Test FastAPI application ──────────────────────────────────────────────────
# We build a fresh app here instead of importing from main.py because the
# production lifespan connects to PostgreSQL and runs pgvector commands that
# are not available in the SQLite test environment.

def _build_app() -> FastAPI:
    from app.routers import auth, products

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(products.router, prefix="/api/v1")
    return app


async def _get_db_override():
    """Replaces get_db so all HTTP requests use the test SQLite database."""
    async with _SESSION_FACTORY() as session:
        yield session


def _stub_embedding_service():
    """
    No-op stand-in for EmbeddingService.
    Prevents background tasks from calling Azure OpenAI during tests.
    """
    stub = MagicMock()
    stub.embed_single_product = AsyncMock()
    stub.delete_product_embedding = AsyncMock()
    return stub


def _stub_recommend_service():
    """
    No-op stand-in for RecommendService.
    Prevents background tasks from calling Redis during tests.
    """
    stub = MagicMock()
    stub.invalidate_search_cache = AsyncMock()
    return stub


@pytest_asyncio.fixture
async def client():
    """Unauthenticated HTTP client — useful for testing public endpoints."""
    from app.routers.products import get_embedding_service, get_recommend_service

    app = _build_app()
    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_embedding_service] = _stub_embedding_service
    app.dependency_overrides[get_recommend_service] = _stub_recommend_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_client():
    """
    HTTP client authenticated as a regular (non-admin) user.
    Admin-protected endpoints will return 403 with this client.
    """
    from app.routers.products import get_embedding_service, get_recommend_service

    app = _build_app()
    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_current_user] = lambda: TokenData(user_id=1, username="Test User", role="user")
    app.dependency_overrides[get_embedding_service] = _stub_embedding_service
    app.dependency_overrides[get_recommend_service] = _stub_recommend_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_client():
    """
    HTTP client authenticated as an admin.
    Overriding get_current_user propagates through require_admin automatically
    because require_admin depends on get_current_user in the DI chain.
    """
    from app.routers.products import get_embedding_service, get_recommend_service

    app = _build_app()
    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_current_user] = lambda: TokenData(user_id=1, username="Admin", role="admin")
    app.dependency_overrides[get_embedding_service] = _stub_embedding_service
    app.dependency_overrides[get_recommend_service] = _stub_recommend_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Claim factory ─────────────────────────────────────────────────────────────

def make_claims(
    oid: str = "test-oid-001",
    name: str = "Test User",
    email: str | None = None,
    roles: list[str] | None = None,
) -> dict:
    """
    Build a minimal Entra token claims dict for use in service-layer unit tests.
    Mirrors what validate_entra_token returns after a real JWT is decoded.
    """
    claims: dict = {"oid": oid, "name": name}
    if email:
        claims["email"] = email
    if roles:
        claims["roles"] = roles
    return claims
