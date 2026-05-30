# Backend

FastAPI backend with a domain-organised service layer, Azure Entra External ID authentication, Redis caching, and a parallel health check endpoint.

## Stack

- **Python 3.14** with `uv`
- **FastAPI** — HTTP layer, middleware (rate limiter, request logging)
- **SQLAlchemy 2 (async)** + **asyncpg** — database access
- **PostgreSQL** + **pgvector** — database with vector search
- **Pydantic v2** — schemas and settings
- **Redis** (optional) — product list cache, rate limiting, and chat history; fails open when unavailable
- **LangChain** (`langchain-core`, `langchain-openai`) — AI orchestration tier; chat prompt chaining and Redis-backed conversation history
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
│   │   ├── _clients.py             # Shared Azure OpenAI + LangChain LLM client instances
│   │   ├── chat_service.py         # RAG context builder (product catalog grounding)
│   │   ├── embedding_service.py    # Bulk embed + pgvector upsert
│   │   ├── recommend_service.py    # 3-phase: filter extract → vector search → re-rank
│   │   ├── speech_service.py       # Azure Speech token issuance
│   │   └── orchestrator/
│   │       ├── history_repository.py  # HistoryRepository protocol + RedisHistoryRepository
│   │       └── chat_orchestrator.py   # LangChain chain: context → prompt → LLM → history
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
                     ↘ Redis (cache / rate limit / chat history)
                     ↘ Azure services (OpenAI, Speech, Blob)

Router → ChatOrchestrator → ChatService.build_context() → RecommendService → pgvector
                          → HistoryRepository (Redis) → RedisChatMessageHistory
                          → LangChain chain (prompt | AzureChatOpenAI | StrOutputParser)
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
| `POST` | `/products/batch` | — | Fetch up to 100 products by ID list (used by AI search) |
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
| `POST` | `/ai/chat` | — | RAG-based shopping assistant (with conversation history) |
| `POST` | `/ai/chat/stream` | — | Same as above, streamed as SSE |
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

## AI Features

### Prerequisites

Before AI search or the chatbot can return results, an admin must run the embedding step from the Admin dashboard. This calls `POST /ai/embed-products`, which reads every product from the database, generates a vector with `text-embedding-3-small`, and upserts it into the `product_embeddings` table (pgvector). From that point on, individual product embeddings are kept in sync automatically — create/update/delete each trigger a background task that re-embeds or removes the affected row.

---

### AI Search — step by step

The AI search is a 3-phase pipeline that runs entirely server-side. The frontend only sends the raw query and receives ranked product IDs back.

**1. User submits a query**
`RecommendPage` calls `POST /api/v1/ai/recommend` with `{ "message": "toys for girls under $20" }`.

**2. Redis cache check**
`RecommendService.recommend()` hashes the message and checks Redis. A cache hit returns the previous result immediately (TTL: 5 minutes). Cache is invalidated on any product create, update, or delete.

**3. Filter extraction**
`_extract_filters()` sends the raw message to GPT-4o-mini with a structured prompt. The model returns JSON containing:
- `query` — the semantic phrase with all concepts preserved but price/numeric constraints removed
- `filters` — structured fields: `category`, `age`, `price_exact`, `price_min`, `price_max`, `price_above`, `price_below`, `tags`

**4. Vector search**
`_vector_search()` embeds the cleaned `query` using `text-embedding-3-small` (Redis-cached per text for 30 days), then runs a cosine distance query against `product_embeddings` via pgvector. Returns up to 50 candidates ordered by similarity. Pure price queries (empty semantic query) skip the distance threshold so all products reach the price filter step.

**5. Price filtering**
`_apply_price_filters()` applies the extracted price constraints in Python, narrowing the candidate list to only products that satisfy all numeric conditions.

**6. Re-ranking**
`_rerank()` sends the shortlist to GPT-4o-mini with the original user message and asks it to rank by relevance and exclude irrelevant products. Returns an ordered list of product IDs. When a price filter was active, any price-matching product excluded by the re-ranker is appended at the end to guarantee completeness.

