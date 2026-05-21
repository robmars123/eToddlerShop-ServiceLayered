# Claude Architecture Contract
# AI-Powered E-Commerce Platform — Python / FastAPI / React
> Last updated: 2026-05-20

---

## 1. Project Overview

A full-stack AI-powered e-commerce platform with a containerized FastAPI backend, React SPA frontend, and Azure AI services. Functions both as a standalone demo and as an AI middleware layer integrable into ERP or enterprise systems via REST APIs. The AI service layer is the core deliverable — the CRUD layer exists to make it runnable and demonstrable without an external ERP.

---

## 2. Architecture

### Backend — Router → Service → Model

```
app/
├── routers/          # HTTP layer only — no business logic
│   ├── ai.py         # /ai/* — embed, recommend, chat, chat/stream, speech-token
│   ├── auth.py       # /auth/* — login, register
│   ├── products.py   # /products/* — CRUD + image upload
│   ├── orders.py     # /orders/* — CRUD + status update
│   └── users.py      # /users/* — CRUD
├── services/         # All business logic
│   ├── ai_service.py         # AIService + SpeechService
│   ├── products_service.py   # ProductService + Blob Storage
│   ├── auth_service.py       # JWT + require_admin dependency
│   ├── users_service.py
│   └── orders_service.py
├── models/           # SQLAlchemy ORM definitions only
│   ├── user.py
│   ├── product.py
│   ├── order.py
│   └── product_embedding.py  # pgvector Vector(1536)
├── schemas/          # Pydantic v2 — request validation + response serialization
│   ├── ai_schema.py
│   ├── auth_schema.py
│   ├── product_schema.py
│   ├── order_schema.py
│   └── user_schema.py
├── database.py       # Settings, async engine, SessionLocal
└── main.py           # Lifespan (pgvector extension, create_all, seed admin), CORS, routers
```

### Frontend — Feature-based React SPA

```
src/
├── features/
│   ├── Auth/         # AuthContext, login, sessionStorage token
│   └── Chatbot/      # ChatWidget, useChat, chatService (SSE streaming)
├── components/
│   ├── Admin/        # ProductsTable, AddProductForm, EditProductRow
│   ├── Cart/         # CartStore (Context)
│   ├── Navbar/
│   └── ProtectedRoute/
├── pages/
│   ├── ProductsPage.tsx
│   ├── RecommendPage.tsx     # AI Search — 3-phase pipeline
│   ├── AdminPage.tsx         # CRUD + "Index Products for AI Search" button
│   ├── ProductDetailPage.tsx
│   ├── CartPage.tsx
│   └── LoginPage.tsx
├── services/         # Plain async fetch functions — never hooks
│   ├── aiService.ts          # recommendProducts(), embedProducts()
│   ├── productsService.ts
│   └── speechService.ts      # recognizeSpeech() via Azure Speech SDK
├── config.ts         # VITE_API_URL with localhost fallback
├── types.ts
├── App.tsx           # Routes + <ChatWidget /> outside <Routes> (persists across pages)
└── main.tsx
```

---

## 3. Tech Stack

### Backend
| Concern | Tool | Notes |
|---|---|---|
| Framework | FastAPI 0.136+ | Async-first |
| Language | Python 3.14 | `async def` everywhere |
| ORM | SQLAlchemy 2.0 async | `AsyncSession` only |
| Migrations | Alembic | Schema changes only — not for seeding |
| Validation | Pydantic v2 | `model_validate`, `model_dump_json` |
| Auth | PyJWT (HS256) + passlib + bcrypt | JWT in Authorization header |
| Database | PostgreSQL 16 + pgvector | `CREATE EXTENSION IF NOT EXISTS vector` at startup |
| Cache | Redis 7 (`redis[asyncio]`) | Shared across all instances |
| AI — Chat/Rank | Azure OpenAI `gpt-4o-mini` | Filter extraction + re-ranking + chat |
| AI — Embeddings | Azure OpenAI `text-embedding-3-small` | 1536-dim vectors |
| Speech | Azure Speech Service | Token-proxy — key never reaches browser |
| Storage | Azure Blob Storage | SAS URLs, 10-year expiry |
| Server | Uvicorn + uvloop | |
| HTTP client | httpx | Async, used for Speech STS |

