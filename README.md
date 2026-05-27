# eToddlerShop — Full-Stack E-Commerce App

A full-stack product management and e-commerce application with Azure Entra External ID authentication, an AI-powered recommendation engine and chatbot, Redis caching, and an admin dashboard with order analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async), asyncpg |
| Database | PostgreSQL 16 + pgvector extension (Docker) |
| Cache / Rate limiting | Redis (optional — fails open when unavailable) |
| Auth | Azure Entra External ID (CIAM), MSAL, RS256 JWKS validation |
| AI | Azure OpenAI (GPT-4o-mini + text-embedding-3-small) |
| Speech | Azure Cognitive Services Speech |
| Image storage | Azure Blob Storage |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Package mgr | uv (backend), npm (frontend) |

---

## Architecture

```
App/
├── backend/                        # FastAPI application
│   ├── app/
│   │   ├── main.py                 # App entry, lifespan, rate limiter, logging middleware
│   │   ├── database.py             # SQLAlchemy async engine, session, pydantic settings
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── product.py
│   │   │   ├── product_embedding.py
│   │   │   └── order.py
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   │   ├── user_schema.py
│   │   │   ├── product_schema.py
│   │   │   ├── order_schema.py     # + OrderPeriodStat, OrderAnalytics
│   │   │   ├── auth_schema.py
│   │   │   └── ai_schema.py
│   │   ├── routers/                # FastAPI route handlers (thin — delegate to services)
│   │   │   ├── auth.py
│   │   │   ├── products.py
│   │   │   ├── users.py
│   │   │   ├── orders.py
│   │   │   ├── ai.py
│   │   │   └── health.py           # Parallel health checks with hard timeouts
│   │   └── services/               # Business logic — subdirectory per domain
│   │       ├── auth/
│   │       │   ├── auth_service.py
│   │       │   └── entra_token_validator.py
│   │       ├── ai/
│   │       │   ├── _clients.py
│   │       │   ├── chat_service.py
│   │       │   ├── embedding_service.py
│   │       │   ├── recommend_service.py
│   │       │   └── speech_service.py
│   │       ├── orders/
│   │       │   └── orders_service.py
│   │       ├── products/
│   │       │   └── products_service.py  # Redis fail-open cache
│   │       └── users/
│   │           └── users_service.py
│   └── tests/
│       ├── conftest.py
│       ├── test_api_products.py
│       └── test_auth_service.py
├── client/                         # React frontend
│   └── src/
│       ├── pages/                  # Route-level page components
│       │   ├── AdminPage.tsx       # Sidebar + CRUD + order analytics charts + health
│       │   ├── CartPage.tsx
│       │   ├── OrdersPage.tsx      # Order history + cancel
│       │   ├── LoginPage.tsx
│       │   ├── ProductsPage.tsx
│       │   ├── ProductDetailPage.tsx
│       │   └── RecommendPage.tsx
│       ├── components/             # Shared UI components
│       │   ├── Admin/
│       │   ├── Cart/               # CartStore (Zustand)
│       │   ├── Navbar/
│       │   ├── ProductCard/
│       │   └── ProtectedRoute/
│       ├── features/
│       │   ├── Auth/               # MSAL context, hooks
│       │   └── Chatbot/            # Floating widget, hooks, services
│       ├── services/               # API client functions
│       │   ├── aiService.ts
│       │   ├── ordersService.ts
│       │   ├── productsService.ts
│       │   └── speechService.ts
│       └── config/
│           └── msalConfig.ts       # Azure Entra MSAL configuration
├── docker-compose.yml              # PostgreSQL + Redis containers
└── .vscode/
    ├── launch.json                 # FastAPI debugpy attach config
    └── tasks.json                  # Pre-launch task: start uvicorn with debugpy
```

### Request Flow

```
React Client (MSAL token) → FastAPI Rate Limiter → CORS → Router → Service → PostgreSQL
                                                                  ↘ Redis (cache, optional)
                                                                  ↘ Azure Blob Storage
                                                                  ↘ Azure OpenAI
```

---

## API Endpoints

