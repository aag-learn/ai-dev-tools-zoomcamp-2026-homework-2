---
issue: 13
label: groomed
---

# Balances endpoint

## Summary

Implement `GET /balances` as a FastAPI route, per the contract in
`openapi/openapi.yaml` (#1), computing each person's net position by
reading all `Expense`/`Person` rows (#9, #10) and applying an equal-split
aggregation consistent with #12's expense-storage semantics, with pytest
coverage for every acceptance criterion below. This is a distinct
read/aggregation concern, not CRUD — nothing is written, and the result is
recomputed fresh on every call from current `Expense`/`Person` state, never
cached or materialized.

**Note on dependencies:** `openapi/openapi.yaml` (#1), `backend/` (#8), the
`Person` model (#9), the `Expense` model (#10), and the people/expense
endpoints (#11, #12) are all groomed but not yet implemented in this repo.
This spec describes the target shape by reading those specs' content
directly — it does not assume any of them is already running.
Implementation of this issue should start once #8, #9, #10, #11, and #12
actually land, not before.

## Scope

1. **Pydantic schema** — `backend/src/app/schemas/balance.py`:
   - `Balance`: `person_id: int`, `name: str`, `balance: float`, all
     required. This is the `GET /balances` (`200`, as a list) response
     body — matches #1's contract exactly.
   - `backend/src/app/schemas/__init__.py` (currently exports `Expense`,
     `ExpenseWrite`, `Person`, `PersonCreate` per #11/#12) is extended to
     also export `from app.schemas.balance import Balance`, with
     `__all__ = ["Balance", "Expense", "ExpenseWrite", "Person",
     "PersonCreate"]`.
2. **Router** — `backend/src/app/api/balances.py`:
   - `router = APIRouter(tags=["balances"])` with exactly one route,
     declared as `@router.get("/balances", response_model=list[schemas.Balance])`
     — an absolute path on the router rather than a `prefix` + `"/"` combo
     (unlike #11/#12's `/people`, `/expenses` routers), since there is only
     one operation here and no sub-resource; this sidesteps any
     prefix-plus-trailing-slash ambiguity entirely for this single route.
   - A private helper, `_compute_balances(db) -> list[schemas.Balance]`,
     containing the aggregation logic in Scope item 4, called by the route
     handler. Lives as a module-level function in this router file, not a
     `services/` package — same reasoning and precedent as #11/#12 (no
     `services/` directory in `_docs/architecture.md`'s layout).
   - The route depends on `get_db` (#8's `db/session.py`), calls
     `_compute_balances(db)`, and returns the result with the default `200`
     status. No other routes in this file.
3. **Wiring** — `backend/src/app/main.py`: imports the `balances` router
   (alongside the existing `people` and `expenses` routers from #11/#12)
   and registers it with `app.include_router(balances.router)`.
4. **Aggregation algorithm** (`_compute_balances`), operating entirely in
   integer cents via `decimal.Decimal` to avoid float drift when summing
   many rows (same rationale as #10/#12's `Numeric`/`Decimal` choices):
   - Query all `Person` rows ordered by `id` ascending — this is both the
     iteration order and the response order (matches #1's contract:
     `person_id` ascending).
   - Query all `Expense` rows (with their `participants` relationship
     available, e.g. via eager loading — an implementation detail with no
     externally observable effect).
   - Initialize `net_cents: dict[int, int]`, defaulting to `0` for every
     person id.
   - For each expense:
     - `participant_ids = sorted(p.id for p in expense.participants)` —
       ascending by id, matching #12's response-ordering convention for
       `participant_ids`, reused here to make remainder distribution
       deterministic.
     - `n = len(participant_ids)` (always `>= 1`, per the contract's
       `minItems: 1`).
     - `amount_cents = int(expense.amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)` — quantizing to the nearest cent *before* converting to an integer defensively handles the case where `expense.amount` has more than 2 decimal places in the database (reachable today because #12's `ExpenseWrite.amount` has no `multipleOf`/decimal-place constraint and applies no rounding when persisting — see #12's Scope item 1 and #10's "Edge cases considered"). For the common case (`amount` already has exactly 2 decimal places), this quantize is a no-op.
     - `base_cents, remainder_cents = divmod(amount_cents, n)`.
     - For `i, pid` in `enumerate(participant_ids)`: that participant's
       share is `base_cents + 1` if `i < remainder_cents`, else
       `base_cents` — i.e. the leftover cents (there are always fewer than
       `n` of them) go one-per-person to the lowest-id participants first.
       Subtract that share from `net_cents[pid]`.
     - Add the full `amount_cents` to `net_cents[expense.payer_id]`
       (regardless of whether the payer is also a participant — a payer
       who is also a participant nets out to "paid in full, minus their
       own share," matching the issue's stated formula: "net balance =
       total they paid across all expenses minus their equal share of
       every expense they participated in").
   - Build the response: for each `Person` (in `id`-ascending order),
     `Balance(person_id=person.id, name=person.name,
     balance=float(Decimal(net_cents[person.id]) / 100))`.
5. **Tests** — `backend/tests/test_balances.py`, using the `client` fixture
   from #8's `conftest.py` (isolated SQLite database per test), creating
   people/expenses via `POST /people` / `POST /expenses` (or directly via
   the ORM where a scenario needs to bypass API-level constraints, e.g.
   criterion 13 below):
   - `GET /balances` on a database with zero people and zero expenses
     returns `200` with body `[]`.
   - `GET /balances` with people created but zero expenses returns `200`
     with one entry per person, each `balance: 0.0`, ordered by
     `person_id` ascending.
   - A single expense of `amount: 30.00`, `participant_ids` = 3 people,
     `payer_id` = a 4th person not among the participants: the payer's
     balance is `30.0`; each of the 3 participants' balance is `-10.0`.
   - A single expense of `amount: 10.00` split among 3 participants whose
     ids sort as `p1 < p2 < p3`, where `payer_id = p1` (payer is also a
     participant): `p1`'s balance is `6.66` (`10.00` paid minus `3.34`
     share, `p1` absorbing the leftover cent as the lowest id), `p2`'s and
     `p3`'s balances are each `-3.33`.
   - Two expenses with different payers and overlapping (but not
     identical) participant sets: each person's final balance is the sum
     of their role across both expenses, not just the most recent one.
   - For any fixture with one or more expenses, the sum of every entry's
     `balance` in the response is `0` (within a `0.001` floating-point
     tolerance).
   - After `DELETE /expenses/{expense_id}` on the only expense in the
     database, a subsequent `GET /balances` shows every person's balance
     back at `0.0`.
   - After `PUT /expenses/{expense_id}` changes an expense's amount,
     payer, and participants, a subsequent `GET /balances` reflects only
     the updated values, not the original ones.
   - An expense whose `amount` has more than 2 decimal places (inserted
     directly via the ORM with `Decimal("12.505")`, bypassing
     `POST /expenses`, to simulate the gap described in Scope item 4) is
     treated as `12.51` (`ROUND_HALF_UP` to the nearest cent) when
     computing shares, verified by checking the resulting balances sum to
     exactly `12.51`.
   - `GET /balances` response entries are ordered by `person_id` ascending
     regardless of the order people were created or referenced by
     expenses.

## Out of scope

- Any endpoint other than `GET /balances` (no settle-up, no suggested
  payment plan, no filtering/pagination of balances) — matches
  `specs/features/expense-splitter-poc.md`'s v1 scope and #7's UI spec,
  which already treats this screen as pure display with no mutating
  action.
- Storing or caching a computed balance (e.g. a `balance` column on
  `Person`, or a materialized view) — every `GET /balances` call
  recomputes from the current `Expense`/`Person` rows; nothing is
  persisted by this issue.
- Modifying `backend/src/app/models/expense.py`, `models/person.py`, or
  `schemas/expense.py` — this issue only reads through the relationships
  #10 already defined and the `Expense`/`ExpenseWrite` schemas #12 already
  defined; no model or schema change is made to either.
- Closing the gap that lets an expense's `amount` carry more than 2
  decimal places in storage in the first place (e.g. adding a
  `multipleOf`/rounding rule to #12's `ExpenseWrite`) — this issue works
  around that gap defensively (Scope item 4) but does not fix it at the
  source; if tightening #12 is wanted, that's a follow-up to #12's already-
  frozen spec, to be filed separately.
- A new Alembic migration — no model or schema change is made by this
  issue.
- Contract-compliance (Schemathesis) tests verifying this router against
  `openapi/openapi.yaml` end-to-end — issue #14; this issue's own
  hand-written tests (Scope item 5) cover the same behavior directly, but
  the automated cross-check against the YAML file itself is #14's job.
- A formal `services/` package for `_compute_balances` — kept as a
  module-level function in `api/balances.py` instead, matching #11/#12's
  precedent (see Scope item 2).
- Wiring the frontend's `BalancesView.vue` (#7) to this real endpoint
  instead of its MSW mock — issue #15 ("wire frontend to real backend").

## Acceptance criteria

1. `backend/src/app/schemas/balance.py` defines `Balance` (`person_id:
   int`, `name: str`, `balance: float`), all required.
2. `backend/src/app/schemas/__init__.py` exposes `Balance` via `from
   app.schemas import Balance, Expense, ExpenseWrite, Person, PersonCreate`.
3. `backend/src/app/api/balances.py` defines an `APIRouter` containing
   exactly one route: `GET /balances`.
4. `backend/src/app/main.py` registers the balances router; `GET
   /openapi.json` on the running app lists `/balances` under `paths` with
   a `get` operation.
5. `GET /balances` on a database with zero people and zero expenses
   returns `200` with body `[]`.
6. `GET /balances` on a database with people but zero expenses returns
   `200` with one entry per person, each `{"person_id": <id>, "name":
   <name>, "balance": 0.0}`, ordered by `person_id` ascending.
7. Given a single expense of `amount: 30.00` split among 3 participants,
   with `payer_id` set to a 4th person not among the participants, `GET
   /balances` returns the payer with `balance: 30.0` and each of the 3
   participants with `balance: -10.0`.
8. Given a single expense of `amount: 10.00` split among 3 participants
   whose ids sort ascending as `p1 < p2 < p3`, with `payer_id = p1`, `GET
   /balances` returns `p1` with `balance: 6.66`, `p2` with `balance:
   -3.33`, and `p3` with `balance: -3.33`.
9. Given two expenses with different payers and overlapping participant
   sets, `GET /balances` returns each person's balance as the sum of their
   net position across both expenses.
10. For any `GET /balances` response derived from a fixture with one or
    more expenses, the sum of every entry's `balance` value is `0`,
    within a `0.001` floating-point tolerance.
11. After `DELETE /expenses/{expense_id}` removes the only expense in the
    database, a subsequent `GET /balances` shows every person's `balance`
    back at `0.0`.
12. After `PUT /expenses/{expense_id}` changes an expense's `amount`,
    `payer_id`, and `participant_ids`, a subsequent `GET /balances`
    reflects only the new values, not the pre-edit ones.
13. Given an `Expense` row whose `amount` has more than 2 decimal places
    (e.g. `Decimal("12.505")`, inserted directly via the ORM to simulate a
    value #12's current validation doesn't reject), `GET /balances`
    computes shares as if the amount were `12.51` (`ROUND_HALF_UP` to the
    nearest cent), verified by the resulting balances summing to exactly
    `12.51`.
14. `GET /balances` response entries are ordered by `person_id` ascending
    regardless of person-creation order or expense-reference order.
15. `cd backend && uv run pytest` runs the full suite (including
    `backend/tests/test_balances.py` and everything from #8–#12) with
    every test passing.
16. No route other than `GET /balances` is added by this change.
17. No new file appears under `backend/alembic/versions/` as part of this
    change.

## Edge cases considered

- **Remainder distribution for an uneven split**: leftover cents (fewer
  than the participant count, by construction of `divmod`) go one-per-
  person to the lowest-id participants first, mirroring #12's
  sorted-ascending `participant_ids` convention for determinism — see
  Scope item 4 and criterion 8.
- **Payer who is also a participant**: nets out correctly under "paid in
  full, minus their own share" — no special-casing needed, since the
  payer-credit and participant-debit steps in Scope item 4 are independent
  operations applied to the same `net_cents[pid]` entry (criterion 8).
- **Payer who is not a participant**: receives full credit for the amount
  paid with no offsetting debit, since they never appear in
  `participant_ids` for that expense (criterion 7).
- **Person with zero expenses**: still appears in the response with
  `balance: 0.0`, per #1's contract ("each person's net position" implies
  full group coverage) — criterion 6.
- **Conservation invariant**: because each expense's shares are
  constructed via `divmod` to sum to exactly `amount_cents`, and the
  payer's credit for that expense is also exactly `amount_cents`, the sum
  of all people's `net_cents` across all expenses is always exactly `0` —
  criterion 10 verifies this holds in aggregate across multiple expenses,
  not just per-expense.
- **Negative zero**: `net_cents` values are plain Python `int`s (no signed
  zero), and `Decimal(0) / 100` renders as `Decimal("0.00")`, so a
  perfectly offsetting balance always serializes as `0.0`, never `-0.0`.
- **Amount with more than 2 decimal places already in storage**: possible
  today because #12's `ExpenseWrite.amount` has no decimal-place
  constraint and #10's `Numeric(10, 2)` column isn't enforced by SQLite —
  handled defensively by quantizing to the nearest cent
  (`ROUND_HALF_UP`) before splitting (Scope item 4, criterion 13), rather
  than by this issue changing #12's validation.
- **Deleting or editing an expense**: since `GET /balances` recomputes
  from current `Expense`/`expense_participants` rows on every call (no
  caching), a delete or edit is reflected on the very next call with no
  extra invalidation logic needed (criteria 11, 12).
- **Large participant counts or many expenses**: the algorithm is a single
  pass over all `Expense` rows with O(participants) work per expense — no
  performance concern at the scale of a personal expense splitter; no
  pagination or batching is added.

## Constraints

- No new dependency is added to `backend/pyproject.toml` —
  `decimal.Decimal`/`ROUND_HALF_UP` are Python stdlib; everything else
  needed (`fastapi`, `sqlalchemy`) is already declared by #8.
- Field names and the route path are `snake_case`/exact per #1's contract
  (`GET /balances` → array of `Balance` with `person_id`, `name`,
  `balance`) — no alias configuration needed.
- All money arithmetic inside `_compute_balances` uses `decimal.Decimal`
  in integer-cent form, matching #10/#12's rationale for avoiding
  binary-floating-point drift in currency sums; `float` conversion happens
  only at the final schema-construction step (Scope item 4), same pattern
  as #12's `amount` boundary conversion.
- The router stays close to #11/#12's "thin" precedent — request
  handling and persistence via `get_db` — with `_compute_balances` as the
  one piece of aggregation logic this issue adds, kept as a module-level
  function in `api/balances.py` rather than a new `services/` package
  (see "Out of scope").
- Per `_docs/testing-guidelines.md`, this is "backend logic": the failing
  pytest cases (Scope item 5) are written against these acceptance
  criteria before/alongside the route implementation, in
  `backend/tests/test_balances.py` per the guideline document's naming
  convention.
- No SQLAlchemy model file or Alembic migration is modified or added by
  this issue.

## Open questions

- **Remainder-distribution direction**: assumed leftover cents go to the
  lowest-id participants first (Scope item 4), matching #12's
  sorted-ascending `participant_ids` convention for determinism. A human
  could reasonably prefer a different rule (e.g. always crediting the
  extra cent to the payer, or rotating which participant absorbs it across
  expenses to avoid always favoring low ids over time). Flag if a
  different convention is intended — it changes the exact cent-level
  output asserted in criterion 8 but not the overall conservation
  invariant (criterion 10), which holds under any per-expense-exact
  distribution rule.
- **Rounding mode for the defensive cents-quantization step**: assumed
  `ROUND_HALF_UP` (Scope item 4, criterion 13) rather than Python's
  default `ROUND_HALF_EVEN` ("banker's rounding"), matching typical
  currency conventions and #12's existing `Decimal(str(amount))`
  boundary-conversion note. This only matters for the rare case of a
  stored `amount` whose third decimal digit is exactly `5`. Flag if
  banker's rounding was intended instead.
- **Whether #12 should be tightened instead**: this issue defensively
  rounds an over-precise `amount` at read time rather than rejecting it at
  write time in #12. Since #12 is already groomed and spec-frozen, this
  spec treats that as out of scope here (see "Out of scope") rather than
  reopening #12; flag if closing the gap at the source is preferred, which
  would need a separate follow-up issue against #12.

None of the above block implementation — each has a stated default in
Scope/Acceptance criteria above — but they should be confirmed before
work starts, since the remainder-distribution and rounding-mode choices
are observable in specific test assertions (criteria 8 and 13) that a
different choice would change.
