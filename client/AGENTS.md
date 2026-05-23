# Client — Agent Context
> React 19 + TypeScript frontend for eToddler Shop AI-powered e-commerce platform.
> Last updated: 2026-05-22

---

## Purpose

Single-page application that provides product browsing, AI-powered semantic search, RAG streaming chat assistant, Azure Speech voice input, cart management, and an admin CRUD panel. Communicates with the FastAPI backend exclusively via REST + SSE.

---

## Language & Runtime

| Item | Value |
|---|---|
| Language | TypeScript 6 (`strict: true`) |
| Framework | React 19 |
| Build tool | Vite 8 |
| Package manager | npm (`package.json`) |
| Served by | nginx (Docker production build) |

---

## Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | React 19 | Strict mode enabled |
| Language | TypeScript 6 | `strict: true` — no `any`, no untyped async |
| Build | Vite 8 | `VITE_*` env vars only |
| Routing | React Router v7 | `<BrowserRouter>` in `main.tsx` |
| Styling | Tailwind CSS v4 | Utility-first — no CSS Modules, no styled-components |
| Auth state | React Context (`AuthContext`) | `sessionStorage` — clears on tab close, not `localStorage` |
| Data fetching | Native `fetch` | No TanStack Query, no axios |
| Streaming chat | `ReadableStream` + `TextDecoder` | SSE parsing in `chatService.ts` |
| Voice input | `microsoft-cognitiveservices-speech-sdk` | Token fetched from backend, key never in browser |

---

## Folder Architecture

```
client/
├── src/
│   ├── main.tsx                  # ReactDOM.createRoot, <BrowserRouter>, <App />
│   ├── App.tsx                   # Route definitions + <ChatWidget /> outside <Routes> (persists all pages)
│   ├── config.ts                 # VITE_API_URL with localhost:8000 fallback
│   ├── types.ts                  # Shared TypeScript interfaces (Product, Order, User, etc.)
│   │
│   ├── features/                 # Self-contained feature modules
│   │   ├── Auth/
│   │   │   ├── AuthContext.tsx   # AuthProvider, useAuth hook, getStoredToken() — sessionStorage JWT
│   │   │   ├── types.ts          # AuthUser, LoginRequest, AuthResponse
│   │   │   └── index.ts          # Re-exports
│   │   └── Chatbot/
│   │       ├── components/
│   │       │   ├── ChatWidget.tsx     # Floating chat bubble — renders outside <Routes>, always mounted
│   │       │   └── ChatWidget.css    # Chat-specific styles (non-Tailwind overrides)
│   │       ├── hooks/
│   │       │   ├── useChat.ts        # SSE stream state, message list, send handler
│   │       │   ├── useRecommend.ts   # Calls recommendProducts(), manages result state
│   │       │   └── useSpeech.ts      # Azure Speech SDK integration, microphone → text
│   │       ├── services/
│   │       │   └── chatService.ts    # streamChat() — SSE fetch, ReadableStream parsing
│   │       ├── types.ts              # Message, ChatState
│   │       └── index.ts              # Re-exports
│   │
│   ├── components/               # Shared UI components (no feature-specific logic)
│   │   ├── Admin/
│   │   │   ├── ProductsTable.tsx     # Table with inline edit/delete rows
│   │   │   ├── AddProductForm.tsx    # New product form with image upload
│   │   │   ├── EditProductRow.tsx    # Inline edit row inside ProductsTable
│   │   │   ├── ProductTableRow.tsx   # Read-only row with edit/delete actions
│   │   │   ├── types.ts              # Admin-specific prop types
│   │   │   └── index.ts
│   │   ├── Cart/
│   │   │   └── CartStore.tsx         # CartContext + useCart hook — add/remove/clear
│   │   ├── Navbar/
│   │   │   ├── Navbar.tsx            # Top nav, auth links, cart badge
│   │   │   └── index.ts
│   │   ├── ProductCard/
│   │   │   ├── ProductCard.tsx       # Product tile with image, price, add-to-cart
│   │   │   ├── ShoppingCartIcon.tsx  # SVG icon component
│   │   │   └── index.ts
│   │   └── ProtectedRoute/
│   │       ├── ProtectedRoute.tsx    # Redirects to /login if no token; role-guards admin routes
│   │       └── index.ts
│   │
│   ├── pages/                    # Route-level page components
│   │   ├── LoginPage.tsx         # Login form, calls authService, stores JWT
│   │   ├── ProductsPage.tsx      # Product grid — fetches all products
│   │   ├── ProductDetailPage.tsx # Single product view with add-to-cart
│   │   ├── RecommendPage.tsx     # AI semantic search — 3-phase pipeline UI
│   │   ├── CartPage.tsx          # Cart review + checkout stub
│   │   └── AdminPage.tsx         # Admin CRUD + "Index Products for AI Search" button
│   │
│   └── services/                 # Plain async fetch functions — never React hooks
│       ├── aiService.ts          # recommendProducts(query), embedProducts() → POST /ai/*
│       ├── productsService.ts    # getProducts(), createProduct(), updateProduct(), deleteProduct()
│       └── speechService.ts     # getSpeechToken() → GET /ai/speech-token (returns {token, region})
│
├── package.json
├── vite.config.ts
├── tsconfig.json                 # strict: true
├── Dockerfile                    # Multi-stage: node build → nginx serve
└── nginx.conf                    # SPA fallback: try_files $uri /index.html
```