Base path: `/api/v1` — interactive docs at `http://localhost:8000/docs`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/entra` | Exchange Entra ID token for session; upserts user record |

### Products
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/products/` | Public | List all products (Redis-cached, 1 min TTL) |
| GET | `/products/{id}` | Public | Get product by ID |
| POST | `/products/` | Admin | Create product |
| PUT | `/products/{id}` | Admin | Update product |
| DELETE | `/products/{id}` | Admin | Delete product + blob |
| POST | `/products/{id}/image` | Admin | Upload image to Azure Blob (JPEG/PNG/WebP/GIF, max 5 MB) |

### Users
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/users/` | Admin | List users |
| POST | `/users/` | Admin | Create user |
| PUT | `/users/{id}` | Admin | Update user |
| DELETE | `/users/{id}` | Admin | Delete user |

### Orders
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/orders/` | Admin | List all orders |
| GET | `/orders/my` | Auth | List current user's orders |
| GET | `/orders/analytics` | Admin | Aggregated counts and revenue by day/month/year |
| GET | `/orders/user/{user_id}` | Admin | List orders for a specific user |
| POST | `/orders/` | Auth | Create order |
| PATCH | `/orders/{id}/status` | Admin | Update order status |
| POST | `/orders/{id}/cancel` | Auth | Cancel a pending order (owner only) |
| DELETE | `/orders/{id}` | Admin | Delete order |

### AI
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/ai/embed-products` | Admin | Index all products into pgvector |
| POST | `/ai/recommend` | Public | AI product recommendations (3-phase pipeline) |
| POST | `/ai/chat` | Public | RAG-based shopping assistant |
| GET | `/ai/speech-token` | Public | Issue Azure Speech token for STT |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Parallel status of API, database, Redis, and Azure Storage |

---

## AI Pipeline (Recommend)

1. **Filter extraction** — GPT-4o-mini parses the query into structured price/category filters
2. **Vector search** — query embedded and cosine-distance searched against `product_embeddings` (pgvector)
3. **Hard filter pass** — price filters applied to vector results
4. **AI re-ranking** — GPT-4o-mini re-ranks shortlist by relevance
5. **TTL cache** — results cached 5 minutes per unique query; invalidated on product changes

---

## Redis (Optional)

Redis is used for two purposes and fails open in both cases:

- **Product cache** — `list_products` result cached for 60 s. If Redis is down, every request hits the database.
- **Rate limiting** — per-IP sliding window (AI: 20/min, auth: 20/min, orders: 40/min, global: 120/min). If Redis is down, all requests pass through.

---

## Image Storage

Product images are stored in Azure Blob Storage (container: `products`). No files are written to disk.

- Upload via `POST /api/v1/products/{id}/image`
- A **10-year SAS URL** is generated and stored in `products.image_url`
- Old blob is deleted when image is replaced or product is deleted

---

## Database Models

**users** — id, email, username, entra_oid, is_active, role (user/admin)

**products** — id, name, description, price, image_url (Azure Blob SAS URL)

**product_embeddings** — product_id (FK), embedding (vector), product_name, product_description, product_price

**orders** — id, user_id, status (pending/processing/shipped/delivered/cancelled), created_at

**order_items** — id, order_id (FK), product_id, quantity, unit_price

---

## Local Development Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) LTS
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — `winget install astral-sh.uv`
- VS Code + Python extension
- Azure Entra External ID tenant with a registered app

### First-time setup

```powershell
# 1. Start PostgreSQL and Redis
docker compose up -d

# 2. Backend
cd backend
uv sync
cp .env.example .env
# Fill in Azure credentials in .env

# 3. Frontend
cd ..\client
npm install
cp .env.example .env.local
# Fill in VITE_AZURE_ENTRA_* values
```

### Running (every time)

**Terminal 1 — Backend** (or press F5 in VS Code for debugger):
```powershell
cd backend
uv run uvicorn app.main:app --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd client
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Health | http://localhost:8000/api/v1/health |

### Admin account

An admin user is seeded automatically on first startup using the email in `AZURE_ENTRA_ADMIN_EMAIL`. Sign in through the Entra popup and the account is promoted to admin role.

---

## VS Code Debugging

Press **F5** — VS Code starts uvicorn with debugpy and attaches automatically. Set breakpoints in any `backend/app/**/*.py` file.

Requires `DEBUG_PORT` env var (handled by `.vscode/tasks.json`).
