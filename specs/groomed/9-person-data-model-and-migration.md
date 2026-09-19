---
issue: 9
label: groomed
---

# Person data model and migration

## Summary

Add the SQLAlchemy `Person` model (`id`, `name`) to `backend/src/app/models/`
and its initial Alembic migration, creating the `people` table. This is the
first model built on top of #8's scaffold and the first migration in
`backend/alembic/versions/`; #10 (`Expense`) will add a foreign key to this
table once it exists.

**Note on dependencies:** `openapi/openapi.yaml` (#1) and `backend/`
(#8) are both groomed but not yet implemented in this repo. This spec
describes the target shape by reading those specs' content directly
(`specs/groomed/1-define-openapi-contract.md` for the `Person`/`PersonCreate`
schema, `specs/groomed/8-scaffold-backend-project.md` for the
`backend/src/app/{models,db,core}` layout and Alembic batch-mode setup) —
it does not assume either is already running. Implementation of this issue
should start once #8 actually lands, not before.

## Scope

1. `backend/src/app/models/person.py` — a SQLAlchemy declarative model:
   ```python
   class Person(Base):
       __tablename__ = "people"

       id = Column(Integer, primary_key=True, autoincrement=True)
       name = Column(String(100), nullable=False)
   ```
   - Inherits from `app.db.base.Base` (per #8's `db/base.py`).
   - Table name is `people` (plural, matching the `/people` resource in
     the contract), not `person`.
   - `name`'s `String(100)` mirrors the contract's `PersonCreate.name`
     `maxLength: 100` (see "Edge cases considered" for what this does and
     doesn't enforce). There is no DB-level minimum-length constraint;
     `minLength: 1` is enforced by the Pydantic schema in #11, not here.
   - No relationship/back-reference to `Expense` is declared — `Expense`
     doesn't exist yet (#10 adds the FK from `expenses` to `people.id` and
     the corresponding `relationship()` on both sides).
2. `backend/src/app/models/__init__.py` (currently an empty placeholder
   per #8) — imports `Person`:
   ```python
   from app.models.person import Person

   __all__ = ["Person"]
   ```
   This registers `Person`'s table on `Base.metadata` as a side effect of
   importing the package.
3. `backend/alembic/env.py` — add an import of `app.models` (e.g.
   `import app.models  # noqa: F401 - registers models on Base.metadata`)
   before `target_metadata` is used, so Alembic's autogenerate/upgrade
   machinery sees the `people` table. #8 sets `target_metadata =
   Base.metadata` but never imports anything under `app.models` (there
   were no models yet); without this import, `Base.metadata` would be
   empty regardless of what's defined in `models/person.py`.
4. One new file under `backend/alembic/versions/` — the initial revision
   (`down_revision = None`), generated via `uv run alembic revision
   --autogenerate -m "create people table"` (or written by hand to the
   same effect) whose:
   - `upgrade()` creates the `people` table with an `id` integer primary
     key (auto-increment) and a `name` `VARCHAR(100) NOT NULL` column.
   - `downgrade()` drops the `people` table.
   - Uses a plain `op.create_table(...)` call, not
     `op.batch_alter_table(...)` — batch mode (already configured
     globally in #8's `env.py` via `render_as_batch=True`) is a workaround
     for SQLite's weak `ALTER TABLE` support; creating a brand-new table
     needs no `ALTER TABLE` and so needs no batch wrapper. Batch mode
     starts to matter once a migration alters an *existing* table (e.g. a
     future migration adding a column), not this one.
5. A backend test file, `backend/tests/models/test_person_model.py`
   (under a `tests/models/` subdirectory — see "Open questions" below for
   why this location was chosen over this spec's original flat-file
   default), using the per-test isolated-database fixture from #8's
   `conftest.py`:
   - Asserts that inserting a `Person(name="Alice")` via a SQLAlchemy
     session persists it with an auto-assigned integer `id` and
     `name == "Alice"` after a commit + re-fetch.
   - Asserts that two people can be created with the same `name` (no
     uniqueness constraint — see "Edge cases considered").
   - This test is scoped to the model/table only — it does not go through
     any API route or Pydantic schema (`POST`/`GET /people` request-level
     behavior is #11's test coverage, not this issue's).

## Out of scope

- The `Expense` SQLAlchemy model, its migration, and the FK/association
  table linking it to `Person` — issue #10, which depends on this one.
- The `POST /people` and `GET /people` FastAPI routes and their Pydantic
  `Person`/`PersonCreate` schemas — issue #11. This issue only makes the
  `people` table exist; nothing reads or writes it over HTTP yet.
- Enforcing `minLength: 1` (non-blank name) at the database layer (e.g. a
  `CHECK` constraint) — the contract (#1) assigns this rule to schema
  validation (Pydantic, in #11), which runs identically against SQLite and
  Postgres; a DB-level `CHECK` would be redundant and is not added.
- A uniqueness constraint on `name` — the contract explicitly allows
  duplicate person names (see #1's "Edge cases considered"); no `UNIQUE`
  index is added.
- Deleting or editing a person (no such endpoint exists in the contract) —
  nothing about lifecycle beyond insert is relevant to this model.
- Seed data / fixtures with sample people — not requested; each test
  creates its own rows via the isolated-database fixture.

## Acceptance criteria

1. `backend/src/app/models/person.py` defines a `Person` class inheriting
   from `app.db.base.Base`, with `__tablename__ = "people"`.
2. `Person` has exactly two columns: `id` (`Integer`, primary key,
   auto-increment) and `name` (`String(100)`, `nullable=False`). No other
   columns, and no `relationship()` to any other model.
3. `backend/src/app/models/__init__.py` imports `Person` such that `from
   app.models import Person` succeeds.
4. `backend/alembic/env.py` imports `app.models` (or equivalent, e.g.
   `from app import models`) before `target_metadata` is referenced —
   checkable via `grep -n 'import.*models' backend/alembic/env.py`
   returning a match, positioned before the `target_metadata = ...` line.
5. Exactly one new file exists under `backend/alembic/versions/` (zero
   existed after #8), with `down_revision = None` (it's the first
   migration), whose `upgrade()` creates a `people` table and whose
   `downgrade()` drops it.
6. `cd backend && uv run alembic upgrade head` exits `0` against a fresh
   `DATABASE_URL` (e.g. a throwaway SQLite file), after which the `people`
   table exists with columns `id` (integer, primary key) and `name`
   (`VARCHAR(100)`, not null) — checkable via `sqlite3 <db file> ".schema
   people"` or `sqlalchemy.inspect(engine).get_columns("people")`.
7. `cd backend && uv run alembic downgrade base` exits `0` against that
   same database and the `people` table no longer exists afterward.
8. Immediately after `alembic upgrade head`, running `uv run alembic
   revision --autogenerate -m "check"` produces an empty migration (no
   `op.` calls in its `upgrade()`/`downgrade()` beyond `pass`) — confirms
   `Base.metadata` (via the `app.models` import) matches the migration
   exactly. This check-revision file is deleted afterward and not
   committed.
9. The `upgrade()` function of the new revision uses `op.create_table(...)`
   directly, not `op.batch_alter_table(...)`.
10. `backend/tests/models/test_person_model.py` exists and contains the two
    assertions described in Scope item 5 (auto-assigned `id` +
    round-tripped `name`; duplicate names both persist without error).
11. `cd backend && uv run pytest` runs the full suite (including the new
    test file and everything from #8) with every test passing.
12. No `Expense` model, migration, router, Pydantic schema, or test is
    added by this change.

## Edge cases considered

- **SQLite doesn't enforce `VARCHAR(n)` length**: SQLite accepts a string
  longer than 100 characters in a `VARCHAR(100)` column regardless of the
  declared length (unlike Postgres, which truncates/errors depending on
  mode). `String(100)` is still declared here for documentation and
  Postgres-parity, but real enforcement of the contract's `maxLength: 100`
  happens in Pydantic (#11), which behaves identically on both database
  engines — this is consistent with `_docs/architecture.md`'s
  database-agnostic guarantee (no behavior should depend on which engine
  is running).
- **Duplicate person names**: allowed, per #1's contract — no `UNIQUE`
  constraint on `name`, and criterion 10 explicitly tests that two rows
  with the same name both persist.
- **Blank/empty `name` at the DB layer**: `nullable=False` rejects `NULL`,
  but does not reject an empty string `""` — that's `minLength: 1`'s job,
  enforced by Pydantic in #11, not by this model.
- **Autogenerate producing a non-empty diff (criterion 8)**: if the
  `app.models` import in `alembic/env.py` is missing or the migration
  doesn't match the model, `alembic revision --autogenerate` will detect a
  spurious "create people table" or column-mismatch diff even after
  `upgrade head` — this is precisely the failure mode criterion 4/8 guard
  against, since #8's `env.py` has no reason yet to import anything under
  `app.models`.
- **Future FK from `Expense`**: `people.id` needs to already exist as an
  autoincrementing integer primary key before #10 can declare a foreign
  key to it — this issue's `id` column definition is what #10 depends on;
  no forward-reference or placeholder is needed here since #10 adds the
  referencing column, not this one.

## Constraints

- Migration must be batch-mode-compatible per `_docs/architecture.md`
  (checked in review), but as noted in Scope item 4, this specific
  migration doesn't need `op.batch_alter_table` since it only creates a
  table — the constraint is about not breaking batch mode for later
  migrations, not about wrapping this one unnecessarily.
- Table name is `people`, not `person` or `persons` — matches the `/people`
  path and collection semantics used throughout #1's contract.
- No dependency is added to `backend/pyproject.toml` by this issue — the
  packages needed (`sqlalchemy`, `alembic`) are already declared by #8.
- Model file lives at `backend/src/app/models/person.py` (one file per
  model, matching `_docs/architecture.md`'s `models/` layout description
  and #10's plan to add a sibling `models/expense.py`).

## Open questions

- **Test file location — RESOLVED**: this spec's original default was a
  flat `backend/tests/test_person_model.py` (matching #8's `test_main.py` /
  `test_config.py` naming), since neither `_docs/testing-guidelines.md` nor
  #8's spec established a subdirectory convention for model-level tests
  (only `backend/tests/contract/` is named, for #14). Before implementation
  started, the human maintainer overrode this default and chose a
  `backend/tests/models/` subdirectory instead, anticipating #10's sibling
  `test_expense_model.py`. The implementation (PR #22) used
  `backend/tests/models/test_person_model.py` accordingly, and this
  resolution is documented in
  `specs/groomed/9-person-data-model-and-migration.notes.md` (not in this
  section, which only records the original proposed default). #10's spec
  follows the same `backend/tests/models/` convention for
  `test_expense_model.py`.
- **Autogenerate vs. hand-written migration**: Scope item 4 allows either
  `alembic revision --autogenerate` or a hand-written migration file, as
  long as the resulting `upgrade()`/`downgrade()` match criteria 5–9. This
  is an implementation detail with no observable difference once merged,
  so left as an implementer's choice rather than dictated.