### Frontend
| Concern | Tool | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Strict mode |
| Build | Vite | `VITE_*` env vars only |
| Routing | React Router v6 | `<BrowserRouter>` |
| Styling | Tailwind CSS | Utility-first, no CSS Modules |
| Auth state | React Context | sessionStorage — not localStorage |
| Data fetching | Native `fetch` | No TanStack Query |
| Streaming | `ReadableStream` + `TextDecoder` | SSE parsing in `chatService.ts` |
| Speech | `microsoft-cognitiveservices-speech-sdk` | Browser SDK |
| Serving | nginx | Static build in Docker |

### Infrastructure
| Concern | Tool |
|---|---|
| Local dev | Docker Compose — `db`, `redis`, `api`, `client` |
| Container registry | GitHub Container Registry (`ghcr.io`) — free |
| Backend (prod) | Azure App Service, Linux, Web App for Containers |
| Frontend (prod) | Azure Static Web App |
| Database (prod) | Azure PostgreSQL Flexible Server — pgvector allowlisted |
| CI/CD | GitHub Actions — build → push ghcr.io → deploy |

---

## 4. AI Pipelines

### `/ai/recommend` — 3-Phase Search

| Phase | What happens |
|---|---|
| 1. Filter extraction | GPT-4o-mini extracts `{query, filters}` JSON from natural language. Price operators: `price_min` (>=), `price_max` (<=), `price_above` (>), `price_below` (<), `price_exact` (==). "X and above/below" always maps to `price_min`/`price_max`, never `price_above`/`price_below`. |
| 2. Vector search | Embed original message → cosine search on `product_embeddings`. Distance threshold: 0.75 (no price filter), 0.90 (price filter present — wider net). Limit 50. Hard price filters applied in Python after search. |
| 3. Re-ranking | GPT-4o-mini re-ranks candidates by relevance. Returns `rankedProductIds[]`. |

Result is cached in Redis (`rec:{md5}`, 5 min TTL). Cache is invalidated on any product mutation.

### `/ai/chat/stream` — RAG Streaming Chat

1. Calls `recommend()` internally — same 3-phase pipeline — to get properly filtered, ranked product IDs
2. Fetches **live product data from `products` table** (not from `product_embeddings` — avoids stale data)
3. Falls back to all products ordered by ID if recommend returns no results (handles broad queries like "list all products")
4. Builds RAG context → streams via `AsyncAzureOpenAI` with `stream=True`
5. Yields `data: {"delta": "..."}` SSE chunks → `data: [DONE]` terminator
6. Frontend appends chunks to message bubble live via `ReadableStream`

**System prompt rule:** GPT is explicitly instructed not to mention, invent, or reference any product not in the context. This prevents hallucination of products.

### Embedding Auto-Indexing
- **Create/Update product** → `embed_single_product()` runs as `BackgroundTask`
- **Delete product** → `delete_product_embedding()` removes vector, runs as `BackgroundTask`
- **Bulk re-index** → Admin clicks "Index Products for AI Search" → `POST /ai/embed-products` (admin JWT required)
- All embedding operations also call `invalidate_search_cache()` to flush stale Redis `rec:*` keys

---

## 5. Redis Cache Contract

| Key | Type | Content | TTL | Invalidated by |
|---|---|---|---|---|
| `emb:{md5(text)}` | String | JSON `float[]` | 30 days | Never — embeddings are deterministic |
| `rec:{md5(message)}` | String | `RecommendResponse` JSON | 5 min | Any product create/update/delete |
| `products:all` | String | `ProductResponse[]` JSON | 60 sec | Any product create/update/delete |

**Rules:**
- Always use namespaced key prefixes (`emb:`, `rec:`, `products:`)
- `invalidate_search_cache()` must delete all `rec:*` keys AND `products:all`
- Never cache mutable data without a TTL
- Redis is the only shared state between instances — no module-level in-memory dicts for request-scoped data

---

## 6. Security Rules

### Backend
- JWT secret loaded from `settings.jwt_secret_key` — never hardcoded
- Passwords hashed with bcrypt via passlib — never stored plain
- Admin routes protected with `require_admin` dependency — returns 403 if role != admin
- Azure credentials never logged or returned in responses
- Blob SAS URLs use 10-year expiry with read-only permission — no write SAS exposed
- Speech STS token issued server-side — subscription key never sent to browser
- `DATABASE_SSL=true` required in production (Azure PostgreSQL enforces SSL)
- File uploads: validate content-type against allowlist, enforce 5 MB size limit

### Frontend
- JWT stored in `sessionStorage` — cleared on tab close, not persisted in `localStorage`
- `getStoredToken()` used for authenticated API calls — imported from `AuthContext`
- Never construct API URLs from unsanitized user input
- No secrets, keys, or connection strings in frontend code — only `VITE_API_URL`
- CORS origins set explicitly via `CORS_ORIGINS` env var in production

