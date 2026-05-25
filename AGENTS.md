# AGENTS.md — AI E-Commerce Platform (FastAPI / React)

## Stack
**Backend:** FastAPI 0.136+, Python 3.14, SQLAlchemy 2.0 async, Pydantic v2, PostgreSQL 16 + pgvector, Redis 7, Azure OpenAI (gpt-4o-mini + text-embedding-3-small), Azure Blob Storage, Azure Speech Service
**Frontend:** React 18 + TypeScript strict, Vite, React Router v6, Tailwind CSS, native fetch (no TanStack), nginx

---

## Architecture — Router → Service → Model

app/
├── routers/     # HTTP only — no logic, no DB, no Redis
├── services/    # All business logic — async def, private helpers _name()
├── models/      # SQLAlchemy ORM defs only — no methods, no Pydantic
├── schemas/     # Pydantic v2 only — no SQLAlchemy imports
├── database.py  # Settings (pydantic-settings), async engine, SessionLocal
└── main.py      # Lifespan: pgvector, create_all, seed admin; CORS; routers

**Key rules:**
- Routers inject services via `Depends()` and use `BackgroundTasks` — nothing else
- Use `model_validate()` to convert ORM → schema (not `.from_orm()`)
- SQLAlchemy 2.0: `select()` + `session.execute()` + `session.scalar_one_or_none()` — never `session.query()`

---

## AI Pipelines

### `/ai/recommend` — 3-Phase
1. GPT-4o-mini extracts `{query, filters}`. Price ops: `price_min` (>=), `price_max` (<=), `price_above` (>), `price_below` (<), `price_exact` (==). "X and above/below" → `price_min`/`price_max`.
2. Embed message → cosine search on `product_embeddings`. Threshold: **0.75** (no price filter), **0.90** (price filter). Limit 50. Hard price filter in Python after search.
3. GPT-4o-mini re-ranks → returns `rankedProductIds[]`.
- Cached: `rec:{md5(message)}`, 5 min TTL. Invalidated on any product mutation.

### `/ai/chat/stream` — RAG SSE
- Calls `recommend()` internally → fetches context from **`products` table only — never `product_embeddings`**
- Falls back to all products by ID if recommend returns empty
- Streams: `f"data: {json.dumps({'delta': v})}\n\n"` → ends with `data: [DONE]`
- Guard: `if not chunk.choices: continue` — never access `chunk.choices[0]` unguarded
- GPT instructed never to mention products not in context

### Embedding Auto-Indexing
- Create/update → `embed_single_product()` as `BackgroundTask`
- Delete → `delete_product_embedding()` as `BackgroundTask`
- Both must call `invalidate_search_cache()` — deletes ALL `rec:*` + `products:all`

---

## Redis Cache Keys

| Key | TTL | Invalidated by |
|---|---|---|
| `emb:{md5(text)}` | 30 days | Never |
| `rec:{md5(message)}` | 5 min | Any product mutation |
| `products:all` | 60 sec | Any product mutation |

---

## Non-Obvious Security Rules
- JWT in `sessionStorage` (not localStorage) — access only via `getStoredToken()` from AuthContext
- Speech STS token proxied server-side — Azure key never reaches browser
- File uploads: content-type allowlist + 5 MB limit
- `DATABASE_SSL=true` in production

---

## Forbidden

| Never do |
|---|
| Business logic or DB queries in routers |
| SQLAlchemy imports in schemas |
| Router imports in services |
| Skip `invalidate_search_cache()` after any product write |
| Skip `delete_product_embedding()` on product delete |
| Build chat context from `product_embeddings` |
| Let GPT reference products not in its context |
| Secrets or API keys in frontend code |
| Blocking calls inside async functions |
| Array index as React `key` prop |

---

## Claude Rules
- **Read the file before editing** — never edit blind
- **Minimal diff** — do not refactor unrelated code
- **No invented APIs** — if unsure about FastAPI / SQLAlchemy / Pydantic / Redis API, say so
- **No TODOs or stubs** — every change must be production-ready
- **Fail loudly** — if correct implementation is impossible within constraints, say so
