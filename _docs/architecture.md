# Architecture

Expense splitter: a FastAPI backend and a Vue frontend, connected by a
hand-written OpenAPI contract. This document describes the shape of the
system before any of it is built — the planner/pm/software-engineer/
qa-engineer pipeline in `_docs/process.md` builds toward this.

## Guiding decisions

- **Backend:** FastAPI (Python), database-agnostic — SQLite for local
  development, PostgreSQL in production, same code either way.
- **Frontend:** Vue 3 + TypeScript (`<script setup>`), built with Vite.
- **Contract-first:** the OpenAPI contract is written by hand, before
  backend routes or frontend screens exist. Both sides are built to match
  it, not the other way around.
- **Test-first:** see `_docs/testing-guidelines.md`. The contract itself is
  part of that — a new endpoint is added to the contract before it's
  implemented on either side.

## System overview

```mermaid
flowchart LR
    subgraph Contract
        C[openapi/openapi.yaml]
    end

    subgraph Frontend [frontend/ - Vue 3 + TypeScript]
        UI[Vue app]
        Types[Generated types\nopenapi-typescript]
        Client[Typed fetch client\nopenapi-fetch]
        MSW[MSW handlers\nderived from contract]
    end

    subgraph Backend [backend/ - FastAPI]
        Routes[Routers]
        Schemas[Pydantic schemas]
        Models[SQLAlchemy models]
        DB[(SQLite dev /\nPostgres prod)]
    end

    C -->|generates| Types --> Client --> UI
    C -->|derives| MSW -->|dev + tests| UI
    C -->|compliance tests\n(Schemathesis)| Routes
    Routes --> Schemas --> Models --> DB
    UI -->|HTTP, real backend| Routes
```

## Repository layout

```
backend/            FastAPI app, managed with uv
  pyproject.toml
  src/app/
    main.py
    api/            routers
    schemas/        Pydantic request/response models
    models/         SQLAlchemy models
    db/             engine, session, base
    core/           settings/config
  alembic/          migrations
  tests/            pytest (unit + integration + contract compliance)

frontend/           Vue app, managed with npm
  package.json
  src/
  tests/            cross-component/integration tests (Vitest)
                     — unit tests are co-located as Component.test.ts

openapi/
  openapi.yaml      the contract — single source of truth for both sides

e2e/                Playwright, exercises real backend + built frontend
  playwright.config.ts
  tests/

_docs/
  architecture.md        this file
  process.md
  testing-guidelines.md
  design-system.md       tokens, components, responsive behavior
```

Backend and frontend are independent projects (own dependency manager, own
test runner) under one repo. Do not add a dependency to either without
asking first, per `AGENTS.md`.

## Backend

- **Framework:** FastAPI. Routers are thin — request/response validation
  via Pydantic schemas, business logic in a service layer, persistence via
  SQLAlchemy models. This split is what makes swapping the database engine
  a config change rather than a rewrite.
- **Database access:** SQLAlchemy Core/ORM as the abstraction layer.
  Nothing in application code should depend on a SQLite- or
  Postgres-specific feature. The engine is created from a single
  `DATABASE_URL` environment variable:
  - Local dev default: `sqlite:///./dev.db` (a file — no server, no
    compose service needed for it).
  - Production: a Postgres URL, provided by whatever compose/deployment
    config runs it — per `AGENTS.md`, development databases run via
    compose files, not native installs.
- **Migrations:** Alembic, from day one, even against SQLite. SQLite has
  weaker `ALTER TABLE` support than Postgres, so migrations must be written
  in Alembic's "batch mode" — this is checked in review, not just assumed.
- **Compliance with the contract:** the backend does not hand-author its
  own OpenAPI spec. `openapi/openapi.yaml` is authoritative; a contract
  test (Schemathesis, run in `backend/tests/`) checks the running FastAPI
  app conforms to it — same status codes, same schemas, same required
  fields. A route that diverges from the contract is a bug, not a contract
  update, unless the contract is deliberately changed first.

## Frontend

- **Framework/tooling:** Vue 3 (`<script setup lang="ts">`), built with
  Vite.
- **Types from the contract:** `openapi-typescript` generates TypeScript
  types from `openapi/openapi.yaml`. The frontend never hand-declares
  types for API request/response shapes — they're generated, so a contract
  change that breaks the frontend is a compile error, not a runtime
  surprise.
- **API client:** `openapi-fetch` (or equivalent typed-fetch wrapper) built
  on the generated types, so calling the API is type-checked against the
  contract end to end.
- **Mocking:** MSW (Mock Service Worker) intercepts network calls in both
  dev mode and tests. Handlers are written against the same generated
  types, so the mock backend and the real one can't silently drift apart
  in shape (they can still drift in *behavior*, which the e2e suite is for).
  This is what lets frontend work start before the backend has a single
  working route.

## Database strategy

| | Development | Production |
|---|---|---|
| Engine | SQLite | PostgreSQL |
| Connection | `sqlite:///./dev.db` | `DATABASE_URL` from compose/deploy env |
| Migrations | Alembic (batch mode) | Alembic |
| Setup | none — it's a file | via compose, per `AGENTS.md` |

The switch to Postgres before production is a config change (`DATABASE_URL`)
plus running the same Alembic migrations against it — not a rewrite. If a
feature ever needs a Postgres-only capability, that's a flag to raise
explicitly, since it breaks the database-agnostic guarantee.

## Testing

Covered in full in `_docs/testing-guidelines.md`. Summary of where each
kind of test lives, since it follows directly from the layout above:

- `backend/tests/` — pytest: unit, integration, and contract-compliance
  (Schemathesis against `openapi/openapi.yaml`).
- `frontend/` — Vitest + Vue Testing Library: unit tests co-located next
  to the component/composable they cover; `frontend/tests/` for tests
  spanning several components. Network is mocked with MSW — no real
  backend needed.
- `e2e/` — Playwright: the real FastAPI backend (SQLite) and the built
  frontend, exercised together. This is the one layer that can't be
  test-first in the strict sense, since it needs both sides to exist.

## Why Vue over React

Vue was chosen over React specifically because of existing team
familiarity with it — every other decision in this document (contract-first
OpenAPI, `openapi-typescript`/`openapi-fetch`, MSW, Vite, TypeScript) is
framework-agnostic and works identically either way, so this was a low-cost
swap made before any frontend code existed.

## Open questions / deliberately deferred

Not decided yet — raise these before they become blocking:

- Authentication and multi-user/session model (single-user tool vs. real
  accounts) — affects the data model directly, needs deciding before the
  first `groomed` spec touches users or auth.
- Deployment target for the FastAPI/Postgres/Vue stack in production.
- CI wiring (which of the four test layers run on every push vs. on
  demand).
