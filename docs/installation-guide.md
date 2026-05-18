# Installation Guide

Two ways to run the app. Pick one.

---

## Option A — Local Dev with F5 Debugging (recommended for development)

DB runs in Docker. Backend and frontend run on your machine. VS Code F5 attaches a debugger to the backend.

### 1. Install prerequisites

| Tool | How |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Download and install |
| [Node.js LTS](https://nodejs.org/) | Download and install |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | `winget install astral-sh.uv` |
| VS Code | Download and install |
| VS Code Python extension | Install `ms-python.python` from the Extensions panel |

### 2. Clone the repo

```powershell
git clone <your-repo-url>
cd App
```

### 3. Set up the backend

```powershell
cd backend
uv sync
copy .env.example .env
```

Open `backend\.env` and fill in your Azure keys:

```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_KEY=...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER=products
```

Leave `DATABASE_URL` as-is — it points to the Docker container on port 5433.

### 4. Set up the frontend

```powershell
cd ..\client
npm install
```

### 5. Start the database

```powershell
cd ..
docker compose up db -d
```

Wait until Docker Desktop shows the `db` container as healthy (green).

### 6. Open in VS Code and press F5

```powershell
code .
```

Press **F5** → select **"FastAPI Debug"** if prompted. VS Code will:
1. Start uvicorn with debugpy on port 5678
2. Wait for `Application startup complete`
3. Attach the debugger automatically

Set breakpoints in any `backend/app/**/*.py` file — execution pauses there.

### 7. Start the frontend (separate terminal)

```powershell
cd client
npm run dev
```

### Access

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Default admin login

- **username:** `admin`
- **password:** `admin`

### After first startup — index products for AI search

Log in as admin, then call once:

```
POST http://localhost:8000/api/v1/ai/embed-products
Authorization: Bearer <your-jwt-token>
```

Or use the Swagger UI at `/docs`.

---

## Option B — Full Docker (everything in containers)

All three services (db, api, client) run in Docker. No local Python or Node needed.

### 1. Install prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. Clone the repo

```powershell
git clone <your-repo-url>
cd App
```

### 3. Create the backend .env

```powershell
copy backend\.env.example backend\.env
```

Open `backend\.env` and fill in your Azure keys (same as Option A step 3).

> The `api` container loads `backend/.env` automatically via `env_file` in `docker-compose.yml`.
> `DATABASE_URL` is overridden by docker-compose to use the internal `db` hostname — you don't need to change it.

### 4. Start everything

```powershell
docker compose up -d --build
```

This builds and starts all three containers: `db`, `api`, `client`.

### 5. Watch startup logs (optional)

```powershell
docker compose logs -f api
```

Wait for `Application startup complete.` before hitting any endpoints.

### Access

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Stop everything

```powershell
docker compose down
```

### Rebuild after code changes

```powershell
docker compose up -d --build api
```

---

## Troubleshooting

**`database "appdb" does not exist`**
The database container is running but the DB wasn't created. Run:
```powershell
docker compose exec db psql -U postgres -c "CREATE DATABASE appdb;"
```

**`uv trampoline failed` or pip not found**
Use `python -m` instead of calling executables directly:
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

**F5 shows `connect ECONNREFUSED :5678`**
Uvicorn must be running before VS Code attaches. Check the Terminal panel — if it shows an error, fix that first, then press F5 again.

**AI search returns no results**
Products must be indexed first. Call `POST /api/v1/ai/embed-products` as admin after adding products.

**Images not showing**
`AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER` must be set in `.env`. The `products` container must exist in your Azure storage account.
