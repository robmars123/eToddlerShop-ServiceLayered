# AGENTS.md — AI E-Commerce Platform (FastAPI / React)

## File Map — Jump Directly Here

Use this map to locate any file without filesystem exploration.

### Backend (`backend/app/`)

| File | What it contains |
|---|---|
| `app/main.py` | FastAPI init, lifespan (pgvector + create_all + admin seed), CORS, rate limiter, request logger, router registration |
| `app/database.py` | `Settings` (pydantic-settings), async SQLAlchemy engine, `SessionLocal`, `Base` |
| **Models** | |
| `app/models/user.py` | `User` — id, email, username, role, is_active, entra_oid |
| `app/models/product.py` | `Product` — id, name, description, price, stock, image_url |
| `app/models/order.py` | `Order` — id, user_id, items (JSON), total, status |
| `app/models/product_embedding.py` | `ProductEmbedding` — product_id, embedding (pgvector) |
| **Schemas** | |
| `app/schemas/user_schema.py` | UserCreate, UserResponse |
| `app/schemas/auth_schema.py` | TokenRequest, TokenResponse |
| `app/schemas/product_schema.py` | ProductCreate, ProductUpdate, ProductResponse |
| `app/schemas/order_schema.py` | OrderCreate, OrderResponse |
| `app/schemas/ai_schema.py` | ChatRequest, ChatHistoryResponse, RecommendRequest, RecommendResponse |
| **Routers** — all mounted at `/api/v1` | |
| `app/routers/health.py` | GET `/health` — DB, Redis, AI connectivity |
| `app/routers/auth.py` | POST `/auth/token` — Entra token exchange |
| `app/routers/users.py` | GET `/users/me`, GET `/users/` (admin) |
| `app/routers/products.py` | CRUD `/products`, image upload, AI index trigger |
| `app/routers/orders.py` | POST `/orders/`, GET `/orders/` |
| `app/routers/ai.py` | POST `/ai/chat/stream`, GET `/ai/chat/history`, POST `/ai/recommend`, POST `/ai/speech` |
| **Services** | |
| `app/services/auth/entra_token_validator.py` | JWKS fetch + Entra claims validation |
| `app/services/auth/auth_service.py` | `get_current_user` FastAPI dependency, admin role guard |
| `app/services/products/products_service.py` | Product CRUD, Azure Blob image upload, cache invalidation |
| `app/services/users/users_service.py` | User lookup and upsert (keyed by entra_oid) |
| `app/services/orders/orders_service.py` | Order creation, status management |
| `app/services/ai/_clients.py` | Singleton clients — AzureOpenAI, Speech, sync+async Redis |
| `app/services/ai/chat_service.py` | Streaming chat — calls orchestrator, yields SSE deltas |
| `app/services/ai/embedding_service.py` | `embed_single_product`, `delete_product_embedding`, batch indexing |
| `app/services/ai/recommend_service.py` | 3-phase recommend pipeline (extract → vector search → re-rank) |
| `app/services/ai/speech_service.py` | Azure TTS synthesis (key proxied server-side, never reaches browser) |
| `app/services/ai/orchestrator/chat_orchestrator.py` | LangChain `RunnableWithMessageHistory` pipeline |
| `app/services/ai/orchestrator/history_repository.py` | Redis history — key `chat_history:{sessionId}`, `HISTORY_TTL = 3600` (resets on each message) |
| **Email** | |
| `app/services/email/events.py` | All event dataclasses (each with `event_type: ClassVar[str]`): product events + `OrderItemData`, `OrderPlaced/StatusChanged/Cancelled/Deleted` |
| `app/services/email/email_sender.py` | `IEmailSender` Protocol + `SmtpEmailSender` (plain SMTP / SMTP_SSL via `smtp_use_tls`) |
| `app/services/email/_base.py` | `BaseEmailService` — shared `__init__`, `from_settings()` classmethod, `_send()` (propagates SMTP exceptions) |
| `app/services/email/email_service.py` | `ProductEmailService(BaseEmailService)` — one `async on_*` handler per product event |
| `app/services/email/order_email_service.py` | `OrderEmailService(BaseEmailService)` — handlers for placed, status changed, cancelled, deleted |
| `app/services/email/event_publisher.py` | `EventPublisher(queue)` — lazy singleton RabbitMQ channel; `get_product_event_publisher()` / `get_order_event_publisher()` FastAPI deps |
| `backend/_consumer.py` | Shared notifier runner — `setup_logging()`, `run_consumer(queue, dispatch, svc)` with smart ack/nack (requeue on transient errors, discard poison messages) |
| `backend/product_notifier.py` | Thin wrapper: `_DISPATCH` + `main()` → `run_consumer(PRODUCT_EVENTS_QUEUE, ...)` |
| `backend/order_notifier.py` | Thin wrapper: `_DISPATCH` + `_deserialize()` + `main()` → `run_consumer(ORDER_EVENTS_QUEUE, ...)` |

### Backend Tests (`backend/tests/`)

| File | Purpose |
|---|---|
| `conftest.py` | pytest fixtures, async test DB session |
| `test_api_products.py` | Product endpoint integration tests |
| `test_auth_service.py` | Auth service unit tests |

### Frontend (`client/src/`)

