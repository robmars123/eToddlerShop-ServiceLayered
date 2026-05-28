  ══════════════════════════════════════════════════════════════════════════
    APP ENTRY
  ══════════════════════════════════════════════════════════════════════════

  User opens browser → React SPA loads → Microsoft Entra login popup
  After sign-in, every API request carries the Entra token in the header.
  FastAPI validates the token on each request before doing anything.

                              │
            ┌─────────────────┼──────────────────┐
            ▼                 ▼                  ▼
       /products          /recommend           /admin
      (browse shop)      (AI search)        (admin panel)


  ══════════════════════════════════════════════════════════════════════════
    HOW THE AI WORKS — Overview
  ══════════════════════════════════════════════════════════════════════════

  There are two AI features: AI Search and Chat Assistant.
  Both rely on the same idea: products are converted into vectors (numbers
  that represent meaning) so the app can find relevant items by meaning,
  not just keyword matching.

  Before either feature works, an admin must index the products once:

    Admin clicks "Index Products" in the Admin Panel
      → Each product's name, description and price are sent to Azure OpenAI
      → Azure OpenAI returns a vector (1536 numbers) representing that product
      → Vector is stored in PostgreSQL alongside the product

  That's the setup step. Everything below uses those stored vectors.


  ══════════════════════════════════════════════════════════════════════════
    AI FEATURE 1 — AI Search  (/recommend)
  ══════════════════════════════════════════════════════════════════════════

  User types (or speaks) a query like "toys for girls under $20"

  The backend runs three steps:

  ┌─────────────────────────────────────────────────────────────┐
  │  STEP 1 — Understand the query                              │
  │                                                             │
  │  GPT-4o-mini reads the query and extracts:                  │
  │  - the core search term  ("toys for girls")                 │
  │  - any price limits      (max $20)                          │
  └─────────────────────────────┬───────────────────────────────┘
                                │
  ┌─────────────────────────────▼───────────────────────────────┐
  │  STEP 2 — Find similar products                             │
  │                                                             │
  │  The query is converted to a vector, then compared against  │
  │  all product vectors in the database.                       │
  │  Products with similar meaning bubble up. Price filters     │
  │  from Step 1 are applied to narrow the list further.        │
  └─────────────────────────────┬───────────────────────────────┘
                                │
  ┌─────────────────────────────▼───────────────────────────────┐
  │  STEP 3 — Pick the best matches                             │
  │                                                             │
  │  GPT-4o-mini looks at the shortlist and ranks products      │
  │  by how well they actually match what the user asked for.   │
  │  Returns a ranked list of product IDs.                      │
  └─────────────────────────────┬───────────────────────────────┘
                                │
                    Results displayed as product cards
                    in ranked order on the page.

  Results are cached for 5 minutes — the same query won't
  hit Azure OpenAI twice within that window.


  ══════════════════════════════════════════════════════════════════════════
    AI FEATURE 2 — Chat Assistant  (floating widget, any page)
  ══════════════════════════════════════════════════════════════════════════

  User types "what's good for a 3 year old?"

  ┌─────────────────────────────────────────────────────────────┐
  │  Find relevant products                                     │
  │                                                             │
  │  The message is converted to a vector and the 5 closest     │
  │  products in the database are retrieved.                    │
  └─────────────────────────────┬───────────────────────────────┘
                                │
  ┌─────────────────────────────▼───────────────────────────────┐
  │  Generate a grounded reply                                  │
  │                                                             │
  │  Those 5 products are given to GPT-4o-mini as context.      │
  │  GPT can only answer using those products — it cannot        │
  │  make up products or go off-topic.                          │
  │                                                             │
  │  Output: a friendly, natural language shopping suggestion.  │
  └─────────────────────────────────────────────────────────────┘

  Key difference from AI Search: Chat gives a conversational answer.
  AI Search returns a product grid you can click and buy from.


  ══════════════════════════════════════════════════════════════════════════
    VOICE INPUT  (AI Search only)
  ══════════════════════════════════════════════════════════════════════════

  User clicks the mic button instead of typing.

  The backend issues a short-lived Azure Speech token (the actual key
  never leaves the server). The browser uses that token to stream mic
  audio directly to Azure Speech Service, which returns a transcript.
  The transcript fills the search box and the search fires automatically.


  ══════════════════════════════════════════════════════════════════════════
    PRODUCT IMAGE UPLOAD  (admin only)
  ══════════════════════════════════════════════════════════════════════════

  Admin uploads an image in the Admin Panel
    → Image is uploaded to Azure Blob Storage
    → A long-lived read URL (SAS URL) is generated and saved to the database
    → That URL is what the frontend loads when showing product images
    → Old image blob is deleted automatically when replaced


  ══════════════════════════════════════════════════════════════════════════
    AZURE SERVICES USED
  ══════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────┬────────────────────────┬──────────────────────────────────────┐
  │ Service                 │ Model                  │ Used for                             │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ Azure Entra External ID │ —                      │ User authentication (CIAM)           │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ Azure OpenAI Embeddings │ text-embedding-3-small │ Convert text to vectors              │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ Azure OpenAI Chat       │ gpt-4o-mini            │ Filter extraction, ranking, chat     │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ Azure Speech Service    │ STT (centralus)        │ Mic audio → transcript text          │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ Azure Blob Storage      │ —                      │ Product image storage + SAS URLs     │
  ├─────────────────────────┼────────────────────────┼──────────────────────────────────────┤
  │ PostgreSQL + pgvector   │ —                      │ Data storage + vector similarity search│
  └─────────────────────────┴────────────────────────┴──────────────────────────────────────┘


  ══════════════════════════════════════════════════════════════════════════
    DEPLOYMENT STACK
  ══════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────┬──────────────────────────────────────────────┐
  │ Component               │ Detail                                       │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ Frontend                │ React SPA served by nginx (Docker container) │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ Backend                 │ Azure App Service (Linux, B1, container)     │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ Container registry      │ GitHub Container Registry (ghcr.io)          │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ Database                │ PostgreSQL with pgvector (Neon free tier)    │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ Cache / Rate limiting   │ Redis (Upstash free tier)                    │
  ├─────────────────────────┼──────────────────────────────────────────────┤
  │ CI/CD                   │ GitHub Actions: test → build → push → deploy │
  └─────────────────────────┴──────────────────────────────────────────────┘

  Local development: docker compose up --build
    db     → PostgreSQL + pgvector (local volume)
    redis  → Redis
    api    → FastAPI (reads backend/.env for Azure credentials)
    client → nginx serving the React build (proxies API to localhost:8000)
