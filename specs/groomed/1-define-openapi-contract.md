---
issue: 1
label: groomed
---

# Define OpenAPI contract for v1 endpoints

## Summary

Write `openapi/openapi.yaml`, a hand-authored OpenAPI 3.0.3 document
covering every endpoint the v1 expense-splitter scope
(`specs/features/expense-splitter-poc.md`) requires: people, expenses, and
balances. Per `_docs/architecture.md`, this file is the single source of
truth both sides are built against — nothing in phase 2 (frontend) or
phase 3 (backend) starts until this is settled, so every endpoint, schema,
status code, and field name below is final unless a human overrides it in
"Open questions."

## Scope

The document declares `openapi: 3.0.3`, an `info` block (title, version —
e.g. `1.0.0`), and no `security` scheme anywhere (v1 has no auth, per the
feature scope). All JSON field names are `snake_case` (matches Pydantic
models directly, no alias mapping needed on the backend).

### Paths and operations (8 total)

1. **`POST /people`** — add a person.
   - Request body: `PersonCreate`.
   - `201` → `Person`.
   - `422` → `HTTPValidationError` (e.g. missing/blank `name`).
2. **`GET /people`** — list all people.
   - `200` → array of `Person`, ordered by `id` ascending (insertion
     order).
3. **`POST /expenses`** — add an expense, split equally among
   `participant_ids`.
   - Request body: `ExpenseWrite`.
   - `201` → `Expense`.
   - `422` → `HTTPValidationError` (e.g. `amount <= 0`, empty
     `participant_ids`, missing field, wrong type).
   - `400` → `Error` (e.g. `payer_id` or any id in `participant_ids` does
     not match an existing person — a cross-entity check the JSON schema
     alone can't express).
4. **`GET /expenses`** — list all expenses, most recent first.
   - `200` → array of `Expense`, ordered by `date` descending, then `id`
     descending as a tiebreak for same-date expenses.
5. **`PUT /expenses/{expense_id}`** — edit an expense. Full replace: the
   request body is the complete new state (same shape as create), not a
   partial patch.
   - Request body: `ExpenseWrite`.
   - `200` → `Expense` (updated).
   - `404` → `Error` (`expense_id` doesn't exist).
   - `422` → `HTTPValidationError` (same field-level rules as create).
   - `400` → `Error` (same referential-integrity rule as create).
6. **`PATCH /expenses/{expense_id}`** — partially edit an expense. Every
   field in the request body is optional; only the fields present in the
   body are updated, all others keep their currently stored value. This is
   a distinct operation from `PUT`, not a variant of it — see "Edit
   semantics" resolution below.
   - Request body: `ExpensePatch`.
   - `200` → `Expense` (updated, full resource returned — same as `PUT`).
   - `404` → `Error` (`expense_id` doesn't exist).
   - `422` → `HTTPValidationError` (same field-level rules as create, but
     only applied to fields actually present in the body — e.g. an
     omitted `amount` isn't checked against `exclusiveMinimum: 0`, but a
     provided `amount: 0` still is).
   - `400` → `Error` (same referential-integrity rule as create/`PUT`,
     applied only to `payer_id`/`participant_ids` if provided).
7. **`DELETE /expenses/{expense_id}`** — delete an expense.
   - `204` → no body.
   - `404` → `Error` (`expense_id` doesn't exist).
8. **`GET /balances`** — each person's net position.
   - `200` → array of `Balance`, one entry per person currently in the
     group (including people with zero expenses), ordered by `person_id`
     ascending. Positive `balance` = net owed to them; negative = they net
     owe; `0` = settled. The exact remainder-distribution rule for amounts
     that don't split evenly (e.g. $10.00 / 3) is business logic for the
     balances-endpoint implementation (issue #13), not this contract —
     this contract only fixes the response shape (a number, rounded to 2
     decimal places).

No other paths exist: no `GET /people/{id}`, no `GET /expenses/{id}`, no
health-check route (see "Out of scope").

### Schemas (`components/schemas`)

- **`Person`**: `id` (integer, `readOnly`), `name` (string, `minLength: 1`,
  `maxLength: 100`). Both required in the response.
- **`PersonCreate`**: `name` (string, `minLength: 1`, `maxLength: 100`,
  required). Request body only — no `id`.
- **`Expense`**: `id` (integer, `readOnly`), `description` (string,
  `minLength: 1`, `maxLength: 200`), `amount` (number, `exclusiveMinimum:
  0`; represents currency rounded to 2 decimal places — documented via the
  schema `description` field, not enforced with `multipleOf` because of
  known floating-point/JSON-Schema interaction issues), `payer_id`
  (integer), `date` (string, `format: date`, i.e. `YYYY-MM-DD`),
  `participant_ids` (array of integer, `minItems: 1`, `uniqueItems: true`).
  All required in the response.
- **`ExpenseWrite`**: same fields as `Expense` minus `id` — this is the
  request body for both create (`POST /expenses`) and full-replace edit
  (`PUT /expenses/{expense_id}`). All fields required (there is no
  API-level "default participants to everyone" behavior; that's a frontend
  form concern per issue #6 — the API always requires an explicit,
  non-empty `participant_ids`).
- **`ExpensePatch`**: same fields as `ExpenseWrite`
  (`description`/`amount`/`payer_id`/`date`/`participant_ids`), but every
  field is optional — this is the request body for `PATCH
  /expenses/{expense_id}` only. Field-level constraints
  (`minLength`/`maxLength`/`exclusiveMinimum`/`format: date`/`minItems`/
  `uniqueItems`) are identical to `ExpenseWrite`'s per-field rules and
  still apply whenever a field is present in the body; a request body of
  `{}` (no fields) is valid and is a no-op update (`200` with the
  unchanged `Expense`, not an error).
- **`Balance`**: `person_id` (integer), `name` (string), `balance`
  (number). All required.
- **`Error`**: `detail` (string, required) — used for `400` and `404`
  responses.
- **`HTTPValidationError`**: FastAPI's default shape — `detail` (array of
  objects with `loc` (array of string/integer), `msg` (string), `type`
  (string)) — used for every `422` response, so the backend can return
  Pydantic's automatic validation errors unmodified.

## Out of scope

- `GET /people/{id}` and `GET /expenses/{id}` (single-resource fetch) —
  not needed; the frontend's edit form reads from the already-loaded list
  (issue #6). Not deferred, just not part of v1's API surface at all.
- Editing or deleting a person — matches the feature scope's exclusion;
  no endpoint is defined for either.
- A health-check / readiness endpoint — not part of the v1 feature scope;
  file a follow-up issue if deployment tooling later needs one.
- Multiple groups, auth, unequal splits, settlement recording, multi-
  currency — all excluded per `specs/features/expense-splitter-poc.md`,
  and none of their endpoints are defined here.
- The exact rounding/remainder-distribution algorithm for balances that
  don't split evenly — deferred to issue #13 (balances endpoint); this
  contract fixes only the response shape.
- The v1 frontend calling `PATCH /expenses/{expense_id}` — the edit form
  (issue #6) always submits the complete expense and will keep using
  `PUT`. `PATCH` is added to the contract as a capability for future API
  clients, not because the v1 UI needs it; no frontend work changes as a
  result of adding it.
- Actually implementing any route, schema (Pydantic/SQLAlchemy), or test —
  covered by issues #9–#14. This issue produces only the YAML file.

## Acceptance criteria

1. `openapi/openapi.yaml` exists at that exact path.
2. The document's top-level `openapi` key is `3.0.3` (checkable via
   `grep '^openapi:' openapi/openapi.yaml`).
3. The document contains no `security` key at the root or on any
   operation (checkable via `grep -i security openapi/openapi.yaml`
   returning no matches).
4. The document is schema-valid OpenAPI, verified by running
   `npx --yes @redocly/cli lint openapi/openapi.yaml` (or an equivalent
   OpenAPI validator) with zero errors. This is an ad hoc lint invocation
   only — it must not add an entry to any `package.json`/`pyproject.toml`,
   since neither exists yet in this repo and none should be created by
   this issue (per `AGENTS.md`, dependencies aren't added without asking).
5. `paths` contains exactly these 8 operations and no others:
   `POST /people`, `GET /people`, `POST /expenses`, `GET /expenses`,
   `PUT /expenses/{expense_id}`, `PATCH /expenses/{expense_id}`,
   `DELETE /expenses/{expense_id}`, `GET /balances`.
6. For each operation listed in Scope, the declared response status codes
   and the schema referenced by each match Scope exactly (e.g.
   `POST /people` has `201`→`Person` and `422`→`HTTPValidationError` and
   no other documented response codes; `DELETE /expenses/{expense_id}` has
   `204` with no response body and `404`→`Error`; `PATCH
   /expenses/{expense_id}` has `200`→`Expense`, `404`→`Error`,
   `422`→`HTTPValidationError`, `400`→`Error`, and no other documented
   response codes).
7. `components/schemas` contains exactly `Person`, `PersonCreate`,
   `Expense`, `ExpenseWrite`, `ExpensePatch`, `Balance`, `Error`,
   `HTTPValidationError`, with the fields, types, and constraints
   (`minLength`, `maxLength`, `minItems`, `uniqueItems`,
   `exclusiveMinimum`, `format: date`, `readOnly`) listed in Scope.
8. `ExpenseWrite` has no `id` property; `PersonCreate` has no `id`
   property; `ExpensePatch` has no `id` property and none of its
   properties are listed under `required`.
9. `expense_id` in the three `/expenses/{expense_id}` operations (`PUT`,
   `PATCH`, `DELETE`) is declared as a required path parameter of type
   integer on all three.
10. Every JSON property name across every schema in the document is
    `snake_case` (no `camelCase` property anywhere), checkable by manual
    inspection of `components/schemas`.
11. The file contains no references to authentication, sessions, or
    multi-group/multi-tenant concepts (e.g. no `group_id` field anywhere),
    matching the single-implicit-group, no-auth v1 scope.

## Edge cases considered

- **Duplicate person names**: allowed — the feature scope doesn't require
  uniqueness, so no `unique` constraint or `409` response is defined for
  `POST /people`.
- **Empty group**: `GET /people`, `GET /expenses`, and `GET /balances` all
  return `200` with an empty array `[]` when no people/expenses exist yet
  — no special "empty" response shape.
- **`participant_ids` with duplicates**: rejected at the schema level via
  `uniqueItems: true` on `ExpenseWrite.participant_ids` (and, if present,
  `ExpensePatch.participant_ids`) → `422`.
- **Empty `participant_ids`**: rejected via `minItems: 1` → `422`, whether
  submitted via `ExpenseWrite` (always required) or `ExpensePatch` (when
  the field is present in the body at all).
- **`amount` of `0` or negative**: rejected via `exclusiveMinimum: 0` →
  `422`, in both `ExpenseWrite` and (when provided) `ExpensePatch`.
- **`payer_id` or a `participant_ids` entry pointing at a person that
  doesn't exist**: this can't be expressed as a JSON Schema constraint (it
  needs a database lookup), so it's carved out as its own `400` response
  distinct from the `422` schema-validation responses. Applies identically
  whether the reference comes in via `POST`, `PUT`, or `PATCH`.
- **Editing an expense to reference a payer/participant that no longer
  makes sense**: since people can never be deleted in v1 (out of scope),
  there's no "person was removed after the expense was created" case to
  handle — any `id` that was ever valid stays valid.
- **`PUT` or `PATCH` on a nonexistent `expense_id`**: `404`, not a silent
  create — edit and create are always distinct operations, never upsert,
  for both full-replace and partial edit.
- **`PATCH` with an empty body (`{}`)**: valid, not a `422` — no fields
  means no fields are changed; response is `200` with the expense
  unchanged.
- **`PATCH` and `PUT` both available on the same expense**: not a
  conflict — they're independent operations an API client chooses between
  based on whether it has the complete new state (`PUT`) or only the
  fields it wants to change (`PATCH`). The contract doesn't define any
  interaction or precedence between them beyond both operating on current
  stored state at request time.
- **Balances for a person with zero expenses**: still appears in the
  `GET /balances` array with `balance: 0`, since "each person's net
  position" (feature scope) implies full coverage of the current group,
  not just people who've participated in an expense.

## Constraints

- OpenAPI version `3.0.3` specifically (not `3.1.x`) — this is the version
  best supported across the toolchain this contract feeds:
  `openapi-typescript`, `openapi-fetch`, MSW-handler generation, and
  Schemathesis (per `_docs/architecture.md`).
- No dependency is added to any manifest to validate or lint the contract
  — this issue predates both `backend/` and `frontend/` project scaffolds
  (issues #8 and #3 respectively), so validation in acceptance criterion 4
  must use an ephemeral tool invocation (`npx --yes ...`), not a project
  dependency.
- Field naming is `snake_case` throughout, matching Pydantic's default
  serialization so the backend needs no alias configuration.
- This issue writes only `openapi/openapi.yaml` — no backend routes,
  Pydantic schemas, SQLAlchemy models, frontend code, or tests are part of
  this change; those are issues #3–#14, all of which depend on this one
  being merged first.

## Open questions

- **ID type**: assumed integer, server-generated, auto-increment (matches
  SQLAlchemy/Alembic defaults for both SQLite and Postgres). If a human
  wants UUIDs instead (e.g. for future multi-client sync), that's a
  contract change and should happen before issues #9–#13 start, since it
  touches the data model directly.
- **Edit semantics**: resolved. A human reviewed this question (previously
  open, assuming `PUT`-only full-replacement) and decided: implement
  *both* `PUT` and `PATCH` on `/expenses/{expense_id}`. `PUT` keeps its
  full-replacement body (`ExpenseWrite`, all fields required) exactly as
  originally specced, since the v1 edit form (issue #6) always submits the
  complete expense and will keep using `PUT` — no frontend change results
  from this decision. `PATCH` is added as a new operation taking a new
  `ExpensePatch` schema (all fields optional; only provided fields are
  updated, others retain their stored value), with the same response
  schema and status codes as `PUT` (`200`/`404`/`422`/`400`). `PATCH` is a
  new capability for future API clients — the v1 UI has no code path that
  calls it.
- **Referential-integrity error code**: assumed `400` for an invalid
  `payer_id`/`participant_ids` reference (distinct from the `422` used for
  schema-shape violations). This split is a judgment call — a human could
  reasonably prefer folding both into `422` with a custom `detail`
  message instead.
- **Ordering guarantees**: assumed `GET /expenses` orders by `date`
  descending (tiebreak `id` descending), and `GET /people` /
  `GET /balances` order by `id`/`person_id` ascending. The feature scope
  says "most recent first" for expenses but doesn't say whether "recent"
  means the expense's `date` field or its creation time — these can
  diverge (e.g. entering an old expense today). Assumed `date` since
  that's the field visible to and controlled by the user; flag if
  creation-time ordering was actually intended.

None of the above block writing the contract now — each has a stated
default in Scope above — but they should be confirmed before issues
#9–#13 (which build the data model and endpoints against this contract)
start, since a later change to any of them is a breaking contract change.
