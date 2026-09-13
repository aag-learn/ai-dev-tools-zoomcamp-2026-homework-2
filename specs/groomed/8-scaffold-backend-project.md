---
issue: 8
label: groomed
---

# Scaffold backend project

## Summary

Scaffold `backend/` as a uv-managed FastAPI project: an app skeleton with
no routes yet, a `DATABASE_URL`-driven SQLAlchemy engine/session (SQLite
default), and Alembic initialized in batch mode. This is pure project
setup — no `Person`/`Expense` models, no routers, no Pydantic schemas, and
no contract-compliance tests are part of this issue. Issues #9–#14 build
on top of it.

## Scope

1. `backend/pyproject.toml`, a uv-managed Python project (`[project].name`
   e.g. `tally-backend`, per `AGENTS.md`'s "tally" base-name rule),
   declaring:
   - `fastapi[standard]` as a dependency (the `standard` extra bundles
     `uvicorn`, `fastapi-cli` — which provides the `fastapi dev` command —
     and `httpx`, needed by FastAPI's `TestClient`).
   - `sqlalchemy`, `alembic`, and `pydantic-settings` as dependencies.
   - `pytest` as a dev-dependency.
   - No other dependency without separate sign-off, per `AGENTS.md`. This
     list is this spec's sign-off for these specific packages (see
     "Constraints").
2. A src-layout package at `backend/src/app/`, matching
   `_docs/architecture.md`'s repository layout exactly:
   - `main.py` — creates the FastAPI app instance (e.g.
     `app = FastAPI(title="Tally API")`). No routers are registered yet.
   - `api/`, `schemas/`, `models/` — empty packages (just `__init__.py`
     each), committed as placeholders for #9–#13 to fill in.
   - `core/config.py` — a `pydantic-settings` `Settings` class with a
     `database_url: str` field read from the `DATABASE_URL` environment
     variable, defaulting to `sqlite:///./dev.db` when unset.
   - `db/base.py` — a SQLAlchemy declarative `Base` for models to inherit
     from (used by `models/` in #9–#10, and by Alembic's `env.py`).
   - `db/session.py` — a SQLAlchemy `engine` created from
     `Settings().database_url`, a `SessionLocal` sessionmaker bound to it,
     and a `get_db()` generator (FastAPI dependency) that yields a session
     and closes it afterward. `connect_args={"check_same_thread": False}`
     is passed only when the URL scheme is `sqlite`, so a future Postgres
     `DATABASE_URL` needs no code change.
3. Alembic initialized at `backend/alembic.ini` and
   `backend/alembic/{env.py, script.py.mako, versions/}` (the standard
   `alembic init` scaffold), with `env.py` customized to:
   - Set `target_metadata` to `Base.metadata` from `app.db.base`.
   - Resolve the database URL from the same `Settings`/`DATABASE_URL`
     source the app uses, not a value hardcoded in `alembic.ini`.
   - Pass `render_as_batch=True` to `context.configure(...)` in both the
     offline and online migration functions, so every future migration
     (starting with #9's `Person` migration) runs in batch mode without
     needing to remember to add this per migration.
   - `alembic/versions/` stays empty — no migration files are part of this
     issue, since there are no models yet.
4. A test suite establishing the per-test isolated-database pattern that
   `_docs/testing-guidelines.md` requires future backend tests to follow:
   - `backend/tests/conftest.py` — a pytest fixture that creates a fresh
     SQLite database per test (e.g. a temp-file or in-memory URL with
     `StaticPool`), runs `Base.metadata.create_all` against it, overrides
     the app's `get_db` dependency to yield a session bound to that
     database, and tears the database down after the test. A `client`
     fixture exposes a `TestClient(app)` wired to that override.
   - `backend/tests/test_main.py` — uses the `client` fixture and asserts
     `GET /openapi.json` returns `200`.
   - `backend/tests/test_config.py` — asserts `Settings().database_url`
     defaults to `sqlite:///./dev.db` when `DATABASE_URL` is unset, and
     reflects an overriding value when `DATABASE_URL` is set (via
     `monkeypatch`).
5. `backend/.gitignore` excludes `dev.db`, `.venv/`, `__pycache__/`, and
   `*.pyc`.
6. `AGENTS.md`'s Backend commands list gets a new bullet naming the dev
   server command: `cd backend && uv run fastapi dev src/app/main.py`,
   alongside the existing `uv sync` / `uv run pytest` entries.

## Out of scope

- The `Person` and `Expense` SQLAlchemy models and their Alembic
  migrations — issues #9 and #10.
- Any API router, Pydantic request/response schema, or actual endpoint
  logic — issues #11, #12, #13.
- Contract-compliance (Schemathesis) tests in `backend/tests/contract/` —
  issue #14; that directory isn't created by this issue.
- CORS configuration or any other change needed for the Vue frontend to
  call this backend over HTTP — issue #15 (wire frontend to real backend).
- Authentication/session middleware — v1 has no auth, per
  `specs/features/expense-splitter-poc.md`.
- Production Postgres/deployment configuration — deployment target is an
  explicit open question in `_docs/architecture.md`, not decided yet.
- CI wiring for running `uv run pytest` on push — flagged as an open,
  undecided question in `_docs/architecture.md`, not part of this issue.

## Acceptance criteria

1. `backend/pyproject.toml` exists, declaring `fastapi[standard]`,
   `sqlalchemy`, `alembic`, and `pydantic-settings` as dependencies, and
   `pytest` as a dev-dependency. No other dependency is added without
   separate sign-off, per `AGENTS.md`.
2. `cd backend && uv sync` completes with exit code 0 and produces
   `backend/uv.lock`.
3. `cd backend && uv run fastapi dev src/app/main.py` starts a local dev
   server; while it is running, `curl -s -o /dev/null -w '%{http_code}'
   http://127.0.0.1:8000/openapi.json` returns `200`.
4. `backend/src/app/main.py` defines a FastAPI app instance; no routers
   are registered on it. `GET /openapi.json` and `GET /docs` on the
   running app both return `200`.
5. The directory layout matches `_docs/architecture.md`'s repository
   layout exactly: `backend/src/app/{main.py, api/, schemas/, models/,
   db/, core/}` all exist; `api/`, `schemas/`, and `models/` each contain
   only an `__init__.py`; `db/` contains `base.py` and `session.py`;
   `core/` contains `config.py`.
6. `backend/src/app/core/config.py`'s `Settings` class has a
   `database_url` field that equals `"sqlite:///./dev.db"` when the
   `DATABASE_URL` environment variable is unset, and equals the env var's
   value when it is set.
7. `backend/src/app/db/session.py`'s `engine` is constructed from
   `Settings().database_url`; inspecting the `create_engine(...)` call
   shows `connect_args={"check_same_thread": False}` applied only when the
   URL scheme is `sqlite`.
8. `backend/alembic.ini` and `backend/alembic/{env.py, script.py.mako,
   versions/}` exist; `backend/alembic/versions/` contains no migration
   files.
9. `backend/alembic/env.py` sets `target_metadata` from `app.db.base`'s
   `Base.metadata`, resolves the database URL from the same
   `Settings`/`DATABASE_URL` source as the app (not a static value in
   `alembic.ini`), and calls `context.configure(...)` with
   `render_as_batch=True` in both the offline and online migration
   functions — checkable via `grep -c render_as_batch
   backend/alembic/env.py` returning `2`.
10. `cd backend && uv run alembic upgrade head` exits `0` when run against
    a fresh `DATABASE_URL` (with zero revisions in `versions/`, this
    validates the Alembic wiring itself, not any migration content).
11. `backend/tests/conftest.py` provides a fixture that creates a fresh
    SQLite database per test, creates all tables via
    `Base.metadata.create_all`, overrides `get_db` with a session bound to
    that database, and tears it down afterward.
12. `backend/tests/test_main.py` asserts `GET /openapi.json` returns `200`
    via the fixture from criterion 11.
13. `backend/tests/test_config.py` asserts both the default and
    environment-overridden values of `Settings().database_url` described
    in criterion 6.
14. `cd backend && uv run pytest` runs the full suite and every test
    passes, including the tests from criteria 12 and 13.
15. `backend/.gitignore` excludes `dev.db`, `.venv/`, `__pycache__/`, and
    `*.pyc`.
16. `AGENTS.md`'s Backend commands section includes the dev-server command
    from criterion 3, in addition to the existing `uv sync` / `uv run
    pytest` entries.

## Edge cases considered

- **SQLite `check_same_thread`**: FastAPI's dev server and `TestClient`
  can access the same SQLite connection from more than one thread;
  without `check_same_thread=False`, SQLite raises. This must not be
  applied for non-SQLite URLs, so a future Postgres `DATABASE_URL` doesn't
  carry over a SQLite-only kwarg.
- **`alembic upgrade head` with zero revisions**: must still exit `0`
  cleanly — this is the criterion 10 check, proving the URL-resolution and
  batch-mode wiring in `env.py` load without error *before* the first real
  migration (#9) is written, rather than discovering a config mistake at
  that point.
- **Batch mode applies globally, not per-migration**: `render_as_batch`
  is set once in `env.py` (both offline and online paths) precisely so
  #9's and #10's migrations don't each need to remember to add it —
  SQLite's weak `ALTER TABLE` support is a project-wide constraint, not a
  per-migration opt-in.
- **Empty `api/`/`schemas`/`models/` packages**: each needs a committed
  `__init__.py` so the layout exists in version control and is importable
  ahead of #9–#13 populating them; an empty directory alone wouldn't be
  tracked by git.
- **`dev.db` never committed, never shared by tests**: `backend/.gitignore`
  excludes it, and the test suite (criterion 11) never touches it — each
  test gets its own throwaway database, per `_docs/testing-guidelines.md`.
- **`fastapi dev`'s auto-reload behavior**: not separately tested; only
  that the server boots and serves one request (criterion 3) is checked.
  Verifying file-watching/reload behavior would be flaky and isn't
  meaningfully different from trusting `fastapi-cli`'s own test suite.

## Constraints

- Package manager is `uv`, not `pip`/`poetry`/`conda`, per
  `_docs/architecture.md` and `AGENTS.md`.
- Src-layout package (`backend/src/app/`), not a flat `backend/app/`
  layout, per `_docs/architecture.md`'s repository layout.
- No dependency beyond the list in acceptance criterion 1 is added to
  `backend/pyproject.toml` without asking first, per `AGENTS.md`. Unlike
  the frontend scaffold (#3), where every tool was already named in
  `_docs/architecture.md`, `pydantic-settings` and the `fastapi[standard]`
  extras group are not literally named there — this spec is the explicit
  sign-off for those two specifically, since they're the only way to
  satisfy the `DATABASE_URL`-driven config and dev-server requirements
  below without hand-rolling either.
- The database URL is defined in exactly one place
  (`app.core.config.Settings.database_url`); `alembic/env.py` reads from
  that same source rather than duplicating a URL in `alembic.ini`.
- Batch-mode Alembic configuration is set globally in `env.py`, since
  SQLite is the local dev default per `_docs/architecture.md`.

## Open questions

- **Dev-server command choice**: confirmed. A human reviewed this
  question (previously open) and confirmed the stated default:
  `fastapi dev src/app/main.py`, via `fastapi[standard]`'s bundled
  `fastapi-cli`, over invoking bare `uvicorn` directly.
- **`pydantic-settings` for config**: confirmed. A human reviewed this
  question (previously open) and confirmed the stated default:
  `pydantic-settings`, over a plain `os.environ.get(...)`.
- **Sequencing dependency on issue #1**: resolved by events — issue #1
  has since merged. This issue's criteria never technically depended on
  the contract's content anyway (pure scaffolding), so this changes
  nothing about the work, but the question is no longer live either way.
- **`pyproject.toml` project name**: confirmed. A human reviewed this
  question (previously open) and confirmed the stated default:
  `tally-backend`, per `AGENTS.md`'s "tally" base-name convention.
- **Python version floor**: confirmed. A human reviewed this question
  (previously open) and confirmed the stated default: no explicit pin —
  whatever `.config/mise/config.toml`'s Python version resolves to at
  implementation time.

All five open questions above have been reviewed and confirmed (or
resolved by issue #1 merging) by a human before implementation starts.
