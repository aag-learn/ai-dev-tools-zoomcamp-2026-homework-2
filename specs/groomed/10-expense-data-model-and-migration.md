---
issue: 10
label: groomed
---

# Expense data model and migration

## Summary

Add the SQLAlchemy `Expense` model (`id`, `description`, `amount`,
`payer_id` FK to `people.id`, `date`, and `participants` as a many-to-many
join to `Person` via a new `expense_participants` association table) to
`backend/src/app/models/`, plus its Alembic migration creating the
`expenses` and `expense_participants` tables. This is the second model
built on top of #8's scaffold, chaining directly after #9's `people`
migration; #12 (expense endpoints) and #13 (balances) build on top of it.

**Note on dependencies:** `openapi/openapi.yaml` (#1), `backend/` (#8),
and the `Person` model/migration (#9) are all groomed but not yet
implemented in this repo. This spec describes the target shape by reading
those specs' content directly — `specs/groomed/1-define-openapi-contract.md`
for the exact `Expense`/`ExpenseWrite` schema, `specs/groomed/8-scaffold-backend-project.md`
for the `backend/src/app/{models,db,core}` layout and Alembic batch-mode
setup, `specs/groomed/9-person-data-model-and-migration.md` for the
`people` table's exact shape (`id` integer PK, `name` `VARCHAR(100)`), and
`specs/groomed/9-person-data-model-and-migration.notes.md` for the
test-file convention #9 actually landed on (`backend/tests/models/`,
overriding that spec's own original flat-file default) — it does not
assume any of them is already running. Implementation of this issue should start once
#9 actually lands, not before, since this migration's `down_revision`
chains onto #9's revision.

## Scope

1. `backend/src/app/models/expense.py` — a SQLAlchemy declarative model
   plus its association table:
   ```python
   from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, Table
   from sqlalchemy.orm import relationship

   from app.db.base import Base

   expense_participants = Table(
       "expense_participants",
       Base.metadata,
       Column("expense_id", ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True),
       Column("person_id", ForeignKey("people.id"), primary_key=True),
   )

   class Expense(Base):
       __tablename__ = "expenses"

       id = Column(Integer, primary_key=True, autoincrement=True)
       description = Column(String(200), nullable=False)
       amount = Column(Numeric(10, 2), nullable=False)
       payer_id = Column(Integer, ForeignKey("people.id"), nullable=False)
       date = Column(Date, nullable=False)

       payer = relationship("Person", foreign_keys=[payer_id])
       participants = relationship("Person", secondary=expense_participants)
   ```
   - Inherits from `app.db.base.Base` (per #8's `db/base.py`), same as
     `Person`.
   - Table name is `expenses` (plural, matching the `/expenses` resource
     in the contract and `people`'s precedent from #9), not `expense`.
   - `description`'s `String(200)` and `amount`'s `Numeric(10, 2)` mirror
     the contract's `ExpenseWrite.description` (`maxLength: 200`) and
     `.amount` (currency, 2 decimal places) — see "Edge cases considered"
     for what these do and don't enforce at the DB layer, matching #9's
     precedent for `Person.name`.
   - `amount` uses `Numeric(10, 2)` (fixed-point), not `Float`, so currency
     values round-trip exactly through SQLite and Postgres alike — a
     `Float` column risks binary floating-point drift on repeated
     read/write, which `Numeric` avoids regardless of engine (see "Open
     questions" for the precision/scale choice).
   - `date` uses SQLAlchemy's `Date` type (date-only, no time component),
     matching the contract's `format: date`.
   - `payer_id` is a plain foreign key column (not part of the
     association table) — one expense has exactly one payer.
   - `participants` is the many-to-many side, expressed via the
     `expense_participants` association table: composite primary key
     (`expense_id`, `person_id`) with no separate surrogate `id` column,
     which also makes a duplicate participant row for the same expense
     impossible at the DB layer (the contract's `uniqueItems: true` is
     still enforced by Pydantic in #12; this is a side benefit, not a
     substitute).
   - `expense_participants.expense_id` declares `ondelete="CASCADE"` so
     deleting an `Expense` row also removes its participant-join rows at
     the database level, regardless of whether #12's delete endpoint
     issues an ORM `session.delete()` (which SQLAlchemy would otherwise
     cascade in Python) or a bulk/raw delete. `expense_participants.person_id`
     and `expenses.payer_id` have no `ondelete` clause (default
     restrict/no-action) — people are never deleted in v1 (#1's contract
     defines no delete-person endpoint), so no cascade path from a person
     deletion is needed.
   - Both relationships (`payer`, `participants`) are declared only on
     `Expense`, pointing at `Person` by string reference
     (`relationship("Person", ...)`). `backend/src/app/models/person.py`
     (from #9) is **not modified** — no `back_populates`/`backref` is
     added to `Person`, since nothing in the current API surface (#11–#13)
     needs to navigate from a `Person` instance to their expenses; #12/#13
     query the `Expense`/`expense_participants` tables directly.
2. `backend/src/app/models/__init__.py` (currently imports only `Person`,
   per #9) — extended to also import `Expense`:
   ```python
   from app.models.expense import Expense
   from app.models.person import Person

   __all__ = ["Expense", "Person"]
   ```
   This registers `Expense`'s table and the `expense_participants`
   association table on `Base.metadata` as a side effect of importing the
   package, alongside `Person`.
3. No change to `backend/alembic/env.py` — #9 already added
   `import app.models` before `target_metadata` is used; since
   `app/models/__init__.py` now also imports `Expense` (which defines
   `expense_participants` on the same `Base.metadata`), Alembic picks up
   both new tables automatically without any further edit to `env.py`.
4. One new file under `backend/alembic/versions/` — the second revision,
   with `down_revision` set to #9's "create people table" revision's id
   (whatever id it lands with — not `None`, since it's no longer the first
   migration), generated via `uv run alembic revision --autogenerate -m
   "create expenses and expense_participants tables"` (or written by hand
   to the same effect) whose:
   - `upgrade()` creates the `expenses` table (`id` integer PK
     auto-increment; `description` `VARCHAR(200) NOT NULL`; `amount`
     `NUMERIC(10, 2) NOT NULL`; `payer_id` integer `NOT NULL` with a
     foreign key to `people.id`; `date` `DATE NOT NULL`), then creates the
     `expense_participants` table (`expense_id` integer, foreign key to
     `expenses.id` with `ON DELETE CASCADE`; `person_id` integer, foreign
     key to `people.id`; composite primary key on both columns).
   - `downgrade()` drops `expense_participants` first, then `expenses`
     (reverse creation order, since `expense_participants` has FKs into
     `expenses`).
   - Uses plain `op.create_table(...)` calls for both tables, not
     `op.batch_alter_table(...)` — same reasoning as #9's migration:
     batch mode (already configured globally in #8's `env.py`) is a
     workaround for SQLite's weak `ALTER TABLE` support, and creating
     brand-new tables needs no `ALTER TABLE`.
5. A backend test file, `backend/tests/models/test_expense_model.py`
   (under the `backend/tests/models/` subdirectory, matching #9's
   `backend/tests/models/test_person_model.py` — the human maintainer
   overrode #9's spec's original flat-file default before #9 was
   implemented, specifically anticipating this sibling file; see #9's
   implementation notes, `specs/groomed/9-person-data-model-and-migration.notes.md`,
   for the resolution — #9's "Open questions" section only records the
   spec's original proposed default, not the final decision), using the
   per-test isolated-database fixture from #8's `conftest.py`:
   - Asserts that inserting an `Expense` with a `payer` (a `Person`) and
     two `participants` (two more `Person` rows, which may or may not
     include the payer) persists it with an auto-assigned integer `id`,
     and that `amount` round-trips exactly as a 2-decimal value (e.g.
     `Decimal("12.50")`) after a commit + re-fetch.
   - Asserts that `expense.payer` resolves to the correct `Person` and
     `expense.participants` resolves to the correct set of `Person` rows,
     via the relationships defined in Scope item 1.
   - Asserts that the same `Person` can be both the `payer` and one of the
     `participants` of the same `Expense` (no constraint prevents this —
     see "Edge cases considered").
   - Asserts that deleting an `Expense` (via `session.delete(expense)` +
     commit) removes its rows from `expense_participants` but leaves the
     referenced `Person` rows untouched.
   - This test is scoped to the model/table only — it does not go through
     any API route or Pydantic schema (`POST`/`PUT`/`DELETE /expenses`
     request-level behavior is #12's test coverage, not this issue's).

## Out of scope

- The `POST`, `GET`, `PUT`, `DELETE /expenses` FastAPI routes and their
  Pydantic `Expense`/`ExpenseWrite` schemas — issue #11/#12 (people and
  expense endpoints respectively). This issue only makes the `expenses`
  and `expense_participants` tables exist; nothing reads or writes them
  over HTTP yet.
- The `GET /balances` computation — issue #13, which reads `Expense`
  rows once they exist but implements no logic here.
- Enforcing `minLength`/`maxLength` string bounds, `exclusiveMinimum: 0`
  on `amount`, or `minItems: 1`/`uniqueItems: true` on participants at the
  database layer — the contract (#1) assigns these rules to Pydantic
  schema validation (#12), which runs identically against SQLite and
  Postgres; DB-level `CHECK` constraints for these would be redundant and
  are not added. (The composite primary key on `expense_participants` is
  an incidental DB-level de-duplication side effect, not a stand-in for
  `uniqueItems` validation — see Scope item 1.)
- Referential-integrity validation of `payer_id`/`participant_ids`
  against existing people (the contract's `400` response) — that's
  application-level logic in #12, not something this model or migration
  enforces beyond the FK constraints themselves (which reject an
  outright-nonexistent id at the DB layer, but with a DB-level error, not
  the contract's structured `400`/`Error` response).
- Adding a `back_populates`/`backref` on `Person` pointing back to
  `Expense` — not needed by any issue currently groomed (#11–#13); if a
  future feature needs "all expenses a person is involved in" navigated
  from a `Person` instance, that's a follow-up change to `person.py`, not
  part of this issue.
- Cascading a person's deletion into their expenses — moot, since no
  person-delete endpoint exists in the contract (#1) or is planned; the
  lack of `ondelete` on `payer_id`/`expense_participants.person_id`
  reflects that, not an oversight.
- Seed data / fixtures with sample expenses — not requested; each test
  creates its own rows via the isolated-database fixture.

## Acceptance criteria

1. `backend/src/app/models/expense.py` defines an `Expense` class
   inheriting from `app.db.base.Base`, with `__tablename__ = "expenses"`,
   and an `expense_participants` `Table` object registered on the same
   `Base.metadata`.
2. `Expense` has exactly these columns: `id` (`Integer`, primary key,
   auto-increment), `description` (`String(200)`, `nullable=False`),
   `amount` (`Numeric(10, 2)`, `nullable=False`), `payer_id` (`Integer`,
   `ForeignKey("people.id")`, `nullable=False`), `date` (`Date`,
   `nullable=False`). No other columns.
3. `Expense.payer` is a `relationship` resolving to the `Person` referenced
   by `payer_id`. `Expense.participants` is a `relationship` to `Person`
   via `secondary=expense_participants`, resolving to the set of `Person`
   rows joined through that table.
4. `expense_participants` has exactly two columns, `expense_id` (foreign
   key to `expenses.id`, `ondelete="CASCADE"`) and `person_id` (foreign
   key to `people.id`, no `ondelete`), forming a composite primary key
   with no separate surrogate `id` column.
5. `backend/src/app/models/person.py` is unchanged by this issue — no
   `relationship`/`back_populates`/`backref` is added to `Person`.
6. `backend/src/app/models/__init__.py` imports both `Person` and
   `Expense` such that `from app.models import Expense, Person` succeeds.
7. `backend/alembic/env.py` is unchanged by this issue (still just the
   `import app.models` line from #9, unmodified).
8. Exactly one new file exists under `backend/alembic/versions/` beyond
   #9's single migration (two total after this issue), with
   `down_revision` equal to #9's revision id (not `None`), whose
   `upgrade()` creates the `expenses` table then the `expense_participants`
   table, and whose `downgrade()` drops `expense_participants` then
   `expenses`.
9. `cd backend && uv run alembic upgrade head` exits `0` against a fresh
   `DATABASE_URL` seeded with #9's migration already applied (e.g. a
   throwaway SQLite file with both migrations run in sequence), after
   which both `expenses` and `expense_participants` tables exist with the
   columns described in criteria 2 and 4 — checkable via
   `sqlite3 <db file> ".schema expenses"` /
   `".schema expense_participants"` or
   `sqlalchemy.inspect(engine).get_columns(...)` /
   `get_foreign_keys(...)` for each table.
10. `cd backend && uv run alembic downgrade -1` (from `head`, i.e.
    undoing just this issue's migration) exits `0`, after which
    `expense_participants` and `expenses` no longer exist but `people`
    (from #9) still does.
11. Immediately after `alembic upgrade head`, running `uv run alembic
    revision --autogenerate -m "check"` produces an empty migration (no
    `op.` calls in its `upgrade()`/`downgrade()` beyond `pass`) — confirms
    `Base.metadata` (via the extended `app.models` import) matches the two
    migrations exactly. This check-revision file is deleted afterward and
    not committed.
12. The new revision's `upgrade()` uses `op.create_table(...)` directly
    for both tables, not `op.batch_alter_table(...)`.
13. `backend/tests/models/test_expense_model.py` exists and contains the four
    assertions described in Scope item 5 (auto-assigned `id` + exact
    2-decimal `amount` round-trip; `payer`/`participants` relationship
    resolution; same person as both payer and participant; cascade
    delete of `expense_participants` rows without deleting `Person` rows).
14. `cd backend && uv run pytest` runs the full suite (including the new
    test file and everything from #8/#9) with every test passing.
15. No FastAPI router, Pydantic schema, or balances-computation logic is
    added by this change.

## Edge cases considered

- **`amount` precision/rounding**: `Numeric(10, 2)` stores exactly 2
  decimal places at the DB layer (up to 8 integer digits, i.e. amounts
  under 100,000,000), matching the contract's "rounded to 2 decimal
  places" note on `ExpenseWrite.amount`. Values with more than 2 decimal
  places are the API/Pydantic layer's concern (#12) to reject or round
  before they reach this model — this model's column type doesn't itself
  reject a 3-decimal input at the SQLAlchemy layer (SQLite in particular
  won't error; Postgres may round depending on driver), so #12 must not
  rely on the DB to enforce 2-decimal precision.
- **`Float` vs `Numeric` for currency**: `Float`/`Double` risk
  representing e.g. `10.10` as a value that doesn't compare exactly equal
  after a round-trip, which matters for a balances calculation (#13)
  summing many rows. `Numeric` (fixed-point) avoids this on both SQLite
  and Postgres, keeping behavior database-agnostic per
  `_docs/architecture.md`.
- **Same person as payer and participant**: allowed and expected — a
  common real case (e.g. Alice pays for a lunch she also eats). Nothing
  in the schema (Scope item 1) prevents `payer_id` from also appearing as
  a `person_id` row in `expense_participants` for the same `expense_id`.
- **Deleting an expense**: `expense_participants.expense_id`'s
  `ondelete="CASCADE"` ensures the join rows disappear together with the
  `Expense` row regardless of how #12 implements the delete (ORM object
  delete vs. a bulk/raw `DELETE`), so #12 doesn't need to remember to
  clean up `expense_participants` manually. `Person` rows referenced by
  the deleted expense are never touched.
- **A `payer_id`/`participant_ids` value with no matching person**: at
  the DB layer, the `ForeignKey` constraint rejects an outright-invalid
  id — but only if the underlying engine enforces foreign keys (Postgres
  does by default; SQLite does not unless `PRAGMA foreign_keys=ON` is
  set, which is not part of this issue's scope). The contract's `400`
  response for this case (#1) is application-level validation added in
  #12, not something this model guarantees uniformly across engines by
  itself.
- **Duplicate `participant_ids` for the same expense**: impossible to
  represent at the DB layer since `expense_participants`'s primary key is
  the pair (`expense_id`, `person_id`) — a second insert of the same pair
  raises an integrity error. This is a side effect of the composite key
  design, not a deliberate substitute for the contract's `uniqueItems`
  validation (still #12's job to reject before the DB is touched).
- **Migration ordering**: this migration's `down_revision` must point at
  #9's actual revision id once #9 is implemented — if #9's migration
  hasn't landed yet when this issue starts, `alembic revision
  --autogenerate` has nothing to chain onto and will either fail or
  (wrongly) generate a first migration with `down_revision = None`; this
  is why implementation is gated on #9 landing first (see "Note on
  dependencies").

## Constraints

- Migration must be batch-mode-compatible per `_docs/architecture.md`
  (checked in review), but as with #9, this specific migration doesn't
  need `op.batch_alter_table` since it only creates new tables — the
  constraint is about not breaking batch mode for later migrations that
  alter `expenses`/`expense_participants`, not about wrapping this one
  unnecessarily.
- Table names are `expenses` and `expense_participants` — matching the
  `/expenses` path and `people`'s pluralization precedent from #9.
- No dependency is added to `backend/pyproject.toml` by this issue — the
  packages needed (`sqlalchemy`, `alembic`) are already declared by #8.
- Model file lives at `backend/src/app/models/expense.py` (one file per
  model, matching #9's `person.py` precedent and
  `_docs/architecture.md`'s `models/` layout description); the
  association table is defined in the same file since it belongs
  conceptually to `Expense`, not as a separate model of its own.
- `backend/src/app/models/person.py` and `backend/alembic/env.py` are not
  modified by this issue (see Scope items 1 and 3, and acceptance
  criteria 5 and 7) — everything this issue needs is achieved by adding
  `expense.py` and extending `models/__init__.py`.

## Open questions

- **`Numeric(10, 2)` precision/scale**: assumed 8 integer digits + 2
  decimal places (max ~$99,999,999.99) as a generously large bound for a
  personal expense-splitter; the contract (#1) doesn't specify a maximum
  `amount`. Flag if a different precision is wanted — this is a one-line
  change with no other effect on the schema.
- **`ondelete="CASCADE"` on `expense_participants.expense_id`**: assumed,
  so #12's delete endpoint doesn't need to explicitly clean up
  association rows regardless of whether it deletes via the ORM or a raw
  query. A human could instead prefer relying purely on SQLAlchemy's
  ORM-level cascade behavior for `secondary=` relationships (which only
  fires when `session.delete()` is used on a loaded object, not on a bulk
  delete) and skip the DB-level `ondelete` clause. Flagged since it's a
  data-model decision that #12 will build on top of without revisiting.
  Assumed the DB-level cascade since it's engine-enforced and doesn't
  depend on #12's eventual delete implementation choice.
- **No `back_populates` on `Person`**: assumed unidirectional
  relationships (`Expense.payer`, `Expense.participants`) are sufficient
  since #11–#13 (the only currently-groomed consumers) query
  `Expense`/`expense_participants` directly rather than navigating from a
  loaded `Person` object. Flag if #13's balances computation is expected
  to use `person.expenses`-style navigation instead of a direct query —
  that would mean adding `back_populates` here rather than as a later
  patch to `person.py`.
- **Migration file naming/id**: like #9, this issue allows either
  `alembic revision --autogenerate` or a hand-written migration, as long
  as the resulting `upgrade()`/`downgrade()` match criteria 8–12. Left as
  an implementer's choice.
