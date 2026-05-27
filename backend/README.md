# Backend

FastAPI backend with a domain-organised service layer, Azure Entra External ID authentication, Redis caching, and a parallel health check endpoint.

## Stack

- **Python 3.14** with `uv`
- **FastAPI** — HTTP layer, middleware (rate limiter, request logging)
- **SQLAlchemy 2 (async)** + **asyncpg** — database access
- **PostgreSQL** + **pgvector** — database with vector search
- **Pydantic v2** — schemas and settings
- **Redis** (optional) — product list cache + rate limiting; fails open when unavailable
- **Azure Entra External ID** — CIAM authentication, RS256 JWKS token validation
- **Azure OpenAI** — embeddings (text-embedding-3-small) and chat completions (GPT-4o-mini)
- **Azure Cognitive Services Speech** — speech-to-text token issuance
- **Azure Blob Storage** — product image storage with SAS URLs

## Architecture

```
app/
├── main.py                         # FastAPI app, lifespan, CORS, rate limiter, logging middleware
├── database.py                     # Settings, engine, session factory, Base, get_db()
│
├── models/                         # SQLAlchemy ORM models
│   ├── user.py                     # User (email, username, entra_oid, role)
│   ├── product.py                  # Product (name, description, price, image_url)
│   ├── order.py                    # Order + OrderItem
│   └── product_embedding.py        # ProductEmbedding (pgvector)
│
├── schemas/                        # Pydantic request/response schemas
│   ├── user_schema.py              # UserCreate, UserUpdate, UserResponse
│   ├── product_schema.py           # ProductCreate, ProductUpdate, ProductResponse
│   ├── order_schema.py             # OrderCreate, OrderUpdate, OrderResponse, OrderStatus
│   │                               # OrderPeriodStat, OrderAnalytics
│   ├── auth_schema.py              # EntraTokenRequest, TokenData
│   └── ai_schema.py                # RecommendRequest/Response, ChatRequest/Response, etc.
│
├── services/                       # Business logic — one subdirectory per domain
│   ├── auth/
│   │   ├── auth_service.py         # get_current_user, require_admin, user upsert
│   │   └── entra_token_validator.py# JWKS fetch + RS256 JWT validation
│   ├── ai/
│   │   ├── _clients.py             # Shared Azure OpenAI async client instances
│   │   ├── chat_service.py         # RAG chatbot (product catalog grounding)
│   │   ├── embedding_service.py    # Bulk embed + pgvector upsert
│   │   ├── recommend_service.py    # 3-phase: filter extract → vector search → re-rank
│   │   └── speech_service.py       # Azure Speech token issuance
│   ├── orders/
│   │   └── orders_service.py       # CRUD, analytics (day/month/year), cancel
│   ├── products/
│   │   └── products_service.py     # CRUD, Azure Blob image upload, Redis fail-open cache
│   └── users/
│       └── users_service.py        # CRUD
│
└── routers/                        # FastAPI routers — thin, delegate to services
    ├── auth.py                     # /auth/entra
    ├── products.py                 # /products CRUD + image upload
    ├── users.py                    # /users CRUD
    ├── orders.py                   # /orders CRUD + analytics + cancel
    ├── ai.py                       # /ai embed, recommend, chat, speech-token
    └── health.py                   # /health — parallel checks with asyncio.wait_for
```

### Dependency flow

```
Router → Service(db) → SQLAlchemy AsyncSession → PostgreSQL
                     ↘ Redis (cache / rate limit)
                     ↘ Azure services (OpenAI, Speech, Blob)
```

Each router gets a service instance via `Depends(get_db)`. No repository interfaces.

### Middleware (outermost → innermost)

1. `rate_limit_middleware` — per-IP sliding window via Redis; skips OPTIONS, fails open when Redis is down
2. `CORSMiddleware` — CORS headers
3. `request_logging_middleware` — structured log per request with `X-Request-ID` and `X-Response-Time`

Rate limits (requests per minute per IP):

| Path prefix | Limit |
|---|---|
| `/api/v1/ai` | 20 |
| `/api/v1/auth` | 20 |
| `/api/v1/orders` | 40 |
| everything else | 120 |

## Setup

