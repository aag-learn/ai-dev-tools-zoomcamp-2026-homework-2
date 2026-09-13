## Commands

Backend (FastAPI, in `backend/`):
- `cd backend && uv sync` - install dependencies
- `cd backend && uv run pytest` - the whole suite
- `cd backend && uv run pytest tests/test_home.py` - one test file

Frontend (Vue, in `frontend/`):
- `cd frontend && npm install` - install dependencies
- `cd frontend && npm test` - the whole suite

End-to-end (Playwright, in `e2e/`):
- `cd e2e && npx playwright test` - the whole suite

## Rules

- Backend dependencies are added in `backend/pyproject.toml` using the
  `uv` command. Frontend dependencies are added in `frontend/package.json`
  using `npm`. Do not add one without asking.
- Databases for development (e.g. Postgres, Redis) are configured using
  compose files, not native/local installs.
- Global/system-level tool dependencies (e.g. `python`, `uv`) are managed
  with `mise`, pinned in `.config/mise/config.toml` — not installed
  natively/locally. Do not add one without asking. SQLite is the exception - it's
  a file, not a server, so no compose service is needed for it.

## Documents

- `_docs/process.md` - how work is organized
- `_docs/architecture.md` - system architecture: backend, frontend, the
  OpenAPI contract between them, and the database strategy
- Before writing tests, read `_docs/testing-guidelines.md`
- For anything touching the UI, read `_docs/design-system.md`