---

## Key Files — What They Own

| File | Role |
|---|---|
| `config.ts` | Single source for `API_URL` — import this, never hardcode URLs |
| `types.ts` | `Product`, `Order`, `User`, `CartItem` — shared across all layers |
| `AuthContext.tsx` | `useAuth()` hook, `getStoredToken()` — the only place that reads `sessionStorage` |
| `chatService.ts` | `streamChat()` — SSE fetch, `ReadableStream` decode, `\n\n`-split parsing |
| `CartStore.tsx` | `CartContext` + `useCart()` — add/remove/quantity/clear |
| `ProtectedRoute.tsx` | Wraps admin routes; checks token + role before rendering |

---

## Auth Pattern

```tsx
// Reading the token in a service call
import { getStoredToken } from '../features/Auth';

const res = await fetch(`${API_URL}/products`, {
  headers: { Authorization: `Bearer ${getStoredToken()}` },
});
```

Token is stored in `sessionStorage` by `AuthContext` on login. Never read `sessionStorage` directly outside `AuthContext`.

---

## SSE Streaming Pattern

```ts
// chatService.ts — how SSE chunks are parsed
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') return;
    const { delta } = JSON.parse(payload);
    onChunk(delta);
  }
}
```

---

## Coding Rules

| Rule | Detail |
|---|---|
| No `any` | Use `unknown` and narrow — `strict: true` enforced |
| Named exports only | No anonymous default component exports |
| Services are functions | `async function recommendProducts()` — never hooks |
| Immutable state | Always return new array/object references — never mutate in place |
| `key` props | Stable unique IDs on all `.map()` — never array index for reorderable lists |
| Async event handlers | `void handler()` pattern — never fire-and-forget without `void` or `await` |
| No secrets in frontend | Only `VITE_API_URL` — no Azure keys, no JWT secrets |

---

## Pages Quick Reference

| Page | Route | Purpose |
|---|---|---|
| `LoginPage` | `/login` | JWT login form |
| `ProductsPage` | `/` | Browse all products |
| `ProductDetailPage` | `/products/:id` | Single product + add to cart |
| `RecommendPage` | `/recommend` | AI semantic search input + results |
| `CartPage` | `/cart` | Cart review |
| `AdminPage` | `/admin` | Admin CRUD + bulk AI re-index |

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes (prod) | Backend base URL — falls back to `http://localhost:8000` in dev |

No other env vars — Azure credentials live exclusively on the backend.

---

## Do Not

- Store JWT in `localStorage` — use `sessionStorage` via `AuthContext` only
- Use `any` — narrow with `unknown` or proper types
- Read `sessionStorage` outside `AuthContext`
- Construct API URLs from raw user input
- Put service logic inside hooks or components
- Use array index as `key` on filterable/sortable lists
- Add Azure keys or connection strings anywhere in this package
- Use anonymous default exports for components
