# Implementation notes: #1 define-openapi-contract

## What was built

- `openapi/openapi.yaml` — hand-authored OpenAPI 3.0.3 document with the 8
  operations (`POST/GET /people`, `POST/GET /expenses`,
  `PUT/PATCH/DELETE /expenses/{expense_id}`, `GET /balances`) and 8 schemas
  (`Person`, `PersonCreate`, `Expense`, `ExpenseWrite`, `ExpensePatch`,
  `Balance`, `Error`, `HTTPValidationError`) exactly as specified.
- `redocly.yaml` — a minimal Redocly CLI config at the repo root (see
  "Decisions" below for why this exists).

## Decisions and why

1. **`exclusiveMinimum` syntax fixed to be valid OpenAPI 3.0.3.** The spec's
   prose describes the `amount` constraint as `exclusiveMinimum: 0`, which
   is JSON-Schema-2020-12 / OpenAPI-3.1 syntax (`exclusiveMinimum` takes the
   boundary value directly). OpenAPI 3.0.3 uses JSON Schema Draft-4 style,
   where `exclusiveMinimum` is a *boolean* modifier paired with `minimum`.
   Since the spec's Constraints section is explicit that the document must
   be OpenAPI 3.0.3 (not 3.1.x) and schema-valid (AC4), I used the
   3.0.3-correct form:
   ```yaml
   type: number
   minimum: 0
   exclusiveMinimum: true
   ```
   on `Expense.amount`, `ExpenseWrite.amount`, and `ExpensePatch.amount`.
   This expresses the identical constraint (amount strictly greater than
   0) that the spec's prose and acceptance criterion 7 call for — it's a
   syntax correction, not a semantic change. Flagging this because AC7
   literally names `exclusiveMinimum` as a constraint to check for; the
   *value* type differs from a literal reading of the spec's prose, but a
   literal `exclusiveMinimum: 0` (number) fails Redocly's schema-validity
   lint under 3.0.3 (`struct` rule: "Expected type `boolean` but got
   `integer`"), which would fail AC4. I resolved the conflict in favor of
   AC4 (validator-checked schema validity) and the explicit 3.0.3
   constraint, since those are testable/objective, over a literal reading
   of one word in the prose.

2. **Added `redocly.yaml` (repo root) extending Redocly's `minimal`
   ruleset**, instead of leaving the default `recommended` ruleset active.
   Reason: `@redocly/cli lint` with no config defaults to `recommended`,
   which treats two *API-design-opinion* rules as hard errors:
   - `no-empty-servers` — wants a top-level `servers:` block.
   - `security-defined` — wants every operation to declare a security
     requirement (or a root-level default).
   Both directly contradict this issue's explicit scope ("no `security`
   scheme anywhere," AC3) and the fact that no deployment target/base URL
   has been decided yet (`_docs/architecture.md`'s own "open questions"
   list deployment target as undecided). Adding a fake `security:` block
   or a placeholder `servers:` entry just to silence the linter would
   violate AC3/AC11 and invent information the spec doesn't have. Since
   AC4 permits "an equivalent OpenAPI validator" and the real intent of
   AC4 is *schema validity* (not adherence to Redocly's opinionated
   best-practices ruleset), I added a one-line `redocly.yaml`
   (`extends: [minimal]`) at the repo root, which demotes those two rules
   to warnings and leaves genuine structural/schema-validity checks
   (`struct`, ref-resolution, etc.) active as errors.
   - This file is picked up automatically by Redocly CLI when run from the
     repo root, so the literal command in AC4
     (`npx --yes @redocly/cli lint openapi/openapi.yaml`) now exits 0 with
     "Your API description is valid" (9 warnings, 0 errors).
   - This is **not** a `package.json`/`pyproject.toml` entry and adds no
     dependency — it's a lint-tool config file consumed only by the
     ephemeral `npx --yes` invocation, consistent with the Constraints
     section's ban on adding a project dependency for validation.
   - Flagging this as a judgment call: the spec's Constraints section only
     forbids manifest changes, and doesn't mention linter config files
     either way. If the orchestrator/QA would rather see zero linter
     config and just accept Redocly's stock warnings-as-errors output as
     "not quite zero errors, but the errors are all opinionated
     non-schema rules," that's a valid alternative reading — I chose the
     interpretation that makes the literal AC4 command pass cleanly.

3. **`info.description`** contains the phrase "No authentication in v1" as
   documentation prose. A blunt `grep -i auth` against the file will match
   this line even though it's stating the *absence* of auth, not adding an
   auth mechanism. AC3's specified check is `grep -i security` (which finds
   nothing), and AC11's "no references to authentication" is about
   mechanisms/fields, not the word appearing in prose — but flagging this
   in case QA runs a stricter literal grep.

4. **Tags** (`people`, `expenses`, `balances`) were added to each operation
   for organization/readability. The spec doesn't mention tags one way or
   the other; they don't affect any schema, path, status code, or field
   named in the acceptance criteria, so I treated this as a
   non-load-bearing authoring convenience within scope.

5. **`operationId`** values were added to every operation (e.g.
   `createPerson`, `listPeople`) since `openapi-typescript` codegen
   (referenced in `_docs/architecture.md`) uses these to name generated
   client methods, and the codegen tooling is explicitly named as this
   contract's downstream consumer. The spec doesn't specify exact
   `operationId` strings, so these are my own naming choice and are not
   covered by any acceptance criterion — future issues are free to require
   different names if `openapi-typescript`'s generated method names need
   to match something specific.

## What I verified mechanically

- `grep '^openapi:' openapi/openapi.yaml` → `openapi: 3.0.3` (AC2).
- `grep -i security openapi/openapi.yaml` → no matches (AC3).
- `npx --yes @redocly/cli lint openapi/openapi.yaml` → exit 0, "valid", 0
  errors / 9 warnings (AC4).
- Parsed the YAML with PyYAML and checked, programmatically: the exact set
  of 8 paths/operations and their response codes/schema refs (AC5, AC6);
  the exact set of 8 schemas and their `required`/`properties` lists
  (AC7); absence of `id` in `ExpenseWrite`/`PersonCreate`/`ExpensePatch`
  and absence of `required` in `ExpensePatch` (AC8); the `expense_id` path
  parameter shared by `PUT`/`PATCH`/`DELETE` via `$ref` is
  `required: true`, `type: integer` (AC9); no camelCase property names
  across any schema (AC10); no `security`/`servers` keys present at all
  (AC3, and supports AC11's no-auth requirement).

## Left out / not applicable

- No backend/frontend code, no dependency additions beyond the ephemeral
  `npx` lint invocation and the `redocly.yaml` config file discussed above
  — per the spec's Constraints, this issue is scoped to the YAML contract
  only.
- No `GET /people/{id}`, `GET /expenses/{id}`, health-check route, or any
  auth/multi-group concept — all explicitly out of scope per the spec.

## Open questions from the spec

All four were already marked "confirmed"/"resolved" in the spec text
(integer auto-increment IDs, both PUT+PATCH, 400 for referential-integrity
errors, date-descending/id-descending-tiebreak + id-ascending orderings)
and were implemented as stated — no further human decision was needed for
this issue.
