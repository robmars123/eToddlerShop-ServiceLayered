src/
  main.tsx        # React root, BrowserRouter
  App.tsx         # Routes + persistent ChatWidget
  config.ts       # API_URL only
  types.ts        # Shared TS interfaces

  features/       # Self-contained modules (Auth, Chatbot)
  components/     # Shared UI components
  pages/          # Route-level pages
  services/       # Plain fetch functions (no hooks)
