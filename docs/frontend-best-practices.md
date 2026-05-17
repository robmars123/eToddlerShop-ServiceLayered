# React Client

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Tech Stack & Environment](#2-tech-stack--environment)
3. [Project Structure & File Organization](#3-project-structure--file-organization)
4. [Component Conventions](#4-component-conventions)
5. [TypeScript Standards](#5-typescript-standards)
6. [State Management](#6-state-management)
7. [Data Fetching & API Integration](#7-data-fetching--api-integration)
8. [Styling Conventions](#8-styling-conventions)
9. [Routing](#9-routing)
10. [Testing Requirements](#10-testing-requirements)
11. [Performance Guidelines](#11-performance-guidelines)
12. [Accessibility Standards](#12-accessibility-standards)
13. [Error Handling](#13-error-handling)
14. [Security Practices](#14-security-practices)
15. [Git & Version Control](#15-git--version-control)
16. [Code Review & Quality Gates](#16-code-review--quality-gates)
17. [Communication & Collaboration](#17-communication--collaboration)
18. [Claude-Specific Operating Rules](#18-claude-specific-operating-rules)

---

## 1. Purpose & Scope

This contract defines the standards, conventions, and operating rules that govern all React client-side code produced, reviewed, or refactored with the assistance of Claude. It exists to ensure consistency, maintainability, and quality across the codebase.

**This contract applies to:**
- All new feature development
- Bug fixes and refactors touching existing components
- Code generated or suggested by Claude during pair programming sessions
- PR reviews where Claude is used as a review aid

**Claude must:**
- Follow every section of this contract without exception unless explicitly overridden in writing by the project lead.
- Flag any instruction that conflicts with this contract before proceeding.
- Prefer clarity and correctness over cleverness.

---

## 2. Tech Stack & Environment

| Layer | Tool / Library | Version Constraint |
|---|---|---|
| Framework | React | 18.x or later |
| Language | TypeScript | 5.x or later |
| Build Tool | Vite | Latest stable |
| Package Manager | pnpm | Latest stable |
| Node.js | Node | 20 LTS or later |
| Linting | ESLint + Prettier | Project config |
| Testing | Vitest + React Testing Library | Latest stable |
| E2E Testing | Playwright | Latest stable |

**Rules:**
- Do not introduce new dependencies without explicit approval from the project lead.
- When suggesting a library, always provide: the npm package name, weekly downloads, last publish date, and a one-sentence justification.
- Prefer stdlib/built-in solutions over third-party packages where the complexity tradeoff is reasonable.

---

## 3. Project Structure & File Organization

```
src/
├── assets/              # Static assets (images, fonts, icons)
├── components/          # Shared, reusable UI components
│   └── Button/
│       ├── Button.tsx
│       ├── Button.test.tsx
│       ├── Button.module.css
│       └── index.ts
├── features/            # Feature-scoped modules (self-contained)
│   └── Auth/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types.ts
│       └── index.ts
├── hooks/               # Global custom hooks
├── layouts/             # Page layout wrappers
├── pages/               # Route-level page components
├── services/            # API clients and data services
├── store/               # Global state (Zustand or Context)
├── types/               # Shared TypeScript type definitions
├── utils/               # Pure utility functions
├── App.tsx
└── main.tsx
```

**Rules:**
- Co-locate tests, styles, and stories with the component they belong to.
- Use barrel files (`index.ts`) for clean public APIs on each folder.
- Features should be self-contained. A feature folder should not import from another feature folder directly — route through shared `components/`, `hooks/`, or `services/` only.
- File names use **PascalCase** for components (`UserCard.tsx`) and **camelCase** for utilities and hooks (`useAuth.ts`, `formatDate.ts`).

---

## 4. Component Conventions

### 4.1 Component Structure

Every component file must follow this top-to-bottom structure:

```tsx
// 1. Imports (external → internal → styles)
// 2. Type definitions
// 3. Constants (if any)
// 4. Component function
// 5. Sub-components (if small and tightly coupled)
// 6. Default export
```

### 4.2 Functional Components Only

- **No class components.** All components must be function components.
- Use named exports for components; use a default export only at the bottom.

```tsx
// ✅ Correct
export function UserCard({ name, role }: UserCardProps) { ... }
export default UserCard;

// ❌ Incorrect
export default function({ name }) { ... }
```

### 4.3 Props

- Every component must have an explicitly typed `Props` interface.
- Props interfaces are named `[ComponentName]Props`.
- Destructure props in the function signature.
- Mark optional props with `?` and provide sensible defaults via destructuring default values.

```tsx
interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, alt, size = 'md' }: AvatarProps) { ... }
```

### 4.4 Component Purity

- Components should be as pure as possible — derived state should be computed inline or with `useMemo`, not stored in `useState`.
- Side effects belong exclusively in `useEffect` or custom hooks — never inline in the render body.

### 4.5 JSX Rules

- Use self-closing tags for elements with no children: `<Icon />`.
- Ternary expressions in JSX are allowed but must not be nested more than one level deep. Use a helper function or early return for complex conditionals.
- No inline anonymous functions in event handlers for performance-sensitive lists.

---

## 5. TypeScript Standards

### 5.1 Strictness

The `tsconfig.json` must have `"strict": true`. Claude must never suggest disabling strict mode or individual strict flags.

### 5.2 Typing Rules

- **No `any`.** Use `unknown` when the type is genuinely unknown, then narrow it.
- **No type assertions (`as`)** unless accompanied by an inline comment explaining why it is safe.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and aliases.
- Avoid `enum`; use `const` objects with `as const` and derive the type:

```ts
// ✅ Preferred
export const Role = { Admin: 'admin', User: 'user', Guest: 'guest' } as const;
export type Role = (typeof Role)[keyof typeof Role];

// ❌ Avoid
enum Role { Admin = 'admin' }
```

### 5.3 Return Types

- Always annotate the return type of non-trivial functions and all async functions.
- React component return types may be inferred unless the component is a HOC or utility wrapper.

### 5.4 Generics

- Use descriptive generic parameter names (`TData`, `TError`, `TItem`) rather than single letters where context is non-obvious.

---

## 6. State Management

### 6.1 State Hierarchy

Apply the right tool for the right scope:

| Scope | Tool |
|---|---|
| Component-local, ephemeral UI | `useState` / `useReducer` |
| Shared within a feature | React Context + `useReducer` |
| Global app-wide state | Zustand |
| Server/async state | TanStack Query |

### 6.2 Rules

- Do not reach for global state first. Start with local state and lift only when necessary.
- Context is not a caching solution. Do not store server data in Context; use TanStack Query for that.
- Zustand stores must be defined in `src/store/` and exported as custom hooks (e.g., `useAuthStore`).
- All state mutations must be explicit and traceable — no mutation of objects or arrays in place.

```ts
// ✅ Correct
setItems(prev => [...prev, newItem]);

// ❌ Incorrect
items.push(newItem);
setItems(items);
```

### 6.3 Derived State

Do not store values in state that can be computed from existing state or props. Use `useMemo` for expensive derivations.

---

## 7. Data Fetching & API Integration

### 7.1 TanStack Query

- All server state (fetching, caching, mutation) must go through **TanStack Query** (`useQuery`, `useMutation`).
- Do not use raw `useEffect` + `fetch` for data fetching.

### 7.2 API Services

- All API calls are encapsulated in service functions in `src/services/` or the feature's `services/` folder.
- Service functions are plain async functions — they are not hooks.
- Use `axios` (or a configured `fetch` wrapper) as the HTTP client. The base URL and auth headers are configured once in the client instance.

```ts
// src/services/api.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});
```

### 7.3 Environment Variables

- All environment variables must be prefixed with `VITE_`.
- Never hardcode API URLs, keys, or secrets in source code.
- Document every required environment variable in `.env.example`.

---

## 8. Styling Conventions

### 8.1 Approach

- **CSS Modules** are the default styling method (`Component.module.css`).
- Tailwind CSS may be used if the project has adopted it project-wide — do not mix approaches within the same codebase.
- No inline `style` props except for truly dynamic values (e.g., calculated widths, transform values from JS).

### 8.2 Design Tokens

- Colors, spacing, typography, and breakpoints must reference design tokens defined in the theme configuration — never use raw hex codes or magic numbers in component styles.

### 8.3 Naming

- CSS class names use **camelCase** in CSS Modules (`styles.cardHeader`).
- Use semantic class names that describe purpose, not appearance (`styles.errorMessage` not `styles.redText`).

### 8.4 Responsive Design

- Mobile-first. Base styles target small viewports; media queries expand upward.
- Use the project's defined breakpoints (`sm`, `md`, `lg`, `xl`) consistently.

---

## 9. Routing

- **React Router v6+** is the standard router.
- All routes are defined in a central `src/router.tsx` file using the `createBrowserRouter` API.
- Route-level components live in `src/pages/`. They are thin — business logic is in hooks and services.
- Use `React.lazy` + `Suspense` for route-level code splitting.
- Protected routes are wrapped in a dedicated `<ProtectedRoute>` component, not scattered with inline auth checks.

---

## 10. Testing Requirements

### 10.1 Coverage Targets

| Layer | Minimum Coverage |
|---|---|
| Utility functions | 100% |
| Custom hooks | 90% |
| UI Components | 80% |
| Page components | 70% |
| E2E (critical paths) | All defined happy paths |

### 10.2 Testing Rules

- Tests live in the same directory as the file under test, suffixed with `.test.tsx`.
- Use **React Testing Library** — test behavior, not implementation. No direct inspection of component state or refs.
- No `getByTestId` unless no semantic query (`getByRole`, `getByLabelText`, `getByText`) applies.
- Mock network requests using **MSW (Mock Service Worker)** — not `jest.mock` on fetch or axios.
- Snapshot tests are prohibited — they are brittle and add noise without meaningful assertions.

### 10.3 Test Structure

```ts
describe('ComponentName', () => {
  it('should [expected behavior] when [condition]', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

---

## 11. Performance Guidelines

- Use `React.memo` only when profiling demonstrates a measurable improvement — not preemptively.
- `useCallback` and `useMemo` are not free; apply them only when the wrapped value is passed to a memoized child or used as a dependency in another hook.
- List rendering with `.map()` must always include a stable, unique `key` prop. Never use array index as key for lists that can reorder or filter.
- Use `React.lazy` for all route-level components and any component heavier than 50 KB (gzipped).
- Avoid layout thrash: do not read and write DOM measurements in the same synchronous block.
- Images must be served in next-gen formats (WebP/AVIF) and include explicit `width` and `height` attributes to prevent CLS.

---

## 12. Accessibility Standards

- All interactive elements must be keyboard-navigable and focusable.
- Use semantic HTML elements first (`<button>`, `<nav>`, `<main>`, `<section>`). Do not use `<div onClick>` where a `<button>` applies.
- Every image must have a descriptive `alt` attribute. Decorative images use `alt=""`.
- Color alone must never be the sole means of conveying information (contrast, icons, or labels must accompany it).
- Modals must trap focus and restore focus to the trigger element on close.
- ARIA attributes are a last resort — prefer semantic HTML. When ARIA is required, use the correct roles and properties per the WAI-ARIA spec.
- Target WCAG 2.1 Level AA compliance for all UI components.

---

## 13. Error Handling

### 13.1 Async Errors

- All async operations must have explicit error handling. Never let a promise reject silently.
- TanStack Query mutations must define `onError` handlers that surface user-facing feedback.

### 13.2 Error Boundaries

- Wrap each major page section in a React `ErrorBoundary`.
- Provide a meaningful fallback UI — not a blank screen or raw error message.

### 13.3 User-Facing Errors

- Error messages must be human-readable. Never surface raw API error responses or stack traces to the user.
- Log full error details (with stack traces) to the observability service (e.g., Sentry) — not to `console.log` in production.

### 13.4 Console

- `console.log` is prohibited in production code. Use structured logging or remove before merging.
- ESLint `no-console` rule must be enforced at the `error` level.

---

## 14. Security Practices

- **Never store tokens in `localStorage`** for sensitive applications. Use `HttpOnly` cookies managed by the server.
- Always sanitize user-generated content before rendering. If rendering HTML is unavoidable, use a trusted sanitization library (e.g., `DOMPurify`).
- Do not construct API URLs from unsanitized user input.
- Avoid `dangerouslySetInnerHTML` entirely. If required, it must be reviewed and approved by the project lead and accompanied by a sanitization step.
- CSP (Content Security Policy) headers must be configured at the server/CDN level.
- Dependencies must be kept up to date. Run `pnpm audit` in CI and fail the build on high/critical vulnerabilities.

---

## 15. Git & Version Control

### 15.1 Branch Naming

```
feature/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/<short-description>
hotfix/<ticket-id>-short-description
```

### 15.2 Commit Messages

Follow the **Conventional Commits** specification:

```
<type>(scope): <short summary>

[optional body]
[optional footer]
```

| Type | Use Case |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, build |
| `perf` | Performance improvement |

### 15.3 Pull Requests

- PRs must be focused and atomic — one logical change per PR.
- Every PR must include a description of what changed, why, and how to test it.
- PRs must pass all CI checks (lint, type-check, test, build) before review.
- Self-merge is not permitted. Every PR requires at least one human reviewer approval.

---

## 16. Code Review & Quality Gates

### 16.1 CI Pipeline (must all pass before merge)

- [ ] `pnpm lint` — ESLint + Prettier check
- [ ] `pnpm typecheck` — TypeScript type check (no errors)
- [ ] `pnpm test` — Unit/integration tests pass with coverage thresholds met
- [ ] `pnpm build` — Production build succeeds
- [ ] `pnpm audit` — No high/critical dependency vulnerabilities

### 16.2 Review Checklist

When Claude reviews code, it must evaluate and comment on:

- Does this follow the component and TypeScript conventions in this contract?
- Is state at the correct scope?
- Are there any accessibility violations?
- Are there error handling gaps?
- Are there any security concerns?
- Is the test coverage adequate and meaningful?

---

## 17. Communication & Collaboration

- **Clarify before coding.** If a requirement is ambiguous, ask a clarifying question before writing a single line of code.
- **Explain, don't just generate.** When Claude produces a non-trivial solution, it must include a brief explanation of the approach and any key tradeoffs.
- **Flag risks proactively.** If an instruction would violate this contract, introduce a security issue, or produce technical debt, Claude must say so before proceeding — not after.
- **Offer alternatives.** When a requested approach has a clearly superior alternative, Claude should present both and explain the tradeoff, then implement whichever the developer chooses.
- **No silent assumptions.** If Claude makes an assumption to proceed, it must state the assumption explicitly.

---

## 18. Claude-Specific Operating Rules

These rules govern Claude's behavior throughout all coding sessions on this project.

| Rule | Description |
|---|---|
| **Contract-first** | Always read and apply this contract before generating code. If context is lost, re-apply the contract. |
| **No hallucinated APIs** | Never invent library APIs, hooks, or component props. If unsure, state uncertainty and suggest verification. |
| **Minimal diff** | Generate the smallest correct change needed. Do not refactor unrelated code unless explicitly asked. |
| **Preserve intent** | When refactoring, preserve the existing behavior exactly unless the goal is to change it. |
| **No placeholder code** | Never generate `// TODO`, `// implement later`, or stub bodies. Code must be complete and functional. |
| **No over-engineering** | Prefer the simplest correct solution. Introduce abstraction only when duplication or complexity justifies it. |
| **Respect existing patterns** | Match the style and patterns already in the codebase, even if you might prefer a different approach. |
| **Security by default** | Never generate code that introduces a known security vulnerability, even if instructed to "just make it work." |
| **Test alongside code** | When generating a new function, hook, or component, also generate its corresponding test file. |
| **Fail loudly** | If unable to implement something correctly within these constraints, say so explicitly instead of generating a partial or incorrect solution. |

---

## Amendments

This contract may be amended only by the project lead. All amendments must be:
- Documented with a version bump and effective date at the top of this document.
- Communicated to all team members before taking effect.
- Re-shared with Claude at the start of any session following an amendment.

---

*This contract is binding for the duration of the project and supersedes any default behavior or preferences of the AI assistant.*
