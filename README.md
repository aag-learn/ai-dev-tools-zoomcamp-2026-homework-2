# Tally

## Running locally

Global tools (`python`, `uv`, `node`) are pinned in `.config/mise/config.toml` and managed with [mise](https://mise.jdx.dev/) — install them once with:

```
mise install
```

**Backend** (FastAPI, in `backend/`) — uses SQLite by default, so there's no database to set up:

```
cd backend
uv sync
uv run fastapi dev src/app/main.py
```

The API is served at http://localhost:8000, with interactive docs at http://localhost:8000/docs.

**Frontend** (Vue, in `frontend/`):

```
cd frontend
npm install
npm run dev
```

The app is served at http://localhost:5173. It currently talks to a mocked API (via MSW) rather than the backend above — the two aren't wired together yet.
