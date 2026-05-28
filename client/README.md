# Client

React 19 frontend for eToddlerShop. Authenticates via Azure Entra External ID (MSAL), communicates with the FastAPI backend, and includes an AI-powered chatbot and product recommendation engine.

## Stack

- **React 19** + **TypeScript**
- **Vite** — dev server and bundler
- **Tailwind CSS 4** — utility-first styling (no component library)
- **MSAL Browser** (`@azure/msal-browser`, `@azure/msal-react`) — Azure Entra External ID auth
- **Zustand** — cart state
- **Custom CSS bar charts** — zero-dependency order analytics charts (recharts removed due to CJS bundling issues)

## Project Structure

```
src/
├── pages/                        # Route-level components
│   ├── AdminPage.tsx             # Left sidebar: Products CRUD, Analytics charts, Health
│   ├── CartPage.tsx              # Cart review + checkout
│   ├── LoginPage.tsx             # Entra login redirect
│   ├── OrdersPage.tsx            # Order history + cancel
│   ├── ProductsPage.tsx          # Product listing + search
│   ├── ProductDetailPage.tsx     # Single product + add to cart
│   └── RecommendPage.tsx         # AI recommendation query UI
│
├── components/
│   ├── Admin/                    # Admin sub-components
│   ├── Cart/
│   │   └── CartStore.ts          # Zustand store
│   ├── Navbar/
│   │   └── Navbar.tsx            # Auth-aware nav (My Orders, Admin, Sign out)
│   ├── ProductCard/
│   └── ProtectedRoute/           # Redirects unauthenticated users; role guard for admin
│
├── features/
│   ├── Auth/
│   │   └── AuthContext.tsx       # MSAL context, current user, token helper
│   └── Chatbot/
│       ├── components/
│       │   └── ChatWidget.tsx    # Floating chatbot UI (bubble + message list)
│       ├── hooks/
│       │   ├── useChat.ts        # Chat state: messages, streaming, send()
│       │   ├── useRecommend.ts   # AI search state: query, ranked products, search()
│       │   └── useSpeech.ts      # Mic button state: startListening(), transcribed text
│       └── services/
│           └── chatService.ts    # streamChatMessage() — SSE consumer for /ai/chat/stream
│
├── services/                     # API client functions (fetch wrappers)
│   ├── aiService.ts              # recommendProducts(), embedProducts()
│   ├── ordersService.ts          # fetchMyOrders, createOrder, cancelOrder, fetchOrderAnalytics
│   ├── productsService.ts        # fetchProducts, fetchProductsByIds, fetchProduct,
│   │                             # createProduct, updateProduct, deleteProduct, uploadProductImage
│   └── speechService.ts          # recognizeSpeech() — Azure Speech SDK token fetch + recognition
│
└── config/
    └── msalConfig.ts             # MSAL PublicClientApplication config (Entra External ID)
```

## Pages

| Route | Access | Description |
|---|---|---|
| `/` | Public | Product listing |
| `/products/:id` | Public | Product detail + add to cart |
| `/recommend` | Public | AI recommendation |
| `/cart` | Public | Cart + checkout |
| `/orders` | Auth | Order history + cancel |
| `/login` | Public | Entra login redirect |
| `/admin` | Admin | Admin dashboard (products, analytics, health) |

## Admin Dashboard

`AdminPage.tsx` has three sidebar sections:

- **Products** — full CRUD with image upload, AI index trigger
- **Analytics** — order counts and revenue charts (day/month/year) rendered with a custom CSS bar chart; zero-gap days filled client-side via `padDays()` / `padMonths()`
- **Health** — live status cards for API, database, Redis, and Azure Storage; auto-refreshes every 30 s

## Environment Variables

Create `.env.local` in the `client/` directory:

```env
VITE_API_URL=http://localhost:8000
VITE_AZURE_ENTRA_CLIENT_ID=<app-client-id>
VITE_AZURE_ENTRA_AUTHORITY=https://<tenant>.ciamlogin.com/<tenant-id>
VITE_AZURE_ENTRA_REDIRECT_URI=http://localhost:5173
```

## Setup

```powershell
npm install
npm run dev
```

| Service | URL |
|---|---|
| Dev server | http://localhost:5173 |
| API (backend) | http://localhost:8000 |

## Build

```powershell
npm run build        # outputs to dist/
npm run preview      # serve the production build locally
```

## AI Features

### AI Search — step by step

**1. User types a query and presses Search (or Enter)**
`RecommendPage` calls `useRecommend.search(text)`.

**2. Recommendation request**
`recommendProducts(text)` → `POST /api/v1/ai/recommend` with `{ message }`.
The backend runs a 3-phase pipeline (filter extraction → vector search → re-ranking) and returns `{ ranked_product_ids, query, filters }`. Results are Redis-cached server-side for 5 minutes.

**3. Filter pills rendered**
`setResult(recommend)` triggers `FilterPills` to display what the AI extracted — semantic query, category, age, price bounds, tags.

**4. Batch product fetch**
If `ranked_product_ids` is non-empty, `fetchProductsByIds(ids)` → `POST /api/v1/products/batch` with the ID list (max 100). The backend returns only those product rows in ranked order — no full catalogue fetch.

**5. Results rendered**
`setRankedProducts(ranked)` updates the grid. The user can re-sort by price without re-querying.

---

### Voice Search — step by step

Voice search is available on the AI Search page via the microphone button.

**1. User clicks the mic button**
`useSpeech.startListening()` is called, setting `listening = true` and showing the animated dots.

**2. Token exchange**
`recognizeSpeech()` → `GET /api/v1/ai/speech-token`. The server calls Azure Cognitive Services and returns a short-lived bearer token and region. The subscription key never reaches the browser.

**3. Speech recognition**
The Azure Speech SDK (`microsoft-cognitiveservices-speech-sdk`) creates a `SpeechRecognizer` with the token, opens the default microphone, and waits for a complete utterance via `recognizeOnceAsync()`.

**4. Query handoff**
On a successful result, `useSpeech` calls `onResult(text)`. `RecommendPage` receives the transcribed text, sets the query input, and immediately calls `search(text)` — entering the AI Search flow at step 2 above.

---

### Chatbot — step by step

The floating chatbot widget is always visible (bottom-right corner). It uses the same backend recommendation pipeline, grounded on live product data, and streams the response token by token.

**1. User types a message and sends**
`useChat.send()` appends the user message to the conversation, then calls `streamChatMessage(text, onChunk)`.

**2. SSE stream opened**
`streamChatMessage` → `POST /api/v1/ai/chat/stream`. The backend internally runs the AI Search pipeline on the message to build a product context (top 10 matched products), then streams a GPT-4o-mini response as SSE frames: `data: {"delta": "..."}`.

**3. First chunk received**
`useChat` transitions from `loading` to `streaming`, creates a new assistant message bubble with the first delta text.

**4. Subsequent chunks**
Each delta is appended to the last message in place, giving a character-by-character streaming effect. `useEffect` auto-scrolls to the bottom on every update.

**5. Stream ends**
On `data: [DONE]`, `streaming` is set to false. The complete message stays in the conversation history for the session.

**Voice input in chatbot**
The same `useSpeech` hook is available in the chatbot widget. Steps 1–3 of the Voice Search flow above apply; on result, the input field is populated and `send()` is called immediately.

## Linting

```powershell
npm run lint
```
