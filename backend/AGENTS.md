# Backend — Agent Context
> FastAPI async backend for eToddler Shop AI-powered e-commerce platform.
> Last updated: 2026-05-22

---

## Purpose

REST API layer that provides AI-assisted product discovery (embedding, semantic search, re-ranking), RAG streaming chat, Azure Speech token proxy, product/order/user CRUD, and JWT authentication. The AI service layer is the core deliverable; CRUD exists to make it runnable without an external ERP.

---

## Language & Runtime

| Item | Value |
|---|---|
| Language | Python 3.14 |
| Async model | `async def` everywhere — no sync blocking calls |
| Package manager | `uv` (`pyproject.toml`) |
| Entry point | `app/main.py` — lifespan, CORS, router registration |

---

## Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | FastAPI 0.136+ | Async-first, auto OpenAPI |
| ORM | SQLAlchemy 2.0 async | `AsyncSession` only — never legacy `session.query()` |
| Migrations | Alembic | Schema changes only, not seeding |
| Validation | Pydantic v2 | `model_validate`, `model_dump_json` — never v1 `.from_orm()` / `.dict()` |
| Auth | PyJWT (HS256) + passlib + bcrypt | JWT in `Authorization: Bearer` header |
| Database | PostgreSQL 16 + pgvector extension | `Vector(1536)` for embeddings |
| Cache | Redis 7 (`redis[asyncio]`) | Shared state across all instances |
| AI — Chat/Rank | Azure OpenAI `gpt-4o-mini` | Filter extraction, re-ranking, RAG chat |
| AI — Embeddings | Azure OpenAI `text-embedding-3-small` | 1536-dim cosine vectors |
| Speech | Azure Speech Service | Token proxy — subscription key never sent to browser |
| Storage | Azure Blob Storage | SAS URLs, read-only, 10-year expiry |
| HTTP client | httpx | Async — used for Speech STS endpoint |
| Server | Uvicorn + uvloop | |

---

## Folder Architecture

```
backend/
├── app/
│   ├── main.py                   # Lifespan (pgvector ext, create_all, seed admin), CORS, router mounts
│   ├── database.py               # Settings (pydantic-settings), async engine, SessionLocal
│   │
│   ├── routers/                  # HTTP layer only — no business logic
│   │   ├── ai.py                 # /ai/* — embed, recommend, chat/stream, speech-token
│   │   ├── auth.py               # /auth/* — login, register
│   │   ├── products.py           # /products/* — CRUD + image upload
│   │   ├── orders.py             # /orders/* — CRUD + status update
│   │   └── users.py              # /users/* — CRUD
│   │
│   ├── services/                 # All business logic lives here
│   │   ├── ai/
│   │   │   ├── _clients.py       # AsyncAzureOpenAI + Redis client singletons
│   │   │   ├── embedding_service.py   # embed_single_product, embed_all, delete_product_embedding, invalidate_search_cache
│   │   │   ├── recommend_service.py   # 3-phase: filter extraction → vector search → GPT re-rank
│   │   │   ├── chat_service.py        # RAG streaming chat — calls recommend internally, fetches live products
│   │   │   └── speech_service.py      # Azure Speech STS token proxy
│   │   ├── auth/
│   │   │   └── auth_service.py   # JWT encode/decode, bcrypt verify, require_admin Depends()
│   │   ├── products/
│   │   │   └── products_service.py   # Product CRUD + Azure Blob image upload/delete
│   │   ├── orders/
│   │   │   └── orders_service.py
│   │   └── users/
│   │       └── users_service.py
│   │
│   ├── models/                   # SQLAlchemy ORM table definitions only — no methods, no logic
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── order.py
│   │   └── product_embedding.py  # Vector(1536) — pgvector
│   │
│   └── schemas/                  # Pydantic v2 request/response models — no SQLAlchemy imports
│       ├── ai_schema.py
│       ├── auth_schema.py
│       ├── product_schema.py
│       ├── order_schema.py
│       └── user_schema.py
│
├── pyproject.toml                # Dependencies (uv)
├── Dockerfile
└── .env                          # Local only — never committed
```

---

## Services — What Each File Does

### `services/ai/`

