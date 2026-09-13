---
issue: 14
label: groomed
---

# Contract-compliance tests (Schemathesis)

## Summary

Add `backend/tests/contract/`: a single Schemathesis-generated test suite
that loads `openapi/openapi.yaml` — the hand-authored contract, not
anything the app generates about itself — and, for every operation it
declares, fires generated requests directly at the in-process FastAPI
`app` object (ASGI transport, no `uvicorn`/`fastapi dev` process
involved), asserting each response's status code and body conform to what
that operation promises. This is the one test category in
`_docs/testing-guidelines.md` that isn't hand-written per endpoint — it's
derived mechanically from the contract itself, which is why it only makes
sense once every endpoint it would exercise actually exists.

**Note on dependencies:** `openapi/openapi.yaml` (#1), `backend/` (#8),
the `Person`/`Expense` models (#9, #10), and every router (#11 people, #12
expenses, #13 balances) are all groomed but not yet implemented in this
repo. This spec describes the target shape by reading those specs'
content directly — it does not assume any of them is already running.
Implementation of this issue should start once #1, #8, #9, #10, #11, #12,
and #13 have all actually landed, not before, since a contract test with
missing routes would only ever exercise a subset of `openapi/openapi.yaml`
and give a false sense of completeness.

## Scope

1. **Dependency** — `backend/pyproject.toml` (from #8) gets `schemathesis`
   added as a dev-dependency (`uv add --dev schemathesis`, run from
   `backend/`). No version is pinned beyond whatever `uv` resolves. This
   spec is the explicit sign-off for this one package, per `AGENTS.md`'s
   "don't add a dependency without asking" rule — same pattern #8 used to
   sign off on `pydantic-settings`.
2. **Schema loading** — in `backend/tests/contract/test_contract.py`:
   - Load the schema from the contract file itself, not from anything the
     running app reports about itself:
     ```python
     import schemathesis
     from pathlib import Path

     CONTRACT_PATH = Path(__file__).resolve().parents[3] / "openapi" / "openapi.yaml"
     schema = schemathesis.openapi.from_path(CONTRACT_PATH)
     ```
     `parents[3]` resolves `backend/tests/contract/test_contract.py` up to
     the repo root regardless of the process's current working directory,
     so `cd backend && uv run pytest` and `uv run pytest` from the repo
     root both find the same file.
   - **Do not** use `schemathesis.openapi.from_asgi("/openapi.json", app)`
     (or read `app.openapi()` directly) as the schema source. That loads
     whatever FastAPI itself generates from the Pydantic models at
     runtime, which is tautologically self-consistent — it would validate
     the app against its own reflection, never catching the case
     `_docs/architecture.md` explicitly warns about ("a route that
     diverges from the contract is a bug, not a contract update").
     `openapi/openapi.yaml` must be the one and only source of truth these
     tests check against.
   - Bind the app for in-process execution by setting `schema.app`
     directly, once, at module import time:
     ```python
     from app.main import app as fastapi_app
     schema.app = fastapi_app
     ```
     Setting `.app` on a schema loaded via `from_path` is what makes
     `case.call()`/`case.call_and_validate()` route requests through
     Schemathesis's ASGI transport (in-process, synthetic `testserver`
     host, no socket) instead of requiring a `base_url` pointing at a
     real, running HTTP server — this is the concrete mechanism behind
     "wired to FastAPI's own app object, not a running server."
3. **Database isolation** — `backend/tests/contract/conftest.py`:
   - An `autouse` fixture that overrides `app.dependency_overrides[get_db]`
     with a fresh SQLite database for the duration of each generated test
     function, reusing the same isolation pattern `backend/tests/conftest.py`
     established in #8 (temp/in-memory SQLite + `StaticPool`,
     `Base.metadata.create_all`, teardown after) rather than reinventing
     it. Because `schema.app` is bound once at import time (step 2), this
     fixture must patch and restore `app.dependency_overrides` per test
     rather than relying on a `TestClient` instance per test.
   - Since Schemathesis's Hypothesis engine runs many generated examples
     per operation inside a single pytest test function, one fresh
     database is shared across all examples of *one* operation (e.g. every
     generated `POST /expenses` example in that test run against the same
     throwaway DB) but never across two different operations' test
     functions, and never against `dev.db`.
4. **Test function** — one `@schema.parametrize()`-decorated function
   covering every operation in the contract:
   ```python
   from hypothesis import settings

   @schema.parametrize()
   @settings(max_examples=20, deadline=None)
   def test_api_conforms_to_contract(case):
       case.call_and_validate()
   ```
   - `max_examples=20` bounds runtime/flakiness for CI; `deadline=None`
     turns off Hypothesis's per-example wall-clock budget, which would
     otherwise misreport slow-but-correct database round-trips as
     failures unrelated to contract conformance.
   - `case.call_and_validate()` performs the ASGI call and runs
     Schemathesis's default checks — `status_code_conformance`,
     `content_type_conformance`, `response_schema_conformance` (which
     covers required fields), and `not_a_server_error` — against
     whichever response status code the app actually returned, using the
     response schema `openapi/openapi.yaml` declares for that operation
     and status code.
   - No extra checks, no stateful/link-based testing, no explicit
     negative-testing extensions are enabled — see "Out of scope."

## Out of scope

- Hand-written per-endpoint positive/negative test cases (e.g. "a
  specific invalid `payer_id` returns exactly `400`") — that's #11/#12/#13's
  job, already done in `backend/tests/test_people.py`,
  `test_expenses.py`, `test_balances.py`. This issue's generated suite may
  incidentally hit some of the same status codes, but it isn't relied on
  to prove any specific business rule; it only proves the app's actual
  responses conform to what the contract declares.
- Explicit Schemathesis "negative testing" (deliberately generating
  schema-violating request bodies, e.g. via
  `schemathesis.contrib.openapi.negative`) — not enabled. The generated
  suite uses Schemathesis's default (positive-leaning) data generation,
  which already produces some `400`/`404`/`422` cases naturally (e.g. a
  generated path `expense_id` that doesn't exist), without deliberately
  engineering hostile inputs the hand-written suites already cover.
- Stateful/link-based Schemathesis testing (chaining a `POST /expenses`
  response's `id` into a later `PUT`/`DELETE` call) — not requested by the
  raw issue; each generated example is an independent, single request.
- Modifying `openapi/openapi.yaml` itself — this issue only adds tests
  that read it; if a contract test surfaces a real divergence, the fix is
  either the route (if the contract is right) or a deliberate contract
  change (#1's spec, treated as frozen unless a human reopens it) — never
  a change smuggled into this issue.
- Running these tests over real HTTP against a live `fastapi dev`/`uvicorn`
  process — explicitly not done; see Scope item 2's `schema.app` binding.
- CI wiring to run this suite on every push — flagged as an open,
  undecided question in `_docs/architecture.md`; not part of this issue.
- Any change to `backend/src/app/` — this issue is test-only.

## Acceptance criteria

1. `backend/pyproject.toml` lists `schemathesis` as a dev-dependency;
   `cd backend && uv sync` completes with exit code `0`.
2. `backend/tests/contract/test_contract.py` exists and loads the schema
   via `schemathesis.openapi.from_path(...)` pointed at the repository's
   `openapi/openapi.yaml` — checkable via `grep -n 'from_path' backend/tests/contract/test_contract.py` matching, and `grep -n 'from_asgi\|app.openapi()' backend/tests/contract/test_contract.py` matching nothing.
3. The same file sets `schema.app` to the FastAPI app instance imported
   from `app.main` — checkable via `grep -n 'schema.app' backend/tests/contract/test_contract.py` matching.
4. The file contains exactly one `@schema.parametrize()`-decorated test
   function, whose body calls `case.call_and_validate()` and nothing else
   that would suppress a check (no `excluded_checks=`, no bare `case.call()`
   without a following `validate_response`).
5. `backend/tests/contract/conftest.py` provides an `autouse` fixture that
   gives each generated test function a fresh, isolated SQLite database
   (via `app.dependency_overrides[get_db]`), reusing #8's
   `backend/tests/conftest.py` isolation approach rather than a new one.
6. `cd backend && uv run pytest tests/contract/` collects and runs one
   test item per operation declared in `openapi/openapi.yaml` (7 items:
   `POST /people`, `GET /people`, `POST /expenses`, `GET /expenses`,
   `PUT /expenses/{expense_id}`, `DELETE /expenses/{expense_id}`,
   `GET /balances`), with every item passing, once #1 and #8–#13 are all
   implemented.
7. `cd backend && uv run pytest` (the full suite, no path filter) passes
   with every test green, including `tests/contract/`.
8. No test in `tests/contract/` ever connects to or creates `dev.db` —
   verified by running the suite with no `dev.db` file present beforehand
   and confirming none exists afterward.
9. Manual regression check: temporarily editing any implemented route so
   its response diverges from `openapi/openapi.yaml` (e.g. changing
   `POST /people`'s success status code from `201` to `200`, or dropping
   the `name` field from a `Person` response) causes
   `uv run pytest tests/contract/` to fail with a Hypothesis "Falsifying
   example" identifying the offending operation; reverting the edit makes
   it pass again. (This is a one-time verification step for whoever
   implements this issue, not a permanently-committed test — see edge
   cases.)
10. No file under `backend/src/app/` or `openapi/openapi.yaml` is modified
    by this change.

## Edge cases considered

- **Self-referential schema loading**: the single biggest way this test
  category could be built wrong is loading the schema from the app's own
  `/openapi.json` instead of the hand-authored file — that would always
  pass, proving nothing. Criterion 2 checks for this directly.
- **Real server vs. in-process app**: setting `schema.app` (rather than
  giving Schemathesis a `base_url` and expecting a live process) is what
  makes "no running server" concrete and machine-checkable, not just a
  documentation claim. Criterion 3 checks for this.
- **Hypothesis's per-example database state accumulating**: within one
  parametrized operation's test run, dozens of generated examples share
  one throwaway database (Scope item 3) — e.g. multiple generated
  `POST /people` calls all landing in the same SQLite file for that one
  test function. This is intentional and harmless for contract-conformance
  purposes (it does not affect whether a given response's shape/status
  code matches the contract); it would only matter for a hand-written
  behavioral assertion, which this suite doesn't make.
- **`deadline=None` vs. Hypothesis's default per-example timeout**:
  without disabling the deadline, a slow-but-correct SQLite round-trip
  under Hypothesis's default health checks can be misreported as a test
  failure that has nothing to do with contract conformance — this would
  be a confusing, intermittent false positive if left at the default.
- **A generated request that's rejected by Pydantic before hitting a
  handler**: e.g. Schemathesis generating a `participant_ids` list at the
  boundary of `minItems`/`uniqueItems`. This is fine and expected —
  `response_schema_conformance` checks that the resulting `422` response
  matches `HTTPValidationError`'s declared shape, same as any other
  status code.
- **This suite existing before all routes exist**: explicitly why this
  issue is sequenced after #11/#12/#13 (see "Note on dependencies") — a
  `@schema.parametrize()` test collected against an operation with no
  matching route would fail with a `404`/`405` that's actually a missing
  route, not a genuine schema-shape bug, muddying what a red run means.
- **Criterion 9 is a verification step, not a shipped test**: there's no
  way to "commit" a deliberately-broken route as part of this issue's
  final state; it's listed as an acceptance criterion because it's the
  concrete way a human (or qa-engineer) confirms the suite actually
  detects divergence rather than trivially passing regardless of what the
  app does.

## Constraints

- `schemathesis` is the only new dependency this issue introduces, and
  only to `backend/pyproject.toml`'s dev-dependencies (not a runtime
  dependency of the app) — per "Scope" item 1's sign-off.
- The contract file path is resolved relative to the test file's own
  location (`Path(__file__).resolve().parents[...]`), not the process's
  current working directory, so the suite behaves the same whether pytest
  is invoked from the repo root or from `backend/`.
- No HTTP server process (`fastapi dev`, `uvicorn`) is started anywhere in
  this test suite — all requests go through Schemathesis's ASGI transport
  against the in-process `app` object.
- Per `_docs/testing-guidelines.md`, this directory (`backend/tests/contract/`)
  is explicitly carved out as the one hand-authored-per-endpoint exception:
  a single generated suite stands in for what would otherwise be dozens of
  hand-written per-operation contract checks.
- This issue does not change `openapi/openapi.yaml`, any Pydantic schema,
  or any router — it is additive, test-only.

## Open questions

- **`max_examples=20`**: chosen as a reasonable bound for CI runtime and
  determinism-under-flakiness without being so low it barely exercises
  the input space; not derived from any stated requirement in the raw
  issue or `_docs/testing-guidelines.md`. Flag if a specific number (or
  Schemathesis's un-overridden default, which is higher and slower) was
  actually wanted.
- **No explicit Hypothesis seed / `derandomize`**: assumed acceptable for
  a test whose job is "does every response conform to the schema," where
  a flaky failure is itself informative (it found *some* input that
  breaks conformance) rather than something that needs bit-for-bit
  reproducibility across CI runs. Flag if a fixed seed is wanted for
  reproducible CI runs.
- **Single combined test function vs. one per path**: assumed one
  `@schema.parametrize()` function covering all 7 operations (Schemathesis
  expands this into 7 collected pytest items internally), rather than
  separate hand-split functions per resource (people/expenses/balances).
  This matches "generated from the contract, not hand-written per
  endpoint" most literally. Flag if per-resource splitting (e.g.
  `test_contract_people.py`, `test_contract_expenses.py`) is preferred for
  readability — purely organizational, no behavioral difference.
- **CI wiring**: as noted in "Out of scope," whether this suite runs on
  every push is still an open question in `_docs/architecture.md` itself,
  not something this issue's spec can resolve on its own.

None of the above block implementation — each has a stated default in
Scope/Acceptance criteria above — but they should be confirmed if a human
wants different runtime/determinism trade-offs before this issue is
picked up.
