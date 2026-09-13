---
issue: 12
label: groomed
---

# Expense endpoints

## Summary

Implement `POST /expenses`, `GET /expenses`, `PUT /expenses/{expense_id}`,
and `DELETE /expenses/{expense_id}` as FastAPI routes, per the contract in
`openapi/openapi.yaml` (#1), backed by the `Expense`/`Person` SQLAlchemy
models and `expenses`/`expense_participants`/`people` tables (#10, #9), on
top of the `backend/` scaffold (#8) and the `people` router precedent
(#11), with pytest coverage for every acceptance criterion below. This is
the second router in the project; `GET /balances` (#13) reads the
`Expense` rows this issue creates but adds no logic here.

**Note on dependencies:** `openapi/openapi.yaml` (#1), `backend/` (#8),
the `Person` model (#9), the `Expense` model (#10), and the people
endpoints (#11) are all groomed but not yet implemented in this repo. This
spec describes the target shape by reading those specs' content directly
— it does not assume any of them is already running. Implementation of
this issue should start once #8, #9, #10, and #11 actually land, not
before.

## Scope

1. **Pydantic schemas** — `backend/src/app/schemas/expense.py`:
   - `ExpenseWrite`: `description: str` (`min_length=1`, `max_length=200`),
     `amount: float` (`gt=0`), `payer_id: int`, `date: date`,
     `participant_ids: list[int]` (`min_length=1`), plus a field validator
     rejecting a `participant_ids` list containing duplicate values (a
     `ValueError` raised in the validator becomes FastAPI's normal `422`
     response — this is how the contract's `uniqueItems: true` is
     enforced, since Pydantic v2 has no built-in `unique_items`
     constraint). No `id` field. This is the request body for both
     `POST /expenses` and `PUT /expenses/{expense_id}`.
   - `Expense`: `id: int`, plus the same fields and constraints as
     `ExpenseWrite`, all required. This is the response body for
     `POST` (`201`), `GET` (`200`, as a list), and `PUT` (`200`).
   - The `Expense` schema is **not** built via `from_attributes=True`
     directly off a SQLAlchemy `Expense` instance, because the ORM model
     has no `participant_ids` attribute — it has a `participants`
     relationship (a list of `Person` objects) and a separate `payer`
     relationship. The router (Scope item 2) builds each `Expense`
     response explicitly: `payer_id` comes from the model's own
     `payer_id` column (not from `payer.id`), and `participant_ids` is
     `sorted(p.id for p in expense.participants)` — sorted ascending by
     id so the response is deterministic regardless of the order
     SQLAlchemy returns the many-to-many rows in (the DB layer gives no
     ordering guarantee here, and the contract doesn't require the
     response to echo the request's original ordering).
   - `backend/src/app/schemas/__init__.py` (currently exports `Person`,
     `PersonCreate` per #11) is extended to also export
     `from app.schemas.expense import Expense, ExpenseWrite`, with
     `__all__ = ["Expense", "ExpenseWrite", "Person", "PersonCreate"]`.
   - `amount` is persisted as `Decimal(str(amount))` when writing to the
     `Expense` model's `Numeric(10, 2)` column (see #10) — converting via
     `str()` first avoids introducing binary-floating-point drift that a
     direct `Decimal(float)` conversion would risk — and converted back
     with `float(expense.amount)` when building the response. No explicit
     rounding/truncation to 2 decimal places is applied in either
     direction: the contract deliberately doesn't enforce a decimal-places
     rule at the schema level (see #1's `amount` field notes), so this
     issue doesn't add one either.
2. **Router** — `backend/src/app/api/expenses.py`:
   - `router = APIRouter(prefix="/expenses", tags=["expenses"])`.
   - A private helper, `_validate_references(db, payer_id, participant_ids)`,
     that queries `Person` for all ids in `{payer_id} | set(participant_ids)`
     and raises `HTTPException(status_code=400, detail=...)` (matching
     the contract's `Error` schema) if any id has no matching row. Called
     by both the create and update handlers, before any write.
   - A private helper, `_to_schema(expense) -> schemas.Expense`, that
     builds the response body as described in Scope item 1 (explicit
     `participant_ids` derivation, sorted ascending).
   - `POST /` (i.e. `POST /expenses`): accepts `ExpenseWrite`, depends on
     `get_db`. Calls `_validate_references` first (→ `400` if it fails).
     Otherwise creates a new `Expense` row with `participants` set to the
     `Person` rows matching `participant_ids`, commits, and returns
     `_to_schema(expense)` with `status_code=201`
     (`response_model=schemas.Expense`).
   - `GET /` (i.e. `GET /expenses`): depends on `get_db`, queries all
     `Expense` rows ordered by `Expense.date.desc()` then `Expense.id.desc()`
     (most recent first; same-date rows tiebreak by newest `id` first, per
     #1's contract), returns `[_to_schema(e) for e in expenses]` as
     `response_model=list[schemas.Expense]` with the default `200` status.
   - `PUT /{expense_id}` (i.e. `PUT /expenses/{expense_id}`): accepts
     `ExpenseWrite` and a path `expense_id: int`, depends on `get_db`.
     Looks up the `Expense` by id — `404` (`Error` schema) if it doesn't
     exist. Otherwise calls `_validate_references` (→ `400` if it fails),
     then overwrites `description`, `amount` (converted per Scope item 1),
     `payer_id`, `date`, and reassigns `participants` to the full new set
     of `Person` rows matching `participant_ids` (a full replace of the
     many-to-many association, not a merge/patch — reassigning the
     relationship's Python list is sufficient for SQLAlchemy to
     synchronize `expense_participants`: remove rows no longer present,
     add rows newly present). Commits and returns `_to_schema(expense)`
     with the default `200` status (`response_model=schemas.Expense`).
   - `DELETE /{expense_id}` (i.e. `DELETE /expenses/{expense_id}`):
     depends on `get_db`. Looks up the `Expense` by id — `404` (`Error`
     schema) if it doesn't exist. Otherwise deletes it via the ORM
     (`db.delete(expense)`, not a raw/bulk `DELETE` statement) so
     SQLAlchemy cleans up the corresponding `expense_participants` rows
     itself even though SQLite doesn't enforce the `ON DELETE CASCADE`
     constraint from #10 unless `PRAGMA foreign_keys=ON` is set (which
     this issue does not set). Commits and returns `204` with no body
     (`status_code=204`, no `response_model`).
   - No other routes in this file (no `GET /expenses/{id}` — matches #1's
     contract, which defines no single-expense fetch).
   - All business-logic helpers (`_validate_references`, `_to_schema`)
     live in this router file as module-level functions, not in a
     separate `services/` package — see "Open questions" for why, and
     flag if a formal service layer is wanted instead before #13 adds
     balances logic on top.
3. **Wiring** — `backend/src/app/main.py`: imports the `expenses` router
   (alongside the existing `people` router from #11) and registers it with
   `app.include_router(expenses.router)`.
4. **Tests** — `backend/tests/test_expenses.py`, using the `client`
   fixture from #8's `conftest.py` (isolated SQLite database per test).
   Each test that needs existing people creates them first via
   `POST /people` (or directly via the `Person` model) so `payer_id`/
   `participant_ids` reference real rows unless the test is specifically
   checking the `400` referential-integrity path:
   - `POST /expenses` with a valid body (existing payer + participants)
     returns `201` with a JSON body containing an integer `id` and the
     submitted fields echoed back, `participant_ids` sorted ascending.
   - `POST /expenses` with `amount: 0` and with `amount: -5` both return
     `422`.
   - `POST /expenses` with an empty `participant_ids` list returns `422`.
   - `POST /expenses` with a `participant_ids` list containing a
     duplicate id (e.g. `[1, 1]`) returns `422`.
   - `POST /expenses` missing a required field (e.g. no `date`) returns
     `422`.
   - `POST /expenses` with a `payer_id` that doesn't match any existing
     person returns `400`.
   - `POST /expenses` with a `participant_ids` entry that doesn't match
     any existing person returns `400`.
   - `POST /expenses` where the payer is also one of the participants
     succeeds with `201` (matches #10's model-level precedent that this
     is allowed).
   - `GET /expenses` on an empty database returns `200` with body `[]`.
   - `GET /expenses` after creating three expenses with distinct `date`
     values returns them ordered by `date` descending.
   - `GET /expenses` after creating two expenses with the **same** `date`
     returns them ordered by `id` descending (most recently created
     first) as the tiebreak.
   - `PUT /expenses/{expense_id}` on an existing expense with a fully
     different valid body (different `description`, `amount`,
     `participant_ids`) returns `200` with the updated fields, and a
     subsequent `GET /expenses` reflects the new values, not the old
     ones.
   - `PUT /expenses/{expense_id}` on an `expense_id` that doesn't exist
     returns `404`.
   - `PUT /expenses/{expense_id}` with an invalid body (e.g. `amount: 0`)
     returns `422`.
   - `PUT /expenses/{expense_id}` with a `payer_id`/`participant_ids`
     entry that doesn't match any existing person returns `400`.
   - `DELETE /expenses/{expense_id}` on an existing expense returns `204`
     with an empty body, and a subsequent `GET /expenses` no longer
     includes it.
   - `DELETE /expenses/{expense_id}` on an `expense_id` that doesn't
     exist returns `404`.
   - `DELETE /expenses/{expense_id}` removes the expense's rows from
     `expense_participants` without deleting the referenced `Person`
     rows — checked directly against the test's DB session (e.g.
     querying the `expense_participants` table / `Person` rows after the
     delete), not just via the `GET /expenses` list.

## Out of scope

- Computing or storing each participant's equal-split share amount (e.g.
  `amount / len(participant_ids)`), and the remainder-distribution rule
  for amounts that don't divide evenly — this issue stores `amount` and
  `participant_ids` verbatim; the equal-split arithmetic is `GET
  /balances`' business logic (#13), per #1's contract, which explicitly
  defers "the exact rounding/remainder-distribution algorithm" to that
  issue. No field for a computed per-person share is added to the
  `Expense` schema or model.
- `GET /expenses/{expense_id}` (single-expense fetch) — not defined in
  #1's contract; not part of v1 at all (not deferred).
- The `GET /balances` route and any balance-computation logic — issue
  #13, which depends on this one.
- Contract-compliance (Schemathesis) tests verifying this router against
  `openapi/openapi.yaml` end-to-end — issue #14; this issue's own
  hand-written tests (Scope item 4) cover the same behavior per-endpoint,
  but the automated cross-check against the YAML file itself is #14's
  job.
- A new Alembic migration — #10 already created the `expenses` and
  `expense_participants` tables this issue reads and writes; no model or
  schema change is made here, so no migration is part of this issue.
- A formal `services/` package for the validation/conversion helpers —
  kept as module-level functions in `api/expenses.py` instead, matching
  #11's precedent and the repository layout in `_docs/architecture.md`
  (which names `api/`, `schemas/`, `models/`, `db/`, `core/` but no
  `services/` directory). See "Open questions" for why this reading was
  chosen over the raw issue's "shared... service logic" phrasing.
- Trimming or otherwise normalizing `description` (e.g. rejecting a
  whitespace-only string) — mirrors #11's decision for `Person.name`:
  the contract only constrains raw string length via `minLength`, not
  content.
- Rejecting unknown/extra fields in request bodies — default Pydantic v2
  behavior (extra fields ignored) applies, matching #11's precedent and
  the contract's lack of `additionalProperties: false`.
- Modifying `backend/src/app/models/expense.py` or `models/person.py` —
  this issue reads and writes through the relationships #10 already
  defined; no model change (e.g. adding `order_by=` to the `participants`
  relationship) is needed, since response ordering is handled in the
  router's `_to_schema` helper instead (see Scope item 1).
- Enforcing 2-decimal-place precision on `amount` beyond what `gt=0`
  already requires — matches #1's contract, which deliberately doesn't
  add a `multipleOf` constraint (see #1's "Scope" notes on `amount`).

## Acceptance criteria

1. `backend/src/app/schemas/expense.py` defines `ExpenseWrite`
   (`description`, `amount`, `payer_id`, `date`, `participant_ids` with
   the constraints in Scope item 1, no `id`) and `Expense` (same fields
   plus `id: int`, all required).
2. `ExpenseWrite`'s `participant_ids` validator rejects a list containing
   a duplicate value with a `422` when used as a FastAPI request body.
3. `backend/src/app/schemas/__init__.py` exposes `Expense`, `ExpenseWrite`,
   `Person`, and `PersonCreate` via `from app.schemas import Expense,
   ExpenseWrite, Person, PersonCreate`.
4. `backend/src/app/api/expenses.py` defines an `APIRouter` with
   `prefix="/expenses"` containing exactly four routes: `POST /`,
   `GET /`, `PUT /{expense_id}`, `DELETE /{expense_id}`.
5. `backend/src/app/main.py` registers the expenses router; `GET
   /openapi.json` on the running app lists `/expenses` under `paths` with
   `post` and `get` operations, and `/expenses/{expense_id}` with `put`
   and `delete` operations.
6. `POST /expenses` with a valid body (existing `payer_id`, existing
   `participant_ids`) returns `201` with a JSON body containing an
   integer `id` and the submitted `description`/`amount`/`payer_id`/
   `date`, plus `participant_ids` equal to the submitted set (order-
   independent, since the response sorts ascending).
7. `POST /expenses` with `amount: 0` returns `422`; with `amount: -5`
   returns `422`.
8. `POST /expenses` with `participant_ids: []` returns `422`.
9. `POST /expenses` with `participant_ids` containing a duplicate value
   returns `422`.
10. `POST /expenses` with a request body missing any one required field
    (`description`, `amount`, `payer_id`, `date`, or `participant_ids`)
    returns `422`.
11. `POST /expenses` with a `payer_id` that matches no existing person
    returns `400` with a JSON body containing a `detail` string.
12. `POST /expenses` with a `participant_ids` entry that matches no
    existing person returns `400` with a JSON body containing a `detail`
    string.
13. `POST /expenses` where `payer_id` also appears in `participant_ids`
    returns `201` (not rejected).
14. `GET /expenses` on a database with zero expenses returns `200` with
    body `[]`.
15. `GET /expenses` after creating three expenses with distinct `date`
    values returns them ordered by `date` descending.
16. `GET /expenses` after creating two expenses with the same `date`
    returns them ordered by `id` descending as the tiebreak.
17. `PUT /expenses/{expense_id}` on an existing expense with a fully
    different valid body returns `200` with a JSON body reflecting every
    updated field (not a merge of old and new values), and a subsequent
    `GET /expenses` shows only the updated values for that `id`.
18. `PUT /expenses/{expense_id}` on a nonexistent `expense_id` returns
    `404` with a JSON body containing a `detail` string; no row is
    created.
19. `PUT /expenses/{expense_id}` with an invalid body (e.g. `amount: 0`,
    or empty `participant_ids`) returns `422`.
20. `PUT /expenses/{expense_id}` with a `payer_id`/`participant_ids`
    entry that matches no existing person returns `400`.
21. `DELETE /expenses/{expense_id}` on an existing expense returns `204`
    with an empty response body, and a subsequent `GET /expenses` no
    longer includes that `id`.
22. `DELETE /expenses/{expense_id}` on a nonexistent `expense_id` returns
    `404` with a JSON body containing a `detail` string.
23. After `DELETE /expenses/{expense_id}` on an existing expense, no row
    in `expense_participants` references that `expense_id`, and every
    `Person` row that was a participant or payer of the deleted expense
    still exists.
24. `cd backend && uv run pytest` runs the full suite (including
    `backend/tests/test_expenses.py` and everything from #8/#9/#10/#11)
    with every test passing.
25. No route other than the four listed in criterion 4 is added by this
    change (no `GET /expenses/{id}`, no `GET /balances`).
26. No new file appears under `backend/alembic/versions/` as part of this
    change.

## Edge cases considered

- **Referential integrity checked before any write**: `_validate_references`
  runs before the `Expense` row (or its participant associations) is
  created/modified, so a `400` never leaves a partially-written row
  behind — criteria 11, 12, 20 all assume no side effect on failure.
- **`422` takes precedence over `400`**: FastAPI parses and validates the
  request body against `ExpenseWrite` (raising `422` on failure)
  *before* the route handler — and therefore `_validate_references` —
  ever runs, so a request that's both malformed and references a
  nonexistent person always surfaces `422`, never `400`. This matches
  #1's contract, which documents them as distinct, non-overlapping
  response codes.
- **`PUT` is a full replace, not a merge**: submitting a `PUT` body that
  omits a field the current row has (impossible here, since every
  `ExpenseWrite` field is required) is moot, but changing e.g. only
  `description` while resending the *same* `amount`/`payer_id`/`date`/
  `participant_ids` is the expected shape of a "partial-feeling" edit —
  the client always resends the full object, matching #1's contract.
- **Reassigning `participants` on update**: setting
  `expense.participants = [...]` to a smaller or entirely different set
  than before must remove the now-stale `expense_participants` rows, not
  just add the new ones — SQLAlchemy's `secondary=` relationship handles
  this synchronization automatically when the attribute is reassigned
  (see Scope item 2), so no manual `DELETE` against the association
  table is needed in the handler.
- **`DELETE` must use `db.delete(expense)`, not a bulk statement**: a raw
  `DELETE FROM expenses WHERE id = ...` would bypass SQLAlchemy's
  in-session cascade cleanup of `expense_participants`, and SQLite's
  `ON DELETE CASCADE` (declared in #10's migration) isn't enforced
  without `PRAGMA foreign_keys=ON`, which this issue doesn't set — so an
  ORM-level delete is the only way criterion 23 holds under SQLite.
- **Same person as payer and participant**: allowed (criterion 13),
  matching #10's model-level precedent — no validation rejects this
  combination.
- **`participant_ids` response ordering**: sorted ascending by id in the
  response regardless of request order or the DB's return order for the
  many-to-many relationship, so tests (and API consumers) get a
  deterministic value — see Scope item 1.
- **Same-date tiebreak direction**: newest `id` first (descending) for
  expenses sharing a `date`, matching #1's contract's `GET /expenses`
  ordering rule exactly (criterion 16).
- **Empty database**: `GET /expenses` returns `200` with `[]`, not `404`
  or any special-cased response (criterion 14), matching #11's
  `GET /people` precedent.
- **`amount` float-to-Decimal conversion**: converting via
  `Decimal(str(amount))` rather than `Decimal(amount)` avoids seeding the
  stored value with the binary floating-point representation of the
  incoming JSON number (e.g. `Decimal(0.1)` != `Decimal("0.1")`) —
  relevant because #13's balance sums will read this column back.

## Constraints

- No new dependency is added to `backend/pyproject.toml` — everything
  needed (`fastapi`, `sqlalchemy`, `pydantic`) is already declared by #8.
- Field names are `snake_case` and match #1's contract exactly
  (`description`, `amount`, `payer_id`, `date`, `participant_ids`) — no
  alias configuration needed.
- Routers stay close to #11's "thin" precedent: request/response
  validation via Pydantic schemas, persistence via the `Expense`/`Person`
  SQLAlchemy models and the `get_db` session dependency from #8. The
  referential-integrity check and response-shaping helpers are the one
  piece of logic beyond pure CRUD this issue adds, and they live as
  module-level functions in `api/expenses.py` rather than a new
  `services/` package (see "Out of scope" and "Open questions").
- Per `_docs/testing-guidelines.md`, this is "backend logic": the failing
  pytest cases (Scope item 4) are written against these acceptance
  criteria before/alongside the route implementation, and the guideline
  document's own example command (`uv run pytest tests/test_expenses.py`)
  fixes the test file's name and location.
- No SQLAlchemy model file (`models/person.py`, `models/expense.py`) or
  Alembic migration is modified by this issue (see "Out of scope").

## Open questions

- **No formal `services/` layer**: the raw issue text says these routes
  "share the same router, schemas, and service logic," which could be
  read as calling for a dedicated `services/` package. This spec assumes
  it instead means shared *helper functions within the router file*
  (`_validate_references`, `_to_schema`), since `_docs/architecture.md`'s
  repository layout diagram doesn't list a `services/` directory, and
  #11 (the sibling endpoint set) kept all logic directly in
  `api/people.py`. Flag if a formal `services/` package is actually
  wanted — it would also affect #13's balances computation, which reads
  the same tables and might want to share logic with this issue's
  helpers.
- **`amount` as `float` vs. `Decimal` in the Pydantic schema**: assumed
  `float` (matching the contract's JSON `number` type on the wire
  directly, converted to/from `Decimal` only at the SQLAlchemy boundary —
  see Scope item 1), rather than declaring the Pydantic field itself as
  `Decimal`. Pydantic v2 can serialize `Decimal` fields to JSON, but the
  conversion-at-the-boundary approach keeps the schema's wire
  representation unambiguous without relying on Pydantic's `Decimal`
  JSON-encoding configuration. Flag if `Decimal` end-to-end (schema
  included) is preferred instead — it would change the exact
  `ExpenseWrite`/`Expense` field type in criterion 1 but not any
  observable HTTP behavior.
- **Referential-integrity check granularity**: assumed one combined `400`
  check covering both `payer_id` and every `participant_ids` entry in a
  single query (`_validate_references`), rather than two separate checks
  with distinct `detail` messages. The contract (#1) doesn't specify
  the exact wording of `detail` for this case, only the status code —
  criteria 11/12 only assert the status code and that `detail` is a
  string, not its exact text, so this is a non-binding implementation
  choice.
