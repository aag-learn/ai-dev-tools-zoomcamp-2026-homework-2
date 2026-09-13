---
issue: 3
label: needs-triage
---

# Scaffold frontend project

Set up `frontend/` — Vite + Vue 3 + TypeScript, `openapi-typescript` codegen from the contract, an `openapi-fetch` typed client, MSW wired up for dev/test, and a minimal router/app shell with empty routes for People, Expenses, and Balances. Split out from the feature UIs because every one of them needs this tooling in place first, and it's pure setup with no feature logic of its own.

Dependencies: #1 (contract to generate types from), #2 (base app shell touches UI).
