╔══════════════════════════════════════════════════════════════════════════╗
  ║                          WEB APP ENTRY                                   ║
  ║                    User opens browser → React SPA                        ║
  ╚══════════════════════════════════════════════════════════════════════════╝
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
         /  Products           /recommend              /admin
         (browse shop)       AI Search Page          Admin Panel
                                                          │
                                            ┌─────────────┘
                                            ▼
                                ┌───────────────────────┐
                                │  [Embed Products]     │  (one-time / on-demand)
                                │  POST /ai/embed-      │
                                │  products (admin only)│
                                └───────────┬───────────┘
                                            │
                                For each product in DB:
                                            │
                                ┌───────────▼───────────┐
                                │  Build text string:   │
                                │  "{name}. {desc}.     │
                                │   Price: ${price}"    │
                                └───────────┬───────────┘
                                            │
                                ┌───────────▼────────────────────────┐
                                │  Azure OpenAI Embeddings           │
                                │  Model: text-embedding-3-small     │
                                │  Input : product text string       │
                                │  Output: float[1536] vector        │
                                └───────────┬────────────────────────┘
                                            │
                                ┌───────────▼───────────┐
                                │  PostgreSQL + pgvector │
                                │  table: product_       │
                                │  embeddings            │
                                │  (upsert per product)  │
                                └───────────────────────┘


  ══════════════════════════════════════════════════════════════════════════
    USER FLOW A — AI Search  (/recommend)
  ══════════════════════════════════════════════════════════════════════════

    ┌──────────────────────────────────┐
    │  User types query                │   e.g. "toys for girls under $20"
    │  — OR —                          │
    │  User clicks 🎤 mic button       │
    └──────────────┬───────────────────┘
                   │
          [if voice input]
                   │
    ┌──────────────▼───────────────────┐
    │  GET /ai/speech-token            │
    │  Backend calls Azure Speech STS: │
    │  POST /sts/v1.0/issueToken       │
    │  Output: short-lived auth token  │  (key never exposed to browser)
    └──────────────┬───────────────────┘
                   │
    ┌──────────────▼───────────────────┐
    │  Azure Speech SDK (in browser)   │
    │  Service: Azure Speech Service   │
    │  Endpoint: centralus.cognitive.. │
    │  Input : microphone audio stream │
    │  Output: transcript text string  │
    └──────────────┬───────────────────┘
                   │
                   │  transcript auto-fills search box
                   │  + immediately fires search
                   │
    ┌──────────────▼────────────────────────────────────────────┐
    │  POST /ai/recommend  { message: "toys for girls under $20" }
    └──────────────┬────────────────────────────────────────────┘
                   │
                   │
    ── PHASE 1: Filter Extraction ──────────────────────────────
                   │
    ┌──────────────▼───────────────────────────────────────────┐
    │  Azure OpenAI Chat (gpt-4o-mini)                         │
    │  mode: JSON  temp: 0.1                                   │
    │  system: "extract structured filters from query"         │
    │  user  : "toys for girls under $20"                      │
    │                                                          │
    │  Output JSON:                                            │
    │  { "query": "toys for girls",                            │
    │    "filters": { "price_max": 20, "category": "", ... } } │
    └──────────────┬───────────────────────────────────────────┘
                   │
    ── PHASE 2: Vector Search ──────────────────────────────────
                   │
    ┌──────────────▼───────────────────────────────────────────┐
    │  Azure OpenAI Embeddings (text-embedding-3-small)        │
    │  Input : extracted query  →  "toys for girls"            │
    │  Output: float[1536] query vector                        │
    └──────────────┬───────────────────────────────────────────┘
                   │
    ┌──────────────▼───────────────────────────────────────────┐
    │  pgvector cosine distance search                         │
    │  WHERE cosine_distance(embedding, query_vector) < 0.8    │
    │  ORDER BY distance  LIMIT 50                             │
    │                                                          │
    │  → filter results: price <= 20  (from extracted filters) │
    │  Output: list of candidate ProductEmbedding objects      │
    └──────────────┬───────────────────────────────────────────┘
                   │
    ── PHASE 3: AI Re-Ranking ──────────────────────────────────
                   │
    ┌──────────────▼───────────────────────────────────────────┐
    │  Azure OpenAI Chat (gpt-4o-mini)                         │
    │  mode: JSON  temp: 0.1                                   │
    │  system: "rank products by relevance to query"           │
    │  user  : original message + candidate product list       │
    │                                                          │
    │  Output JSON:  { "rankedProductIds": [42, 7, 19, ...] }  │
    └──────────────┬───────────────────────────────────────────┘
                   │
    ┌──────────────▼───────────────────────────────────────────┐
    │  Frontend maps ranked IDs → full Product objects         │
    │  (from GET /products fetched in parallel)                │
    │  Renders ProductCard grid in ranked order                │
    └──────────────────────────────────────────────────────────┘


  ══════════════════════════════════════════════════════════════════════════
    USER FLOW B — Chat Widget  (floating button, any page)
  ══════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────┐
    │  User types message in widget   │   e.g. "what's good for a 3 year old?"
    └─────────────────┬───────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  POST /ai/chat  { message: "what's good for a 3 year old?" }
    └─────────────────┬──────────────────────────────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  Azure OpenAI Embeddings (text-embedding-3-small)      │
    │  Input : user message                                  │
    │  Output: float[1536] query vector                      │
    └─────────────────┬──────────────────────────────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  pgvector cosine search                                │
    │  top_k=5  max_distance=0.8                             │
    │  Output: 5 most relevant ProductEmbedding objects      │
    └─────────────────┬──────────────────────────────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  Build RAG context string from the 5 products          │
    │  "- {name}: {desc}. Price: ${price}"  × 5             │
    └─────────────────┬──────────────────────────────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  Azure OpenAI Chat (gpt-4o-mini)                       │
    │  mode: plain text  temp: 0.7                           │
    │  system: "You are a shopping assistant.                │
    │           Use ONLY these products: {context}"          │
    │  user  : original message                              │
    │                                                        │
    │  Output: friendly natural language reply               │
    └─────────────────┬──────────────────────────────────────┘
                      │
    ┌─────────────────▼──────────────────────────────────────┐
    │  Displayed as assistant bubble in ChatWidget           │
    └────────────────────────────────────────────────────────┘

  ---
  Azure services used and their roles

  ┌─────────────────────────┬────────────────────────┬─────────────────────────────────────────────────────┐
  │         Service         │         Model          │                     Called for                      │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
  │ Azure Speech Service    │ STT (centralus)        │ Mic audio → transcript text                         │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
  │ Azure OpenAI Embeddings │ text-embedding-3-small │ Text → 1536-dim vector (indexing + search + chat)   │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
  │ Azure OpenAI Chat       │ gpt-4o-mini            │ Filter extraction, product re-ranking, chat replies │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
  │ PostgreSQL + pgvector   │ —                      │ Stores and searches vectors via cosine distance     │
  └─────────────────────────┴────────────────────────┴─────────────────────────────────────────────────────┘