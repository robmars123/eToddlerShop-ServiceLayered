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
│       ├── ChatWidget.tsx        # Floating chatbot UI
│       ├── useChatbot.ts         # Chat state hook
│       └── chatService.ts        # API calls to /ai/chat + /ai/speech-token
│
├── services/                     # API client functions (fetch wrappers)
│   ├── aiService.ts              # recommend, embed
│   ├── ordersService.ts          # fetchMyOrders, createOrder, cancelOrder, fetchOrderAnalytics
│   ├── productsService.ts        # fetchProducts, fetchProduct, createProduct, updateProduct,
│   │                             # deleteProduct, uploadProductImage
│   └── speechService.ts          # Azure Speech SDK helpers
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

## Linting

```powershell
npm run lint
```