| File | Purpose |
|---|---|
| `main.tsx` | React + `MsalProvider` bootstrap |
| `App.tsx` | React Router routes, `ProtectedRoute` usage |
| `config.ts` | `API_BASE_URL` from `import.meta.env.VITE_API_URL` |
| `types.ts` | Shared TypeScript types (Product, Order, User, etc.) |
| `config/msalConfig.ts` | `PublicClientApplication` config from Vite env vars |
| **Pages** | |
| `pages/ProductsPage.tsx` | `/` — browse all products |
| `pages/ProductDetailPage.tsx` | `/products/:id` — single product + add to cart |
| `pages/CartPage.tsx` | `/cart` — cart review + checkout (place order) |
| `pages/OrdersPage.tsx` | `/orders` — order history (protected) |
| `pages/RecommendPage.tsx` | `/recommend` — AI product recommendations |
| `pages/AdminPage.tsx` | `/admin` — product management, analytics, health (admin only) |
| `pages/LoginPage.tsx` | `/login` — triggers Entra `loginRedirect` |
| `pages/HealthPage.tsx` | `/health` — backend health status with 30 s auto-refresh |
| **Components** | |
| `components/Navbar/Navbar.tsx` | Top nav — auth state, cart badge, role-based links |
| `components/ProductCard/ProductCard.tsx` | Product grid tile with add-to-cart button |
| `components/Cart/CartStore.tsx` | Cart context + `localStorage` persistence |
| `components/ProtectedRoute/ProtectedRoute.tsx` | Redirects to `/login` if not authenticated |
| `components/Admin/ProductsTable.tsx` | Admin table with inline edit |
| `components/Admin/ProductTableRow.tsx` | Single row (view mode) |
| `components/Admin/EditProductRow.tsx` | Single row (edit mode) |
| `components/Admin/AddProductForm.tsx` | New product form with image upload |
| **Features** | |
| `features/Auth/AuthContext.tsx` | Global `user`, `loading`, `getToken`, `login`, `logout` — MSAL-backed |
| `features/Chatbot/components/ChatWidget.tsx` | Floating chat UI |
| `features/Chatbot/hooks/useChat.ts` | Chat state, Redis history restore on mount, streaming via SSE |
| `features/Chatbot/hooks/useRecommend.ts` | Recommendation query/result state, sort, grid cols |
| `features/Chatbot/hooks/useSpeech.ts` | Browser `SpeechRecognition` wrapper |
| `features/Chatbot/services/chatService.ts` | `fetchChatHistory`, `streamChatMessage` (SSE reader) |
| **Services** | |
| `services/productsService.ts` | `getProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `uploadImage` |
| `services/ordersService.ts` | `placeOrder`, `getOrders`, `cancelOrder` |
| `services/aiService.ts` | `recommend` |
| `services/speechService.ts` | `synthesizeSpeech` |
| **Tests** | |
| `components/Navbar/Navbar.test.tsx` | Navbar render tests |
| `components/ProtectedRoute/ProtectedRoute.test.tsx` | Auth guard tests |
| `components/Cart/CartStore.test.tsx` | Cart state tests |
| `services/productsService.test.ts` | Products API client tests |
| `test/setup.ts` | Vitest global setup |

### Environment Variables

**Backend (`backend/.env`)**
```
DATABASE_URL=postgresql+asyncpg://...
DATABASE_SSL=false                        # set true in production
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=                             # comma-separated extra origins
AZURE_ENTRA_TENANT_ID=
AZURE_ENTRA_CLIENT_ID=
AZURE_ENTRA_AUTHORITY=https://<subdomain>.ciamlogin.com/<tenant-id>
AZURE_ENTRA_AUDIENCE=
AZURE_ENTRA_ADMIN_EMAIL=                  # seeded as admin row on startup
AZURE_ENTRA_ADMIN_OID=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_EMBEDDINGS=text-embedding-3-small
AZURE_OPENAI_CHAT=gpt-4o-mini
AZURE_SPEECH_ENDPOINT=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=centralus
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=products
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
SMTP_HOST=host.docker.internal               # resolves to Windows host from inside Docker
SMTP_PORT=2525                                # smtp4dev default port
SMTP_FROM=noreply@app.local
SMTP_TO=admin@app.local                       # comma-separated recipients
SMTP_USE_TLS=false                            # set true + port 465 in production
```

**Frontend (`client/.env.local`)**
```
VITE_API_URL=http://localhost:8000
VITE_ENTRA_AUTHORITY=https://<subdomain>.ciamlogin.com/<tenant-id>
VITE_ENTRA_CLIENT_ID=<guid>
VITE_ENTRA_SCOPES=openid offline_access profile
```

### Auth Flow (summary)
1. `loginRedirect()` → Entra issues ID token
2. Client POSTs token to `POST /api/v1/auth/token`
3. Backend validates via JWKS, upserts user row by `entra_oid`, returns user object
4. All API calls send `Authorization: Bearer <entra_id_token>`
5. Admin row seeded from `AZURE_ENTRA_ADMIN_EMAIL` on startup; linked via `entra_oid` on first login

### Chat Session Keys
- Logged-in user: `user-{db_user_id}`
- Guest: UUID from `localStorage["guest_chat_session"]`
- Redis key: `chat_history:{sessionId}`

### Rate Limits (per IP, per 60 s)
| Prefix | Limit |
|---|---|
| `/api/v1/ai` | 20 rpm |
| `/api/v1/auth` | 20 rpm |
| `/api/v1/orders` | 40 rpm |
| everything else | 120 rpm |

Redis unavailable → middleware **fails open** (traffic passes through).

---

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
| `product:{id}` | 60 sec | update, delete, image upload for that product |
| `orders:all` | 60 sec | create, update status, cancel, delete |
| `orders:user:{user_id}` | 60 sec | create, update status, cancel, delete (for that user) |
| `orders:analytics` | 60 sec | create, update status, cancel, delete |
| `users:all` | 60 sec | create, update, delete user |

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
