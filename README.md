# Full-Stack E-Commerce App

A full-stack product management and e-commerce application with an AI-powered recommendation engine and chatbot.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async), asyncpg |
| Database | PostgreSQL 16 + pgvector extension (Docker) |
| Auth | JWT Bearer Token, bcrypt password hashing |
| AI | Azure OpenAI (GPT-4o-mini + text-embedding-3-small) |
| Speech | Azure Cognitive Services Speech |
| Image storage | Azure Blob Storage |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Package mgr | uv (backend), npm (frontend) |

---

## Architecture

```
App/
├── backend/                  # FastAPI application
│   └── app/
│       ├── main.py           # App entry point, lifespan, middleware, admin seed
│       ├── database.py       # SQLAlchemy async engine, session, pydantic settings
│       ├── models/           # SQLAlchemy ORM models
│       │   ├── user.py
│       │   ├── product.py
│       │   ├── product_embedding.py
│       │   └── order.py
│       ├── schemas/          # Pydantic request/response schemas
│       ├── services/         # Business logic layer
│       │   ├── auth_service.py
│       │   ├── products_service.py
│       │   ├── users_service.py
│       │   ├── orders_service.py
│       │   └── ai_service.py
│       └── routers/          # FastAPI route handlers
│           ├── auth.py
│           ├── products.py
│           ├── users.py
│           ├── orders.py
│           └── ai.py
├── client/                   # React frontend
│   └── src/
│       ├── pages/            # Route-level page components
│       ├── components/       # Shared UI components (Navbar, ProductCard, ProtectedRoute)
│       ├── features/         # Auth context, Chatbot widget
│       └── services/         # API client functions
├── docker-compose.yml        # DB container only (backend + frontend run locally)
└── .vscode/
    ├── launch.json           # FastAPI attach debugger config
    └── tasks.json            # Pre-launch task to start uvicorn with debugpy
```

### Request Flow

```
React Client → FastAPI Router → Service → SQLAlchemy → PostgreSQL (Docker)
                                        ↘ Azure Blob Storage (product images)
```

Routers handle HTTP concerns only. Services contain all business logic. Models are plain SQLAlchemy mapped classes with no framework coupling.

---

## API Endpoints

Base path: `/api/v1`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT |

### Products
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/products/` | Public | List all products |
| GET | `/products/{id}` | Public | Get product by ID |
| POST | `/products/` | Admin | Create product (triggers background embedding) |
| PUT | `/products/{id}` | Admin | Update product (triggers background embedding) |
| DELETE | `/products/{id}` | Admin | Delete product |
| POST | `/products/{id}/image` | Admin | Upload product image to Azure Blob Storage (JPEG/PNG/WebP/GIF, max 5 MB) |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/users/` | List users |
| POST | `/users/` | Create user |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |

### Orders
| Method | Path | Description |
|---|---|---|
| GET | `/orders/` | List all orders |
| GET | `/orders/user/{user_id}` | List orders for a user |
| POST | `/orders/` | Create order |
| PATCH | `/orders/{id}/status` | Update order status |
| DELETE | `/orders/{id}` | Delete order |

### AI
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/ai/embed-products` | Admin | Index all products into pgvector |
| POST | `/ai/recommend` | Public | AI product recommendations |
| POST | `/ai/chat` | Public | Chatbot grounded on product catalog |
| GET | `/ai/speech-token` | Public | Issue Azure Speech token for frontend STT |

### Docs
Interactive API docs available at `http://localhost:8000/docs`

---

## AI Pipeline (Recommend)

1. **Filter extraction** — GPT-4o-mini parses the user's natural language query into structured price/category filters
2. **Vector search** — query is embedded and cosine-distance searched against `product_embeddings` (pgvector)
3. **Hard filter pass** — price filters applied to vector results
4. **AI re-ranking** — GPT-4o-mini re-ranks the shortlist by relevance
5. **TTL cache** — results cached 5 minutes per unique query; invalidated on product changes

---

## Image Storage

Product images are stored in **Azure Blob Storage** (container: `products`). No files are written to disk.

- Upload: `POST /api/v1/products/{id}/image` — accepts JPEG, PNG, WebP, GIF up to 5 MB
- On upload the service generates a **10-year SAS URL** and stores it in `products.image_url`
- On product delete or image replace, the old blob is deleted from Azure
- Required env vars: `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`

---

## Database Models

**users** — id, email, username, hashed_password, is_active, role (user/admin)

**products** — id, name, description, price, image_url (Azure Blob SAS URL)

**product_embeddings** — product_id (FK), embedding (vector), product_name, product_description, product_price

**orders** — id, user_id, status (pending/…), created_at
**order_items** — id, order_id (FK), product_id, quantity, unit_price

---

## Local Development Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) LTS
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — `winget install astral-sh.uv`
- VS Code + Python extension

### First-time setup

```powershell
# 1. Start the database
docker compose up db -d

# 2. Backend
cd backend
uv sync
cp .env.example .env
# Fill in Azure OpenAI, Speech, and Blob Storage keys in .env

# 3. Frontend
cd ..\client
npm install
```

### Running (every time)

**Terminal 1 — Backend** (or press F5 in VS Code for debugger):
```powershell
cd backend
$env:DEBUG_PORT="5678"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
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

### Default admin account

Seeded automatically on first startup:
- **username:** `admin`
- **password:** `admin`

---

## VS Code Debugging

Press **F5** — VS Code will automatically start uvicorn with debugpy and attach. Set breakpoints in any `backend/app/**/*.py` file.

Requires `DEBUG_PORT` env var to be set (handled by `.vscode/tasks.json`).
