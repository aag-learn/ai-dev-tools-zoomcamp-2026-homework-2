---
issue: 15
label: groomed
---

# Wire frontend to real backend

## Summary

Point the frontend's typed API client at a real, locally-running FastAPI
backend instead of always intercepting traffic with MSW, and make the two
local dev servers (`cd backend && uv run fastapi dev src/app/main.py` and
`cd frontend && npm run dev`) actually able to talk to each other: a
configurable API base URL on the frontend, CORS enabled on the backend for
Vite's dev origin, and MSW's browser worker demoted from "always on in
dev" to an explicit opt-in. This is phase 4 per
`specs/features/expense-splitter-poc.md`'s build order — the step that
only makes sense once phase 3 (backend) closes.

**Note on dependencies:** #3 (frontend scaffold), #11/#12/#13 (people/
expense/balances endpoints), and #14 (contract-compliance tests) are all
groomed but not yet implemented in this repo. This spec describes the
target end state by reading those specs' content directly. It also
**revises one detail of #3's scope**: #3 says the MSW browser worker
starts "only in dev mode (e.g. gated on `import.meta.env.DEV`)" — this
spec changes that gate to also require an explicit opt-in flag (see Scope
item 2), since once a real backend exists, "dev mode" should default to
hitting it, not the mock. Whoever implements #3 or this issue, whichever
lands second should apply this final gating logic rather than #3's
original wording.

## Scope

