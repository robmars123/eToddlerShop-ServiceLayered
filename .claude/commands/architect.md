Spawn a general-purpose subagent to perform an architectural review of the codebase. The subagent must:

1. Read the architecture contracts first:
   - `D:\Projects\2026\Service Layer + Router\Python\App\AGENTS.md`
   - `D:\Projects\2026\Service Layer + Router\Python\App\backend\AGENTS.md`
   - `D:\Projects\2026\Service Layer + Router\Python\App\client\AGENTS.md`

2. Gather current state:
   - Run `git diff --stat HEAD` and `git status --short` to see all uncommitted files and what has changed
   - Read top-level folder structure: `backend/app/` and `client/src/`
   - Read all service interfaces (public method signatures) in `backend/app/services/`
   - Read all router files in `backend/app/routers/` for the API surface
   - Read `backend/app/database.py` for the Settings and engine definitions
   - Read `backend/app/main.py` for lifespan, middleware, and router mounts
   - Read `client/src/App.tsx` for route definitions and top-level composition
   - Read `client/src/config.ts` and `client/src/types.ts` for shared contracts

3. Produce an architectural review report with these sections:

---

## System Boundary Diagram

Draw an ASCII diagram showing the major system boundaries and how they communicate:
- Client (React SPA) → Backend (FastAPI) → Database / Redis / Azure services
- Label each arrow with the protocol (REST, SSE, SDK call, etc.)
- Show where auth boundaries exist (JWT-required paths)

## Service Interface Map

List every service in `backend/app/services/` with:
- Its public methods (name + parameters + return type)
- What external systems it touches (DB, Redis, Azure OpenAI, Blob, Speech)
- What other services it depends on (if any)

## Uncommitted Changes — Architectural Impact

For each uncommitted file found in `git status`:
- What layer does it belong to? (router / service / model / schema / frontend feature / config)
- Does the change affect a service interface, a system boundary, or a shared contract (types.ts, database.py, schemas)?
- Is it consistent with the existing architecture patterns in AGENTS.md?
- Flag any change that introduces a new dependency, a new layer violation, or a new external integration

## Architectural Risks

Identify risks across these dimensions:
- **Boundary violations** — logic that has leaked into the wrong layer
- **Coupling** — services or components that are too tightly coupled or share too much state
- **Scalability** — patterns that will not hold under load (sync blocking in async, unbounded queries, missing indexes)
- **Maintainability** — duplication, inconsistent patterns, implicit contracts not captured in AGENTS.md
- **Security** — boundary gaps (unauthenticated endpoints, unvalidated inputs, secrets at risk)

Rate each risk: **High / Medium / Low** with a one-line justification.

## Suggested Refactors

For each significant risk above, propose a concrete refactor:
- What to change and where (file + approximate location)
- What pattern it should follow (reference AGENTS.md where applicable)
- Estimated effort: **Small** (< 1 hour) / **Medium** (half day) / **Large** (multi-day)
- Do NOT write the code — describe the change only

## New Services Assessment

If any uncommitted files introduce a new service or a new top-level folder:
- Does it follow the Router → Service → Model → Schema pattern?
- Does it have a clear single responsibility?
- Does it correctly use the shared Redis client and Settings from `database.py`?
- What is missing before it is production-ready?

## Summary

Three sections, each 3–5 bullet points:
- **What is solid** — architectural strengths to preserve
- **What needs attention** — risks that should be addressed before the next feature
- **What to do next** — ordered list of recommended structural actions