**Prerequisites:** Docker running (PostgreSQL + Redis), `uv` installed.

```powershell
# Install dependencies
uv sync

# Copy and configure environment
cp .env.example .env

# Start dev server
uv run uvicorn app.main:app --reload --port 8000
```

Tables, the pgvector extension, and additive schema migrations run automatically on startup. An admin user is seeded from `AZURE_ENTRA_ADMIN_EMAIL` if one does not exist.

## Environment Variables

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/appdb` | Async PostgreSQL connection URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL (optional — fails open) |
| `DEBUG` | `false` | Enables SQLAlchemy query logging |
| `CORS_ORIGINS` | `https://myapp.com` | Extra comma-separated origins beyond localhost |
| `AZURE_ENTRA_TENANT_ID` | `<tenant-id>` | Azure Entra External ID tenant GUID |
| `AZURE_ENTRA_CLIENT_ID` | `<client-id>` | Registered app client ID |
| `AZURE_ENTRA_ADMIN_EMAIL` | `admin@example.com` | Email seeded as admin on startup |
| `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com/` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | `<key>` | Azure OpenAI API key |
| `AZURE_OPENAI_API_VERSION` | `2024-02-15-preview` | Azure OpenAI API version |
| `AZURE_OPENAI_EMBEDDINGS` | `text-embedding-3-small` | Embeddings deployment name |
| `AZURE_OPENAI_CHAT` | `gpt-4o-mini` | Chat deployment name |
| `AZURE_SPEECH_ENDPOINT` | `https://centralus.api.cognitive.microsoft.com/` | Azure Speech endpoint |
| `AZURE_SPEECH_KEY` | `<key>` | Azure Speech subscription key |
| `AZURE_SPEECH_REGION` | `centralus` | Azure Speech region |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=https;...` | Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | `products` | Blob container name for product images |

## API

Base path: `/api/v1` — interactive docs at `http://localhost:8000/docs`

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/entra` | — | Validate Entra ID token; upsert user; return session info |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/` | Admin | List all users |
| `POST` | `/users/` | Admin | Create user |
| `PUT` | `/users/{id}` | Admin | Update user |
| `DELETE` | `/users/{id}` | Admin | Delete user |

### Products

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/products/` | — | List all products (Redis-cached) |
| `GET` | `/products/{id}` | — | Get a product |
| `POST` | `/products/` | Admin | Create a product |
| `PUT` | `/products/{id}` | Admin | Update a product |
| `DELETE` | `/products/{id}` | Admin | Delete product + Azure blob |
| `POST` | `/products/{id}/image` | Admin | Upload product image (JPEG/PNG/WebP/GIF, max 5 MB) |

### Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/orders/` | Admin | List all orders |
| `GET` | `/orders/my` | User | List current user's orders |
| `GET` | `/orders/analytics` | Admin | Aggregated counts + revenue by day / month / year |
| `GET` | `/orders/user/{user_id}` | Admin | List orders for a specific user |
| `POST` | `/orders/` | User | Create an order |
| `PATCH` | `/orders/{id}/status` | Admin | Update order status |
| `POST` | `/orders/{id}/cancel` | User | Cancel a pending order (owner only) |
| `DELETE` | `/orders/{id}` | Admin | Delete an order |

### AI

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ai/embed-products` | Admin | Bulk index all products into vector store |
| `POST` | `/ai/recommend` | — | AI product recommendations (3-phase pipeline) |
| `POST` | `/ai/chat` | — | RAG-based shopping assistant |
| `GET` | `/ai/speech-token` | — | Issue short-lived Azure Speech token |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Parallel status of API, database, Redis, and Azure Storage (3 s timeout per check) |

Sample response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-26T10:00:00+00:00",
  "uptime_seconds": 3600,
  "environment": "production",
  "services": {
    "api":      { "status": "ok", "uptime_seconds": 3600 },
    "database": { "status": "ok", "latency_ms": 2.1 },
    "redis":    { "status": "ok", "latency_ms": 0.4 },
    "storage":  { "status": "ok", "latency_ms": 45.2 }
  }
}
```

## Tests

```powershell
uv run pytest tests/ -v
```

Tests use an in-memory SQLite database via `conftest.py`. Redis and Azure services are not required for tests.
