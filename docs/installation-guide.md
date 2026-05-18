Prerequisites — install these first

  1. Docker Desktop (https://www.docker.com/products/docker-desktop/) — for the database
  2. Node.js (https://nodejs.org/) (LTS) — for the React client
  3. uv (https://docs.astral.sh/uv/getting-started/installation/) — Python package manager
  winget install astral-sh.uv
  4. VS Code (https://code.visualstudio.com/) + install the Python extension (ms-python.python)

  ---
  Setup Steps

  1. Clone and open
  git clone <your-repo-url>
  cd App
  code .

  2. Start the database
  docker compose up db -d

  3. Set up the backend
  cd backend
  uv sync
  cp .env.example .env
  Then open backend/.env and fill in your Azure OpenAI and Speech keys.

  4. Set up the frontend
  cd ..\client
  npm install

  ---
  Running the App (every time)

  Terminal 1 — Backend (or press F5 in VS Code for debugging):
  cd backend
  $env:DEBUG_PORT="5678"
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

  Terminal 2 — Frontend:
  cd client
  npm run dev

  ┌─────────────┬────────────────────────────┐
  │   Service   │            URL             │
  ├─────────────┼────────────────────────────┤
  │ Backend API │ http://localhost:8000      │
  ├─────────────┼────────────────────────────┤
  │ Frontend    │ http://localhost:5173      │
  ├─────────────┼────────────────────────────┤
  │ API Docs    │ http://localhost:8000/docs │
  └─────────────┴────────────────────────────┘

  ---
  Note: The .env file is gitignored — you must copy and fill it in manually on every new machine.