1. **Configurable API base URL (frontend)** —
   `frontend/src/api/client.ts` constructs the `openapi-fetch` client with
   an explicit `baseUrl`, read from `import.meta.env.VITE_API_BASE_URL`,
   falling back to `http://127.0.0.1:8000` (the address `fastapi dev`
   binds to by default, per #8) when the env var is unset:
   ```ts
   createClient<paths>({
     baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
   });
   ```
   `frontend/.env.example` is added (committed), documenting
   `VITE_API_BASE_URL` and `VITE_USE_MOCKS` (item 2) each with a one-line
   comment and their default/expected values.
2. **MSW browser worker becomes opt-in (frontend)** — the dev entry point
   (wherever #3's `frontend/src/mocks/browser.ts` is invoked, e.g.
   `frontend/src/main.ts`) starts the MSW worker only when **both**
   `import.meta.env.DEV` is true **and** a new env var
   `import.meta.env.VITE_USE_MOCKS === "true"`. With no `VITE_USE_MOCKS`
   set, `npm run dev` does not call `worker.start()` and all `fetch` calls
   go straight to the network (i.e. to whatever `VITE_API_BASE_URL`
   points at). Setting `VITE_USE_MOCKS=true` restores the pre-#15 fully
   mocked dev experience, for frontend-only work with no backend running.
   `frontend/src/mocks/server.ts`'s Vitest wiring (start/reset/stop around
   the test suite, from #3) is untouched — tests always run against MSW,
   unconditionally, regardless of this flag.
3. **CORS on the backend** — `backend/src/app/core/config.py`'s `Settings`
   class (from #8) gains a `cors_origins: list[str]` field, defaulting to
   `["http://localhost:5173", "http://127.0.0.1:5173"]` (Vite's default
   dev port, both hostname forms since browsers treat them as distinct
   origins). `backend/src/app/main.py` registers FastAPI's
   `CORSMiddleware` (`fastapi.middleware.cors`, ships with FastAPI — no
   new dependency) configured with `allow_origins=Settings().cors_origins`,
   `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=False`
   (no auth/cookies in v1, per `specs/features/expense-splitter-poc.md`).
4. **Local dev documentation** — `AGENTS.md` gets a line (alongside the
   existing/eventual frontend and backend dev-server commands from #3/#8)
   documenting: (a) that `npm run dev` talks to the real backend by
   default and expects it running at `VITE_API_BASE_URL` (default
   `http://127.0.0.1:8000`), and (b) that `VITE_USE_MOCKS=true npm run dev`
   runs the frontend against MSW mocks with no backend needed.

## Out of scope

- Automated end-to-end tests exercising real cross-boundary flows (add a
  person, add/edit/delete an expense, see balances update) — issue #16,
  which explicitly depends on this issue closing first.
- Any change to feature UI, components, or MSW handler *content* — #4,
  #5, #6, #7 (frontend) and #11, #12, #13 (backend) own that; this issue
  only changes how the client is pointed and how CORS/mock-gating work.
- CORS configuration for a production/deployed environment (a real origin
  allowlist behind a reverse proxy, HTTPS origins, etc.) — deployment
  target is an explicit open question in `_docs/architecture.md`, not
  decided yet. The `cors_origins` default in this issue is local-dev-only.
- CI wiring to boot both dev servers together in an automated pipeline —
  flagged as an open, undecided question in `_docs/architecture.md`; this
  issue is scoped to local dev, not CI, per the grooming instructions.
- A process manager or single command to start both dev servers together
  (e.g. `concurrently`, a root-level `docker-compose` for the app
  services themselves, as opposed to databases) — not requested; if
  wanted, file a follow-up issue.
- Automatically unregistering a previously-installed MSW service worker
  when switching from `VITE_USE_MOCKS=true` back to the real backend —
  see "Edge cases considered"; this is a documented manual step, not
  something this issue builds tooling around.
- `vite preview` / production-build serving behavior and its CORS/base-URL
  implications — out of scope for the same reason as the deployment
  bullet above; this issue only covers `npm run dev` + `fastapi dev`.

## Acceptance criteria

1. `frontend/src/api/client.ts` passes `baseUrl:
   import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"` (or an
   equivalent fallback expression) into `createClient<paths>(...)` —
   checkable by inspecting the file.
2. `frontend/.env.example` exists and documents both `VITE_API_BASE_URL`
   and `VITE_USE_MOCKS`, each with a comment and its default value.
3. The dev entry point starts the MSW browser worker only when
   `import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true"` —
   checkable by inspecting the file; running `npm run dev` with
   `VITE_USE_MOCKS` unset does not invoke `worker.start()`.
4. `cd frontend && npm test` still runs the full Vitest suite with every
   test passing and network still fully intercepted by MSW via
   `frontend/src/mocks/server.ts` — i.e. this issue changes zero lines in
   the Vitest MSW wiring or `handlers.ts`.
5. `backend/src/app/core/config.py`'s `Settings` class has a
   `cors_origins: list[str]` field that equals
   `["http://localhost:5173", "http://127.0.0.1:5173"]` when no override
   is set.
6. `backend/src/app/main.py` registers `CORSMiddleware` with
   `allow_origins=Settings().cors_origins`, `allow_methods=["*"]`,
   `allow_headers=["*"]`, `allow_credentials=False` — checkable by
   inspecting the file.
7. With the backend dev server running
   (`cd backend && uv run fastapi dev src/app/main.py`), this preflight
   request:
   ```
   curl -s -i -X OPTIONS http://127.0.0.1:8000/people \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type"
   ```
   returns a response with an `access-control-allow-origin:
   http://localhost:5173` header.
8. The same request with `-H "Origin: http://evil.example"` instead does
   **not** return an `access-control-allow-origin` header matching that
   origin — only the two configured dev origins are allowed.
9. With the backend running as in criterion 7 and the frontend running
   via `cd frontend && npm run dev` (no `VITE_USE_MOCKS` set), a plain
   `GET /people` request from the frontend's origin also carries an
   `access-control-allow-origin: http://localhost:5173` (or
   `http://127.0.0.1:5173`, matching whichever origin the browser loaded
   the frontend from) header on the actual (non-preflight) response — not
   only on `OPTIONS`.
10. With both dev servers running as in criterion 9, using the People
    screen in a browser to add a person, then reloading the page, shows
    that person still listed — proving the write landed in the backend's
    SQLite database rather than an in-memory mock (which would reset on
    reload).
11. Repeating criterion 10 with the browser's network tab open shows the
    `POST /people` and `GET /people` requests resolving against
    `http://127.0.0.1:8000` with no `x-powered-by: msw` response header
    (the header MSW adds to responses it intercepts) — confirming the
    request reached the real FastAPI process, not MSW.
12. Setting `VITE_USE_MOCKS=true` before `npm run dev` (backend not
    required to be running) restores full mock behavior: the People
    screen works end-to-end against MSW alone, with responses carrying
    the `x-powered-by: msw` header from criterion 11.
13. `AGENTS.md` documents the `VITE_API_BASE_URL` default/override and the
    `VITE_USE_MOCKS=true npm run dev` opt-in, next to the existing
    frontend/backend dev-server commands.

## Edge cases considered

- **Stale MSW service worker registration**: once a browser has run the
  app with `VITE_USE_MOCKS=true`, the MSW service worker stays registered
  for that origin independent of whether the next page load calls
  `worker.start()` — browsers persist service worker registrations across
  reloads. Switching back to the real backend may therefore require a
  manual hard reload or unregistering the service worker (browser dev
  tools → Application → Service Workers) if stale mocked responses are
  observed. This issue documents the flag but doesn't build tooling to
  auto-unregister; flagged as known local-dev friction, not a bug.
- **`localhost` vs `127.0.0.1` as distinct origins**: browsers treat these
  as different origins for CORS purposes even though they resolve to the
  same host, which is why both forms are in `cors_origins`'s default
  (criterion 5) — a developer who opens the frontend via whichever form
  isn't allowlisted would otherwise see CORS failures for no obvious
  reason.
- **Simple vs. preflighted requests**: browsers only send an `OPTIONS`
  preflight for "non-simple" requests (e.g. JSON `POST`/`PUT` bodies);
  plain `GET` requests are "simple" and go straight through, but still
  need `Access-Control-Allow-Origin` on the actual response — this is why
  criterion 9 checks a real `GET`, not just the `OPTIONS` preflight from
  criteria 7–8. FastAPI's `CORSMiddleware` handles both cases once
  configured; no separate implementation is needed.
- **Test suite must stay hermetic**: `cd frontend && npm test` must never
  depend on a real backend being up — criterion 4 exists specifically to
  guard against this issue accidentally loosening the Vitest MSW wiring
  while changing the dev-mode gating.
- **`fastapi dev`'s bind address**: #8 established that `fastapi dev`
  binds `127.0.0.1:8000` locally; `VITE_API_BASE_URL`'s default matches
  that exactly so the two scaffolds interoperate with zero extra config
  in the common case.

## Constraints

- No new dependency on either side: `fastapi.middleware.cors` ships with
  FastAPI (already a dependency per #8); the frontend changes are
  configuration only. Per `AGENTS.md`, nothing new is added to either
  `pyproject.toml` or `package.json` by this issue.
- `cors_origins`'s default must **not** be `["*"]` — an explicit allowlist
  of the two known local dev origins, even though v1 has no auth, so this
  doesn't quietly become the pattern copied into a production config
  later.
- Env var names use the `VITE_` prefix (`VITE_API_BASE_URL`,
  `VITE_USE_MOCKS`), since Vite only exposes prefixed variables to client
  bundle code.
- This issue does not touch `frontend/src/mocks/handlers.ts` content —
  those handlers are owned by whichever feature issue (#4/#5/#6/#7) first
  needed them.

## Open questions

- **Env var names**: `VITE_API_BASE_URL` and `VITE_USE_MOCKS` aren't
  specified anywhere in existing docs — this spec picks them now. Flag if
  different names are already assumed elsewhere (e.g. by a partially
  implemented #3).
- **`cors_origins` as a `Settings` field vs. a hardcoded constant**:
  assumed a `Settings` field (consistent with how `database_url` is
  already config-driven per #8), even though this issue doesn't require
  it to be overridden via env var for local dev to work. Flag if a plain
  hardcoded list in `main.py` is preferred instead, given it's dev-only
  for now.
- **Whether to solve the stale-service-worker edge case in code** (e.g. an
  explicit "unregister" call when `VITE_USE_MOCKS` is unset): this spec
  treats it as documented friction rather than solving it, since MSW
  doesn't provide a clean unregister hook and it would add complexity for
  a problem a hard reload already fixes. Flag if a human wants this
  handled more robustly.
