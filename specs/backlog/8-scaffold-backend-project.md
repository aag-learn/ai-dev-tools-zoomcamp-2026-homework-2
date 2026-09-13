---
issue: 8
label: needs-triage
---

# Scaffold backend project

Set up `backend/` — uv-managed FastAPI app skeleton, `DATABASE_URL`-driven SQLAlchemy engine/session config (SQLite default), and Alembic initialized for batch-mode migrations. Split out from the model/endpoint work because it's pure project setup that every other phase-3 issue needs first.

Dependencies: #1.
