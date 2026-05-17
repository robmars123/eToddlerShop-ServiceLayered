# Claude Architecture Contract (Python / FastAPI / Clean Architecture)

## Purpose
This document defines the architectural rules, constraints, and behaviors that Claude Code must follow when generating or modifying code in this project.

---

## 1. Architectural Style
- Clean Architecture
- Modular Monolith
- Domain-Driven Design (DDD-lite)
- Event-driven internal communication
- REST at ingress
- gRPC optional for internal service-to-service calls

---

## 2. Module Boundaries
Each module MUST contain:
- domain/
- application/
- infrastructure/
- api/

Modules MUST NOT:
- Import another module’s internal folders
- Share domain models
- Share SQLAlchemy models
- Create circular dependencies

Modules MAY communicate via:
- Public interfaces (Python protocols or abstract base classes)
- Domain events
- Application service contracts

---

## 3. Layer Rules

### Domain Layer
- Pure business logic
- No external dependencies
- Entities, Value Objects, Domain Events
- No SQLAlchemy models
- No FastAPI imports

### Application Layer
- Use cases (services)
- DTOs (Pydantic models)
- Interfaces for repositories
- Orchestrates domain logic
- No SQLAlchemy imports
- No FastAPI imports

### Infrastructure Layer
- SQLAlchemy models
- Repositories
- External integrations
- gRPC clients
- Email/SMS/Payment providers
- Alembic migrations

### API Layer
- FastAPI routers
- Request/Response models
- Validation
- No business logic
- No SQLAlchemy imports

---

## 4. Dependency Direction (Clean Architecture Rule)
**All dependencies MUST point inward.**

### Allowed dependency flow:
api → application → domain
infrastructure → application → domain


### Rules:
- Outer layers may depend on inner layers.
- Inner layers MUST NOT depend on outer layers.
- Domain layer has ZERO dependencies on Application, Infrastructure, or API.
- Application layer depends ONLY on Domain.
- Infrastructure depends on Application (via interfaces) but NEVER the reverse.
- API depends on Application but NEVER the reverse.

Claude MUST reject or refactor any code that violates inward dependency flow.

---

## 5. Coding Standards
- Python 3.12+
- FastAPI for API layer
- SQLAlchemy 2.0 ORM
- Alembic for migrations
- Pydantic v2 for DTOs
- Async everywhere (`async def`)
- Dependency Injection via FastAPI Depends or custom providers
- No business logic in routers
- No fat services
- No static utility modules for domain logic

---

## 6. Default Behaviors for Claude Code
Claude MUST:
- Think before coding
- Propose architecture changes before generating code
- Validate boundaries before writing files
- Generate minimal, consistent multi-file changes
- Follow folder structure strictly
- Use interfaces (Protocols/ABCs) for cross-module communication
- Add unit tests for Application layer use cases (pytest)

---

## 7. Forbidden
- Direct module-to-module imports
- Business logic in routers
- SQLAlchemy models outside infrastructure
- Pydantic models inside domain
- Circular dependencies
- Shared mutable state
- Repositories inside Application layer
- Using FastAPI dependencies inside domain or application

---

## 8. Communication Patterns
- REST for external/public APIs
- gRPC optional for internal high-performance calls
- Domain events for cross-module workflows
- Message bus optional (future microservices evolution)

---

## 9. Workflow Claude Must Follow
1. Analyze requirement  
2. Propose architecture changes  
3. Plan file modifications  
4. Generate code  
5. Review for violations  

---

## 10. Folder Structure

- Always check current folder structure and examine since it always changes

---

## 11. Output Rules
- Group multi-file changes
- No partial implementations
- No breaking architecture boundaries
- Explain reasoning when needed
