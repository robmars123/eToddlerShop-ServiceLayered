# Backend

FastAPI backend with a simple, flat service-layer architecture.

## Stack

- **Python 3.14** with `uv`
- **FastAPI** — HTTP layer
- **SQLAlchemy 2 (async)** + **asyncpg** — database access
- **PostgreSQL** + **pgvector** — database with vector search
- **Pydantic v2** — schemas and settings
- **JWT** — Bearer token authentication
- **Azure OpenAI** — embeddings and chat completions
- **Azure Speech** — speech-to-text token issuance

## Architecture

```
app/
├── main.py                  # FastAPI app, lifespan, CORS, router registration
├── database.py              # Settings, engine, session factory, Base, get_db()
│
├── models/                  # SQLAlchemy ORM models
│   ├── user.py              # User
│   ├── product.py           # Product
│   ├── order.py             # Order, OrderItem
│   └── product_embedding.py # ProductEmbedding (pgvector)
│
├── schemas/                 # Pydantic request/response schemas
│   ├── user_schema.py       # UserCreate, UserUpdate, UserResponse
│   ├── product_schema.py    # ProductCreate, ProductUpdate, ProductResponse
│   ├── order_schema.py      # OrderCreate, OrderUpdate, OrderResponse, OrderStatus
│   ├── auth_schema.py       # LoginRequest, TokenResponse, TokenData
│   └── ai_schema.py         # RecommendRequest/Response, ChatRequest/Response, etc.
│
├── services/                # Business logic — talk directly to AsyncSession
│   ├── users_service.py     # UserService (CRUD)
│   ├── products_service.py  # ProductService (CRUD + image upload)
│   ├── orders_service.py    # OrderService (CRUD + status update)
│   ├── auth_service.py      # AuthService (login, JWT), get_current_user, require_admin
│   └── ai_service.py        # AIService (embed, recommend, chat), SpeechService, TTLCache
│
└── routers/                 # FastAPI routers — thin, delegate to services
    ├── users.py             # /users endpoints
    ├── products.py          # /products endpoints
    ├── orders.py            # /orders endpoints
    ├── auth.py              # /auth endpoints
    └── ai.py               # /ai endpoints
```

### Dependency flow

```
Router → Service(db) → SQLAlchemy AsyncSession
```

Each router creates its service via `Depends(get_db)` and passes the session in. No repository interfaces or separate DI modules.

## Setup

**Prerequisites:** PostgreSQL with pgvector running, `uv` installed.

```bash
# Install dependencies
uv sync

# Copy and configure environment
cp .env.example .env

# Start dev server
uv run uvicorn app.main:app --reload
```

Tables and the pgvector extension are created automatically on startup. An `admin` user (password: `admin`) is seeded if one does not exist.

## Environment variables

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/appdb` | Async PostgreSQL connection URL |
| `DEBUG` | `false` | Enables SQLAlchemy query logging |
| `JWT_SECRET_KEY` | `change-me` | Secret used to sign JWT tokens |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime in minutes |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded product images |
| `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com/` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | `<key>` | Azure OpenAI API key |
| `AZURE_OPENAI_API_VERSION` | `2024-02-15-preview` | Azure OpenAI API version |
| `AZURE_OPENAI_EMBEDDINGS` | `text-embedding-3-small` | Embeddings deployment name |
| `AZURE_OPENAI_CHAT` | `gpt-4o-mini` | Chat deployment name |
| `AZURE_SPEECH_ENDPOINT` | `https://centralus.api.cognitive.microsoft.com/` | Azure Speech endpoint |
| `AZURE_SPEECH_KEY` | `<key>` | Azure Speech subscription key |
| `AZURE_SPEECH_REGION` | `centralus` | Azure Speech region |

## API

Base path: `/api/v1` — interactive docs at `http://localhost:8000/docs`

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | — | Login, returns JWT token |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/` | — | List all users |
| `POST` | `/api/v1/users/` | — | Create a user |
| `PUT` | `/api/v1/users/{id}` | — | Update a user |
| `DELETE` | `/api/v1/users/{id}` | — | Delete a user |

### Products

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/products/` | — | List all products |
| `GET` | `/api/v1/products/{id}` | — | Get a product |
| `POST` | `/api/v1/products/` | Admin | Create a product |
| `PUT` | `/api/v1/products/{id}` | Admin | Update a product |
| `DELETE` | `/api/v1/products/{id}` | Admin | Delete a product |
| `POST` | `/api/v1/products/{id}/image` | Admin | Upload product image |

### Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/orders/` | — | List all orders |
| `GET` | `/api/v1/orders/user/{user_id}` | — | List orders for a user |
| `POST` | `/api/v1/orders/` | — | Create an order |
| `PATCH` | `/api/v1/orders/{id}/status` | — | Update order status |
| `DELETE` | `/api/v1/orders/{id}` | — | Delete an order |

### AI

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/ai/embed-products` | Admin | Bulk index all products into vector store |
| `POST` | `/api/v1/ai/recommend` | — | AI product recommendations (3-phase pipeline) |
| `POST` | `/api/v1/ai/chat` | — | RAG-based shopping assistant |
| `GET` | `/api/v1/ai/speech-token` | — | Issue short-lived Azure Speech token |

### Static files

Uploaded product images are served at `/uploads/products/<filename>`.
