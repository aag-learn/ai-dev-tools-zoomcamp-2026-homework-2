---
issue: 11
label: groomed
---

# People endpoints

## Summary

Implement `POST /people` and `GET /people` as FastAPI routes, per the
contract in `openapi/openapi.yaml` (#1), backed by the `Person` SQLAlchemy
model and `people` table (#9), on top of the `backend/` scaffold (#8), with
pytest coverage for every acceptance criterion below. This is the first
router in the project and the prerequisite for expenses (#12), which
reference `Person` rows via `payer_id`/`participant_ids`.

**Note on dependencies:** `openapi/openapi.yaml` (#1), `backend/` (#8), and
the `Person` model/migration (#9) are all groomed but not yet implemented
in this repo. This spec describes the target shape by reading those specs'
content directly — it does not assume any of them is already running.
Implementation of this issue should start once #8 and #9 actually land,
not before.

## Scope

1. **Pydantic schemas** — `backend/src/app/schemas/person.py`:
   - `PersonCreate`: `name: str` with `min_length=1`, `max_length=100`,
     required. No `id` field. This is the `POST /people` request body.
   - `Person`: `id: int`, `name: str` (same length constraints), both
     required. Configured with `model_config = ConfigDict(from_attributes=True)`
     (Pydantic v2) so it can be constructed directly from a `Person`
     SQLAlchemy instance. This is the `POST /people` (`201`) and
     `GET /people` (`200`, as a list) response body.
   - `backend/src/app/schemas/__init__.py` (currently an empty placeholder
     per #8) imports both: `from app.schemas.person import Person,
     PersonCreate` and declares `__all__ = ["Person", "PersonCreate"]`.
   - Field names, types, and constraints mirror #1's `Person`/`PersonCreate`
     schemas exactly (`name`: `minLength: 1`, `maxLength: 100`).
2. **Router** — `backend/src/app/api/people.py`:
   - `router = APIRouter(prefix="/people", tags=["people"])`.
   - `POST /` (i.e. `POST /people`): accepts `PersonCreate`, depends on
     `get_db` (#8's `db/session.py`), creates and commits a new `Person`
     row, returns it as a `Person` schema with `status_code=201`
     (`response_model=schemas.Person`).
   - `GET /` (i.e. `GET /people`): depends on `get_db`, queries all `Person`
     rows ordered by `id` ascending, returns them as
     `response_model=list[schemas.Person]` with the default `200` status.
   - No other routes in this file (no `GET /people/{id}`, no update/delete —
     matches #1's contract, which defines only these two operations).
3. **Wiring** — `backend/src/app/main.py`: imports the `people` router and
   registers it with `app.include_router(people.router)`. This is the
   app's first registered router (#8 left `main.py` with none).
4. **Tests** — `backend/tests/test_people.py`, using the `client` fixture
   from #8's `conftest.py` (isolated SQLite database per test):
   - `POST /people` with `{"name": "Alice"}` returns `201` with a JSON body
     containing an integer `id` and `"name": "Alice"`.
   - `POST /people` with `{"name": ""}` (blank name) returns `422`.
   - `POST /people` with no `name` field at all returns `422`.
   - `POST /people` with a `name` of 101 characters returns `422`; a `name`
     of exactly 100 characters returns `201`.
   - `POST /people` twice with the same `name` (e.g. `"Bob"` both times)
     returns `201` both times, with two distinct `id` values — duplicate
     names are allowed, matching #1's contract.
   - `GET /people` on an empty database returns `200` with body `[]`.
   - `GET /people` after creating two people (e.g. `"Alice"` then `"Bob"`)
     returns `200` with both, as a list ordered by ascending `id` (the
     insertion order).

## Out of scope

- `GET /people/{id}`, editing, or deleting a person — none of these exist
  in #1's contract; not part of v1 at all (not deferred).
- The `Expense` model, schemas, or routes, and any check that a `payer_id`
  or `participant_ids` entry refers to a real person — issue #12.
- Contract-compliance (Schemathesis) tests verifying this router against
  `openapi/openapi.yaml` end-to-end — issue #14; this issue's own
  hand-written tests (Scope item 4) cover the same behavior per-endpoint,
  but the automated cross-check against the YAML file itself is #14's job.
- A service/business-logic layer between the router and the SQLAlchemy
  session — the logic here (insert one row; select all rows ordered by
  `id`) is trivial enough to live directly in the route handler, per
  `_docs/architecture.md`'s "routers are thin" guidance; there's no
  business rule to extract yet.
- Trimming or otherwise normalizing `name` (e.g. rejecting a
  whitespace-only string like `" "`, or collapsing internal whitespace) —
  #1's contract defines `minLength: 1` on the raw string only; a
  whitespace-only name satisfies that constraint and is accepted. If
  trimming is wanted, that's a contract change (#1) before it's an
  implementation change here — file a follow-up issue if needed.
- Rejecting unknown/extra fields in the `POST /people` request body (e.g.
  a client sending `{"name": "Alice", "id": 5}`) — default Pydantic v2
  behavior (extra fields ignored) applies; #1's contract does not set
  `additionalProperties: false` on `PersonCreate`, so nothing here should
  either.

## Acceptance criteria

1. `backend/src/app/schemas/person.py` defines `PersonCreate` (`name: str`,
   `min_length=1`, `max_length=100`, required, no `id`) and `Person` (`id:
   int`, `name: str` with the same constraints, both required), with
   `Person` configured for `from_attributes=True`.
2. `backend/src/app/schemas/__init__.py` exposes both via `from
   app.schemas import Person, PersonCreate`.
3. `backend/src/app/api/people.py` defines an `APIRouter` with
   `prefix="/people"` containing exactly two routes: `POST /` and `GET /`.
4. `backend/src/app/main.py` registers the people router; `GET
   /openapi.json` on the running app lists `/people` under `paths` with
   both a `post` and a `get` operation.
5. `POST /people` with a valid body (e.g. `{"name": "Alice"}`) returns
   `201` with a JSON body matching `{"id": <int>, "name": "Alice"}`.
6. `POST /people` with `{"name": ""}` returns `422`.
7. `POST /people` with a body missing the `name` field returns `422`.
8. `POST /people` with a 101-character `name` returns `422`; with a
   100-character `name` returns `201`.
9. `POST /people` called twice with the same `name` value returns `201`
   both times with two different `id` values in the responses.
10. `GET /people` on a database with zero people returns `200` with body
    `[]`.
11. `GET /people` after two people have been created returns `200` with a
    JSON array of exactly those two objects, in ascending `id` order.
12. `cd backend && uv run pytest` runs the full suite (including
    `backend/tests/test_people.py` and everything from #8/#9) with every
    test passing.
13. No route other than `POST /people` and `GET /people` is added by this
    change (no `GET /people/{id}`, no `PUT`/`DELETE` on `/people`).

## Edge cases considered

- **Duplicate person names**: explicitly allowed per #1's contract — no
  uniqueness check anywhere in the router, and criterion 9 tests this
  directly.
- **Empty group**: `GET /people` returns `200` with `[]`, not `404` or any
  other special-cased response, when no people exist yet (criterion 10).
- **Ordering**: `GET /people` must return rows in ascending `id` order
  (insertion order), not database-default order, which is unspecified for
  most engines without an explicit `ORDER BY` — the query explicitly sorts
  by `id`.
- **`name` at exactly the boundary lengths** (0, 100, 101 characters):
  covered directly by criteria 6 and 8, since off-by-one errors in
  `min_length`/`max_length` are the most likely bug here.
- **Response shape uses the Pydantic schema, not the raw SQLAlchemy
  object**: `response_model=schemas.Person` ensures the API returns
  exactly `id`/`name` even if the `Person` model later grows internal-only
  columns — FastAPI's response-model filtering handles this by default, no
  extra code needed.
- **Committing before reading back the auto-assigned `id`**: the `POST`
  handler must commit (or flush) the session before constructing the
  response, otherwise `id` would be `None` in the returned `Person` schema.

## Constraints

- No new dependency is added to `backend/pyproject.toml` — everything
  needed (`fastapi`, `sqlalchemy`, `pydantic`) is already declared by #8.
- Field names are `snake_case` and match #1's contract exactly (`id`,
  `name`) — no alias configuration needed.
- Routers are thin per `_docs/architecture.md`: validation via Pydantic
  schemas, persistence via the `Person` SQLAlchemy model and the `get_db`
  session dependency from #8 — no separate service layer for this issue
  (see "Out of scope").
- Per `_docs/testing-guidelines.md`, this is "backend logic": the failing
  pytest cases (Scope item 4) are written against these acceptance
  criteria before/alongside the route implementation.

## Open questions

- **File/module layout for the router and schema**: assumed
  `backend/src/app/api/people.py` and `backend/src/app/schemas/person.py`
  (one file per resource, mirroring #9's `models/person.py`), since
  `_docs/architecture.md` names `api/` as "routers" and `schemas/` as
  "Pydantic request/response models" but doesn't dictate one-file-per-
  resource explicitly. This is a style default with no behavioral
  consequence; flag if a different split (e.g. all schemas in one
  `schemas/models.py`) is preferred before #12 adds `expense.py` siblings.
- **Whitespace-only `name`**: assumed accepted (see "Out of scope"), since
  #1's contract only constrains raw string length via `minLength: 1`, not
  content. Flag if the intent was always to reject a name like `" "` —
  that would be a contract change (#1), not just an implementation change
  here.
