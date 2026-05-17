Project Summary

  This is a full-stack e-commerce/product management application with a Python backend and TypeScript React frontend.

  ---
  Backend — FastAPI (Python)

  - Architecture: Modular monolith following Clean Architecture (vertical slice per domain)
  - Stack: Python 3.14, FastAPI, SQLAlchemy 2 (async), asyncpg, PostgreSQL, Pydantic v2, Alembic
  - Auth: JWT Bearer Token authentication
  - Base API path: /api/v1

  Three business domains, each with its own domain / application / infrastructure / api layers:

  ┌──────────┬───────────────────────────────────────────────────┐
  │  Domain  │                   Key Endpoints                   │
  ├──────────┼───────────────────────────────────────────────────┤
  │ Products │ CRUD — list, create, update, delete               │
  ├──────────┼───────────────────────────────────────────────────┤
  │ Users    │ CRUD — list, create, update, delete               │
  ├──────────┼───────────────────────────────────────────────────┤
  │ Orders   │ List, create, update status, list by user, delete │
  └──────────┴───────────────────────────────────────────────────┘

  A shared_kernel provides base classes (Entity, ValueObject, DomainEvent) and common exceptions (NotFoundError, ConflictError, etc.) shared across all modules. Domain and application layers have zero framework dependencies.

  ---
  Frontend — React (TypeScript)

  - Stack: Vite + React + TypeScript
  - Pages: ProductsPage, ProductDetailPage, CartPage, AdminPage, LoginPage
  - Features: Auth context with role-based access (admin / user), protected routes, shopping cart (Zustand store), product service layer
  - Components: Navbar, ProductCard, ProtectedRoute

  ---
  Key Design Decisions

  - Dependency flow: Router → UseCases → Repository Interface → SQLAlchemy Implementation — framework details never leak into domain logic
  - Image storage: Dedicated image_storage.py in infrastructure (recently added)
  - uv for Python dependency/environment management
  - Alembic for database migrations