**7. Response cached and returned**
The `RecommendResponse` (`{ ranked_product_ids, query, filters }`) is stored in Redis and returned to the frontend.

**8. Batch product fetch**
The frontend calls `POST /api/v1/products/batch` with the ranked ID list (max 100). The backend executes a single `SELECT … WHERE id IN (…)` and returns only those product rows in ranked order. No full table scan occurs.

---

### Chatbot — step by step

The chatbot runs through a LangChain orchestration tier that adds Redis-backed conversation history on top of the same RAG recommendation pipeline.

**1. User sends a message**
`ChatWidget` calls `POST /api/v1/ai/chat/stream` with `{ "message": "...", "session_id": "..." }`. The response is an SSE stream.

The `session_id` determines which Redis history key is used:
- **Logged-in user** — the React client sends `user-{id}` (e.g. `user-42`), derived from the authenticated user's DB id. History is consistent across all their sessions.
- **Guest** — the React client generates a UUID on first visit, stores it in `localStorage` as `guest_chat_session`, and reuses it. History survives page refreshes for that browser.
- **Omitted / null** — the orchestrator generates a throwaway UUID; the call is effectively stateless.

**2. Context building**
`ChatService.build_context()` runs the full AI search pipeline (steps 2–7 above) on the user's message. It then fetches the full `Product` rows for the top 10 ranked IDs from the `products` table.

- If the query is broad (e.g. "show me everything") and returns no ranked IDs, the service checks whether any embeddings exist and falls back to `SELECT … LIMIT 10`.
- If no embeddings exist at all, `build_context()` returns `None` and the response is a "please ask an admin to index first" message.

**3. Prompt assembly with history**
`ChatOrchestrator` passes the context into a `ChatPromptTemplate`:
```
[system]  You are a helpful shopping assistant. Answer ONLY using the products listed below. ...
          Available products:
          - Product A: description. Price: $X.XX
          - ...
[history] <previous turns loaded from Redis for this session_id>
[human]   <current message>
```
`RunnableWithMessageHistory` loads the session's prior turns from Redis, injects them into the `{history}` placeholder, and saves the new turn after the response completes.

**4. Streaming response**
GPT-4o-mini streams its reply via `LangChain.astream()`. Each chunk is serialised as `data: {"delta": "..."}` and flushed immediately. The final frame is `data: [DONE]`. LangChain saves the complete response to Redis history after streaming finishes.

**5. Frontend rendering**
`useChat` receives chunks via the `onChunk` callback. The first chunk creates a new assistant message bubble; subsequent chunks are appended character-by-character to the last message. The chat widget auto-scrolls to the bottom.

**Chat history TTL:** 1 hour (`chat_history:` Redis key prefix). Automatically expires after an idle session.

---

### Voice Search — step by step

Voice search is available on both the AI Search page and inside the chatbot. The subscription key never leaves the server.

**1. User clicks the microphone button**
`useSpeech.startListening()` is called.

**2. Token exchange**
`recognizeSpeech()` calls `GET /api/v1/ai/speech-token`. The backend `SpeechService` posts to the Azure Cognitive Services token endpoint using the server-side subscription key and returns a short-lived bearer token and the configured region.

**3. Speech recognition**
The frontend initialises an Azure Speech SDK `SpeechRecognizer` with the token and records from the default microphone. `recognizeOnceAsync()` waits for a complete utterance, then closes the recognizer and resolves with the transcribed text.

**4. Query handoff**
`useSpeech` calls the `onResult(text)` callback with the transcribed text.
- On `RecommendPage`: the query input is set to the transcribed text and `search(text)` is called immediately, entering the AI Search pipeline at step 1 above.
- In the chatbot: the input field is populated and `send()` is called, entering the chatbot pipeline at step 1 above.

## Tests

```powershell
uv run pytest tests/ -v
```

Tests use an in-memory SQLite database via `conftest.py`. Redis and Azure services are not required for tests.