---

## 7. Layer Rules

### Routers (`app/routers/`)
- Define endpoints only — HTTP method, path, dependencies, response model
- Validate HTTP-level concerns: content-type headers, file size limits
- Inject services via `Depends()`
- Use `BackgroundTasks` for anything fire-and-forget (embedding, cache invalidation)
- **No business logic. No SQLAlchemy. No direct Redis access.**

### Services (`app/services/`)
- Own all business logic
- May use: models, schemas, settings, Redis client, Azure SDK clients, SQLAlchemy session
- Must NOT import from routers
- All methods `async def`
- Extract private helpers (`_method_name`) when a public method exceeds ~40 lines

### Models (`app/models/`)
- SQLAlchemy ORM table definitions only
- No methods, no business logic, no Pydantic
- `product_embedding.py` uses `Vector(1536)` from pgvector

### Schemas (`app/schemas/`)
- Pydantic v2 request/response models
- No SQLAlchemy imports
- Use `model_validate(orm_obj)` to convert ORM → schema — requires `model_config = ConfigDict(from_attributes=True)`

### `database.py`
- Single source of truth for all settings via `pydantic-settings`
- All env vars defined here with types and defaults
- Engine and `SessionLocal` created once at import time

---

## 8. Coding Standards

### Python
- `async def` for all service methods and route handlers
- Type annotations on all function signatures and return types
- Pydantic v2: use `model_validate`, `model_dump_json`, `model_validate_json` — not v1 `.from_orm()` or `.dict()`
- SQLAlchemy 2.0: use `select()`, `session.execute()`, `session.scalar_one_or_none()` — not legacy `session.query()`
- No `print()` statements — use `logging.getLogger(__name__)`
- No bare `except:` — always catch specific exceptions or at minimum `except Exception as e`
- Format SSE chunks as `f"data: {json.dumps({'delta': value})}\n\n"` — double newline required
- Guard streaming chunks: `if not chunk.choices: continue` before accessing `chunk.choices[0]`

### TypeScript / React
- `strict: true` in tsconfig — no `any`, no untyped async returns
- Named exports for all components — no anonymous default exports
- Service functions are plain `async` functions — never hooks
- State updates on arrays/objects: always return new references — never mutate in place
- `key` props on lists: use stable unique IDs — never array index for reorderable lists
- `void send()` pattern for event handler async calls — never `send()` without void or await
- SSE parsing: split on `\n`, check `line.startsWith('data: ')`, skip `[DONE]`, catch JSON parse errors

---

## 9. Error Handling Standards

### Backend
- HTTP errors: raise `HTTPException(status_code=..., detail="...")` — never return error dicts manually
- External service failures (Azure, Redis): catch specific SDK exceptions, re-raise as `HTTPException(502)`
- Background tasks: wrap in try/except and log — failures must not crash the worker silently
- Never surface raw exception messages or stack traces in HTTP responses
- Log errors with `logger.error(...)` — include enough context to reproduce

### Frontend
- All async functions must have explicit `try/catch`
- User-facing error messages must be human-readable — never raw API error strings
- Loading and error states must be tracked in component state — never inferred
- SSE stream errors: catch in `useChat` and set `error` state — never let stream failures go silent

---

## 10. Performance Guidelines

### Backend
- Use `BackgroundTasks` for operations that don't affect the HTTP response (embeddings, cache flush)
- Check Redis cache before any OpenAI API call — embedding calls cost money and add latency
- Use `select(...).where(...).limit(n)` — never fetch unbounded result sets
- `product_embeddings` should have an HNSW index for cosine search at scale:
  ```sql
  CREATE INDEX ON product_embeddings USING hnsw (embedding vector_cosine_ops);
  ```
- Avoid N+1 queries — fetch related data in a single `IN` query, not per-item loops

### Frontend
- `React.memo`, `useMemo`, `useCallback` only when profiling shows measurable gain — not preemptively
- Stable `key` props on all `.map()` renders
- Streaming chat: append chunks incrementally — do not buffer full response before rendering

---

## 11. Environment Variables