| File | Responsibility |
|---|---|
| `_clients.py` | Singleton `AsyncAzureOpenAI` and `redis.asyncio.Redis` — import these everywhere, never instantiate inline |
| `embedding_service.py` | `embed_single_product()` (BackgroundTask on create/update), `embed_all_products()` (bulk), `delete_product_embedding()` (BackgroundTask on delete), `invalidate_search_cache()` (flush `rec:*` + `products:all`) |
| `recommend_service.py` | Phase 1: GPT filter extraction. Phase 2: pgvector cosine search (threshold 0.75 / 0.90 with price filter). Phase 3: GPT re-rank. Result cached `rec:{md5}` 5 min |
| `chat_service.py` | Calls `recommend()` → fetches **live** products from DB (not embeddings) → builds RAG context → streams SSE `data: {"delta": "..."}` chunks |
| `speech_service.py` | Calls Azure Speech STS, returns `{token, region}` — key never leaves server |

### `services/auth/auth_service.py`
JWT creation/verification, password hashing, `require_admin` FastAPI dependency (raises 403 if role != admin).

### `services/products/products_service.py`
Full product CRUD. Image upload to Azure Blob (validates content-type, enforces 5 MB limit, returns SAS URL).

---

## Redis Cache Contract

| Key | TTL | Invalidated by |
|---|---|---|
| `emb:{md5(text)}` | 30 days | Never (deterministic) |
| `rec:{md5(message)}` | 5 min | Any product create / update / delete |
| `products:all` | 60 sec | Any product create / update / delete |

`invalidate_search_cache()` must delete ALL `rec:*` keys AND `products:all` together. Always call it after any product mutation.

---

## Layer Rules (Hard)

| Layer | Allowed | Forbidden |
|---|---|---|
| **Routers** | `Depends()`, `BackgroundTasks`, `HTTPException`, response models | Business logic, SQLAlchemy, direct Redis |
| **Services** | Models, schemas, settings, Redis, Azure SDKs, `AsyncSession` | Importing from routers |
| **Models** | SQLAlchemy column definitions | Methods, Pydantic, business logic |
| **Schemas** | Pydantic v2 fields, validators | SQLAlchemy imports |

---

## Key Coding Patterns

```python
# ORM → schema (requires model_config = ConfigDict(from_attributes=True))
ProductResponse.model_validate(orm_obj)

# SQLAlchemy 2.0 query
result = await session.execute(select(Product).where(Product.id == id))
product = result.scalar_one_or_none()

# SSE chunk format (double newline required)
f"data: {json.dumps({'delta': value})}\n\n"

# Guard before accessing SSE choices
if not chunk.choices:
    continue
delta = chunk.choices[0].delta.content
```

---

## Environment Variables

All loaded via `Settings` in `database.py` (pydantic-settings). See root `AGENTS.md` §11 for the full table.

Critical: `DATABASE_URL`, `JWT_SECRET_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_SPEECH_KEY`, `AZURE_STORAGE_CONNECTION_STRING`.

---

## API Routes Quick Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | None | Returns JWT |
| POST | `/auth/register` | None | Create user |
| GET | `/products` | None | List all (Redis cached 60s) |
| POST | `/products` | Admin JWT | Create + auto-embed |
| PUT | `/products/{id}` | Admin JWT | Update + re-embed |
| DELETE | `/products/{id}` | Admin JWT | Delete + remove embedding |
| POST | `/ai/embed-products` | Admin JWT | Bulk re-index all products |
| POST | `/ai/recommend` | JWT | 3-phase semantic search |
| POST | `/ai/chat` | JWT | Non-streaming chat |
| GET | `/ai/chat/stream` | JWT | SSE streaming RAG chat |
| GET | `/ai/speech-token` | JWT | Azure Speech STS token proxy |

---

## Do Not

- Business logic in routers
- `session.query()` — use `select()` + `session.execute()`
- `.from_orm()` or `.dict()` — use Pydantic v2 equivalents
- Skip `invalidate_search_cache()` after any product write
- Build chat context from `product_embeddings` — always fetch live from `products` table
- Log or return Azure keys, JWT secrets, or connection strings
- Synchronous blocking calls inside `async def`
- Bare `except:` — always catch specific exceptions
