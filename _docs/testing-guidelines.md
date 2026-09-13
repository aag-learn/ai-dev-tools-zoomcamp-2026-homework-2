# Testing guidelines

This file didn't exist before the expense splitter architecture was
defined (see `_docs/architecture.md`) — it's written fresh, not updated
from a prior version.

Read this before writing any test. The project follows a test-first
approach as much as possible: write the failing test (or, for a new
endpoint, extend the contract) before writing the implementation that
makes it pass.

## What "test-first" means per layer

| Layer | What comes first |
|---|---|
| New API endpoint | Add it to `openapi/openapi.yaml` before writing the FastAPI route. |
| Backend logic | Write the failing pytest case against the spec's acceptance criteria, then implement. |
| Frontend component/composable | Write the failing Vitest/Vue Testing Library test (network mocked via MSW) before building the component. |
| End-to-end flow | Exception — see below. |

The one deliberate exception is `e2e/` (Playwright): it needs a real
backend and a built frontend to run at all, so it can't be strictly
test-first. Write the acceptance-criteria-derived test cases as soon as
the spec is groomed — even as skipped/pending tests naming the scenario —
so what's left to cover is visible, then fill them in once both sides
exist.

## Backend (`backend/tests/`, pytest)

- Run: `cd backend && uv run pytest`. One file: `cd backend && uv run pytest tests/test_expenses.py`.
- Each acceptance criterion in a groomed spec should map to at least one
  test — this is what qa-engineer checks against when verifying an
  implementation.
- Use FastAPI's `TestClient` (or `httpx.AsyncClient` for async routes)
  against the app directly — no real HTTP server needed.
- Each test gets an isolated database: a fresh SQLite database per test
  (or per-test transaction rollback), never a shared file that
  accumulates state across the suite.
- **Contract-compliance tests** live in `backend/tests/contract/` and use
  Schemathesis to verify the running app conforms to
  `openapi/openapi.yaml` — status codes, schemas, required fields. These
  are the one test category not written by hand per-endpoint: they're
  generated from the contract itself, which is why the contract must be
  updated before the route.
- Migrations: any change to a SQLAlchemy model needs an Alembic migration
  in the same change, written in batch mode (SQLite compatibility — see
  `_docs/architecture.md`). A model change with no migration is incomplete.

## Frontend (`frontend/`, Vitest + Vue Testing Library)

- Run: `cd frontend && npm test`.
- Unit tests are co-located with the code they test:
  `Component.vue` / `Component.test.ts`.
- `frontend/tests/` holds tests that span more than one component (e.g. a
  full form flow) rather than a single unit.
- Mock the network with MSW, using handlers written against the types
  generated from `openapi/openapi.yaml` (`openapi-typescript`) — never
  hand-roll a mock response shape that could drift from the contract.
- Test user-visible behavior (what's rendered, what a user can click and
  see happen), not implementation details like internal state or private
  methods.

## End-to-end (`e2e/`, Playwright)

- Run: `cd e2e && npx playwright test`.
- Runs against a real FastAPI backend on SQLite and the built frontend —
  no mocking.
- Reserved for flows that genuinely cross the frontend/backend boundary
  (e.g. "create an expense and see the updated balance") — not a
  duplicate of coverage already proven by backend or frontend unit tests.

## General rules

- A groomed spec's acceptance criteria (per `specs/TASK-TEMPLATE.md`) must
  each be checkable by a specific test, not by judgment. If an acceptance
  criterion can't be turned into a test, that's a sign the spec needs a
  more concrete criterion, not that the test should be skipped.
- qa-engineer re-derives acceptance criteria from the spec independently
  and treats a missing test for a criterion as FAIL, not PASS-by-default —
  so don't leave a criterion uncovered and assume it'll be waved through.
- Don't add tests for behavior the spec doesn't describe. If you notice
  something worth testing that's out of scope, say so rather than quietly
  expanding the spec's surface via tests.