All read via `Settings` class in `database.py` using `pydantic-settings`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL async connection string |
| `DATABASE_SSL` | Prod only | `false` | SSL for Azure PostgreSQL |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET_KEY` | Yes | insecure default | JWT signing secret — must change in prod |
| `AZURE_OPENAI_ENDPOINT` | Yes | — | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_KEY` | Yes | — | Azure OpenAI API key |
| `AZURE_OPENAI_API_VERSION` | No | `2024-02-15-preview` | API version |
| `AZURE_OPENAI_EMBEDDINGS` | No | `text-embedding-3-small` | Embeddings deployment name |
| `AZURE_OPENAI_CHAT` | No | `gpt-4o-mini` | Chat deployment name |
| `AZURE_SPEECH_ENDPOINT` | Yes | — | Azure Speech STS endpoint |
| `AZURE_SPEECH_KEY` | Yes | — | Azure Speech subscription key |
| `AZURE_SPEECH_REGION` | No | `centralus` | Azure Speech region |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | — | Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | No | `products` | Blob container name |
| `CORS_ORIGINS` | Prod only | `""` | Comma-separated allowed origins |

---

## 12. Local Development

```powershell
docker compose up --build
```

| Container | Image | Port | Notes |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | 5433 | Local volume only — not cloud-connected |
| `redis` | `redis:7-alpine` | 6379 | In-memory, resets on container restart |
| `api` | Custom (backend/Dockerfile) | 8000 | Reads `./backend/.env` |
| `client` | Custom (client/Dockerfile) | 80 | nginx serving React build |

Compose overrides `DATABASE_URL` and `REDIS_URL` — `.env` values for these are ignored inside Docker.

**After first run:** go to Admin panel → click "Index Products for AI Search" to populate `product_embeddings`. AI Search and Chat will not work until this is done.

---

## 13. Deployment (Production)

```
GitHub push to main
  → Build Docker image → push to ghcr.io
  → az webapp config container set (App Service pulls new image)
  → az webapp restart
  → Build React (VITE_API_URL = App Service URL) → deploy to Static Web App
```

**Production checklist:**
- `DATABASE_SSL=true`
- `JWT_SECRET_KEY` set to a strong random value
- `CORS_ORIGINS` set to Static Web App domain
- `AZURE_EXTENSIONS=vector` set on PostgreSQL Flexible Server before first startup
- All Azure credentials set as App Service environment variables (not in image)

---

## 14. Forbidden — Never Do These

| Category | Rule |
|---|---|
| Architecture | Business logic in routers |
| Architecture | Direct DB queries in routers — must go through a service |
| Architecture | SQLAlchemy imports in schemas |
| Architecture | Router imports in services |
| State | Module-level mutable dicts for request state — use Redis |
| State | Skipping `invalidate_search_cache()` after any product mutation |
| State | Skipping `delete_product_embedding()` on product delete |
| AI | Building chat context from `product_embeddings` cached data — always fetch live from `products` table |
| AI | Allowing GPT to reference products not in the provided context |
| Security | Storing Azure keys, JWT secrets, or connection strings in frontend code |
| Security | Logging credentials, tokens, or connection strings |
| Security | Accepting file uploads without content-type and size validation |
| Async | Synchronous blocking calls inside async functions |
| Async | Unguarded `chunk.choices[0]` access in SSE stream — check `chunk.choices` length first |
| React | Array index as `key` for lists that can reorder or filter |
| React | Anonymous default component exports |
| TypeScript | `any` type — use `unknown` and narrow |

---

## 15. Claude Operating Rules

| Rule | Instruction |
|---|---|
| **Read first** | Always read the target file before editing. Never edit blind. |
| **Match patterns** | Follow router → service → model as it exists. Do not introduce new patterns without flagging it. |
| **Minimal change** | Generate the smallest correct diff. Do not refactor unrelated code unless explicitly asked. |
| **No invented APIs** | Never invent FastAPI, SQLAlchemy, Pydantic, or Redis APIs. If unsure, say so. |
| **Complete code** | No `# TODO`, no stubs, no placeholder logic. Every change must be production-ready. |
| **Background tasks** | Embedding and cache invalidation are always background tasks — never blocking. |
| **Cache invalidation** | Any product write must invalidate `rec:*` AND `products:all` in the same operation. |
| **Live data for chat** | Chat context always fetches from `products` table — never from `product_embeddings` cached fields. |
| **SSE correctness** | Guard `chunk.choices`, double-newline terminators, `[DONE]` sentinel — all required. |
| **Security by default** | Never generate code that exposes secrets, skips auth, or trusts unvalidated input. |
| **Fail loudly** | If a correct implementation is not possible within these constraints, say so — do not generate a partial or incorrect solution. |
| **Explain tradeoffs** | When making a non-obvious architectural decision, state what was chosen and why. |
