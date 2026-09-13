---
issue: 16
label: groomed
---

# End-to-end Playwright test suite for core flows

## Summary

Scaffold `e2e/` as its own Playwright project (own `package.json`, per
`_docs/architecture.md`'s repository layout) and write tests for the two
flows named in the GitHub issue that genuinely cross the frontend/backend
boundary: (1) adding a person on the People screen and seeing that person
immediately available as a payer/participant option on the Expenses
screen's add-expense form, and (2) adding, editing, and deleting an expense
and seeing both the Expenses list and the Balances screen reflect each
change — all exercised against a real FastAPI backend on a dedicated
SQLite database and the real *built* Vue frontend (`npm run build` +
`npm run preview`), with no MSW involved anywhere in this suite. This is
the fourth and final build phase per
`specs/features/expense-splitter-poc.md`, and depends directly on issue
#15 (wiring the frontend to a real backend) having landed — per
`_docs/testing-guidelines.md`, e2e is "the one layer that can't be
test-first in the strict sense," so this spec's tests are written in full
now and either run for real or are checked in skipped, depending on
whether #15's prerequisite is met at implementation time (see Scope item
1).

## Scope

**Prerequisite gate and the e2e test-first exception** (see "Open
questions" for the underlying sequencing risk):

1. As of this grooming, none of `openapi/`, `frontend/`, `backend/`, or
   `e2e/` exist in this repo — issues #1, #3–#14, and #15 are all groomed
   but unimplemented. Per `_docs/testing-guidelines.md`'s stated exception
   for this layer ("write the acceptance-criteria-derived test cases as
   soon as the spec is groomed — even as skipped/pending tests naming the
   scenario — so what's left to cover is visible, then fill them in once
   both sides exist"), this issue is **not** gated the same way #4–#7 were
   (stop entirely and leave a comment). Instead:
   - The `e2e/` project scaffolding (`package.json`, `playwright.config.ts`,
     both `webServer` entries) is written in full regardless of whether the
     prerequisite is met — it's pure tooling with nothing to run against
     yet.
   - Both spec files (items 7–13 below) are written with complete test
     bodies (real selectors, real assertions, real expected values) against
     the screens as documented in `specs/groomed/4-people-management-ui.md`,
     `specs/groomed/5-expense-list-view.md`,
     `specs/groomed/6-add-and-edit-expense-form.md`, and
     `specs/groomed/7-balances-view-ui.md` — not left as empty
     `test.todo(...)` placeholders.
   - If, at implementation time, `specs/groomed/15-wire-frontend-to-real-backend.md`'s
     acceptance criteria are not yet satisfied in this repo (no real,
     CORS-enabled backend for the built frontend to call), every test is
     wrapped in a skip (e.g. `test.skip(true, "blocked on #15 — <link>")`)
     so `npx playwright test` reports them as skipped rather than hanging
     or failing while waiting for servers that were never meant to start. A
     comment is left on issue #16 noting the missing prerequisite. Removing
     the skip is the only step needed once #15 lands.
   - If the prerequisite *is* met, all tests run for real, against a real
     backend and built frontend, and must pass.

**`e2e/` project setup:**

2. `e2e/package.json`: a Playwright-only npm project, declaring exactly one
   dependency, `@playwright/test` (devDependency), and a `test` script
   (`playwright test`). Pre-approved per `_docs/architecture.md`, which
   already names Playwright as the tool for this directory (same reasoning
   `specs/groomed/3-scaffold-frontend-project.md` and
   `specs/groomed/8-scaffold-backend-project.md` used for their own
   pre-approved dependency lists).
3. `e2e/playwright.config.ts`:
   - `testDir: './tests'`.
   - `use: { baseURL: 'http://127.0.0.1:4173' }`.
   - Two `webServer` entries (Playwright supports an array here):
     - **Backend**: a command that (a) deletes any existing
       `backend/e2e_test.db` file, (b) runs
       `DATABASE_URL=sqlite:///./e2e_test.db uv run alembic upgrade head`,
       then (c) starts `DATABASE_URL=sqlite:///./e2e_test.db uv run fastapi
       dev src/app/main.py --port 8001`, all with `cwd: '../backend'`; `url:
       'http://127.0.0.1:8001/openapi.json'` for readiness.
     - **Frontend**: a command that runs `VITE_API_BASE_URL=http://127.0.0.1:8001
       npm run build` followed by `npm run preview -- --port 4173`, with
       `cwd: '../frontend'`; `url: 'http://127.0.0.1:4173'` for readiness.
     - `reuseExistingServer: !process.env.CI` (Playwright's standard
       default) on both entries.
   - Ports `8001`/`4173` are deliberately distinct from the documented
     local dev ports (`8000`/`5173` from #8/#3/#15), so running this suite
     doesn't collide with or get confused by a developer's already-running
     `fastapi dev` / `npm run dev` session.
4. `frontend/package.json` gains a `preview` script (`vite preview`) — Vite
   ships this command already; it's a new npm script, not a new dependency.
5. `backend/.gitignore` gains an entry for `e2e_test.db`, alongside the
   existing `dev.db` entry from `specs/groomed/8-scaffold-backend-project.md`.
6. `e2e/.gitignore` excludes `node_modules/`, `test-results/`, and
   `playwright-report/`.

**Shared test helper:**

7. `e2e/tests/helpers.ts` exports a function that generates a
   unique-per-invocation string given a base label (e.g. combining
   `Date.now()` and a short random suffix) — every person/expense name
   created by this suite is generated through this helper, and no test
   anywhere in `e2e/tests/` asserts against a literal fixed name. This is
   what keeps the suite correct without a database reset between
   individual tests or runs (see "Edge cases considered").

**`e2e/tests/people-participant.spec.ts`** — flow 1 from the GitHub issue:

8. Creates one uniquely-named person via the People screen's add-person
   form (fills the input, submits) and asserts a row for that name appears
   in the People screen's rendered list.
9. Navigates to the Expenses screen, opens the "Add expense" form, and
   asserts that same person's name appears (a) as a selectable option in
   the "Paid by" control and (b) as a labeled row in the "Split between"
   checkbox list — proving a person added through the UI is immediately
   visible as a participant option on a different screen via a real
   `GET /people` request against the database, not a client-side cache or
   mock.

**`e2e/tests/expense-lifecycle.spec.ts`** — flow 2 from the GitHub issue
(add/edit/delete an expense, expense list and balances update):

10. Creates two uniquely-named people via the People screen (call them the
    payer and the participant for this test). Navigates to Balances and
    reads each person's currently-rendered balance amount as the test's
    baseline — both must read `$0.00`/"settled up", since a newly added
    person with no expenses always starts there per
    `specs/groomed/7-balances-view-ui.md`.
11. Navigates to Expenses, opens "Add expense", and: enters a uniquely-named
    description, amount `100.00`, sets "Paid by" to the payer, leaves Date
    at its default (today), and in "Split between" unchecks every checked
    person **except** the payer and the participant (participants default
    to everyone currently in the group per
    `specs/features/expense-splitter-poc.md`, and the group may already
    contain other people from earlier test runs — see "Edge cases
    considered" — so this step is required regardless of how many other
    people exist), then saves.
12. Asserts a row for that description appears in the Expenses list showing
    amount `$100.00`, the payer's name, and both the payer's and
    participant's names in its meta line. Navigates to Balances and asserts
    the payer's balance now reads their baseline `+$50.00` and the
    participant's reads their baseline `−$50.00` (a $100 expense split
    equally two ways).
13. Returns to Expenses, opens that row's edit form by clicking the button
    with `aria-label="Edit {description}"` (interpolating this test's
    generated description directly into the locator — no need to first
    scope to the row via its description text, since the accessible name
    is already unique to this expense), changes Amount to `60.00` only
    (description/payer/participants/date unchanged), and saves. Asserts
    the row's amount now reads `$60.00`. Navigates to Balances and asserts
    the payer's balance now reads their baseline `+$30.00` and the
    participant's reads their baseline `−$30.00`. Returns to Expenses and
    deletes the row by clicking the button with
    `aria-label="Delete {description}"` (same direct-locator approach);
    asserts the row is no longer present. Navigates to Balances and
    asserts both people's balances have returned to exactly their
    baseline (`$0.00`/"settled up"), proving the delete removed the
    expense's effect entirely.

**General rule for both spec files:**

14. No test anywhere in `e2e/tests/` asserts on the total number of
    rows/items in any list (People, Expenses, or Balances) — every
    assertion targets a specific row identified by one of this run's
    uniquely-generated names, so the suite is resilient to state left over
    from a previous run or from other people already in the group (people
    can never be deleted, per `specs/features/expense-splitter-poc.md`).

**Documentation:**

15. `AGENTS.md` gains a line documenting the e2e commands:
    `cd e2e && npm install && npx playwright install && npx playwright test`,
    alongside the existing frontend/backend dev-server and test-runner
    commands from #3/#8/#15.

## Out of scope

- CI wiring to run this suite automatically on push — flagged as an open,
  undecided question in `_docs/architecture.md` ("CI wiring... which of the
  four test layers run on every push vs. on demand"); this issue only
  defines the local `npx playwright test` invocation. File a follow-up
  issue once CI wiring is scoped.
- A test-only backend reset/seed endpoint — would be a contract change to
  the already-frozen `openapi/openapi.yaml` (`specs/groomed/1-define-openapi-contract.md`);
  this spec works around the lack of one with per-test unique names and
  delta-based balance assertions instead (see "Open questions").
- Visual regression / screenshot testing — not requested; every assertion
  in this suite is text/role-based, not a pixel comparison.
- Exercising the mobile or tablet layouts via Playwright's viewport/device
  emulation — the responsive layout differences across breakpoints are
  already covered by each screen's own Vitest suite (#3–#7), which inspects
  the responsive Tailwind classes directly. This e2e suite runs at
  Playwright's default (desktop-sized) viewport only, since its purpose is
  verifying the real cross-boundary data flow, not layout fidelity. File a
  follow-up issue if mobile-viewport e2e coverage is wanted later.
- Additional core flows beyond the two named in the GitHub issue and
  decomposed above — e.g. validation-error states, failed-request/network
  error handling, or the disabled-submit-button behavior already exercised
  by each screen's own Vitest suite. Per `_docs/testing-guidelines.md`,
  e2e is "not a duplicate of coverage already proven by backend or frontend
  unit tests."
- A cross-browser test matrix (Firefox/WebKit projects in
  `playwright.config.ts`) — Playwright defaults to a single Chromium
  project; nothing in the feature spec or design system implies
  browser-specific behavior. File a follow-up issue if multi-browser
  coverage is wanted.
- Implementing issue #15 itself (real backend wiring, CORS, configurable
  API base URL, MSW opt-in gating) — this entire suite is gated on it; see
  Scope item 1's skip-if-unmet handling.
- Implementing any of #1, #3–#14 (contract, frontend screens, backend
  routes) — this issue only tests the already-specified behavior of all of
  them working together.

## Acceptance criteria

1. `e2e/package.json` exists, declaring exactly `@playwright/test` as a
   devDependency and a `test` script that runs `playwright test`. No other
   dependency is added without separate sign-off, per `AGENTS.md`.
2. `e2e/playwright.config.ts` exists and defines `testDir: './tests'`,
   `use.baseURL` of `http://127.0.0.1:4173`, and two `webServer` entries
   matching Scope item 3 — one starting the backend against a freshly
   migrated `backend/e2e_test.db` on port `8001`, one building the frontend
   with `VITE_API_BASE_URL=http://127.0.0.1:8001` and serving it via
   `npm run preview` on port `4173` — checkable by inspecting the file.
3. `frontend/package.json` has a `preview` script equal to `vite preview`
   (or an equivalent invocation); `cd frontend && npm run build && npm run
   preview` serves the built `dist/` directory.
4. `backend/.gitignore` contains an entry for `e2e_test.db`.
5. `e2e/.gitignore` excludes `node_modules/`, `test-results/`, and
   `playwright-report/`.
6. `e2e/tests/helpers.ts` exports a unique-name-generating function, and
   grepping `e2e/tests/*.spec.ts` for any hardcoded literal person/expense
   name (i.e., a string not built via that helper) finds none.
7. `e2e/tests/people-participant.spec.ts` exists and contains a complete
   test implementing Scope items 8–9 (not a `test.todo`/empty stub).
8. `e2e/tests/expense-lifecycle.spec.ts` exists and contains a complete
   test (or ordered set of tests) implementing Scope items 10–13 (not a
   `test.todo`/empty stub), including the exact baseline/delta balance
   math described there (`+$50.00`/`−$50.00` after create at `$100.00`,
   `+$30.00`/`−$30.00` after editing to `$60.00`, both back to baseline
   after delete).
9. Neither spec file contains an assertion on the total length/count of
   any rendered list — every assertion locates a row via a
   helper-generated unique name (Scope item 14).
10. **If `specs/groomed/15-wire-frontend-to-real-backend.md`'s acceptance
    criteria are satisfied in this repo at implementation time**: running
    `cd e2e && npm install && npx playwright install && npx playwright
    test` starts both `webServer`s, runs every test in both spec files for
    real against the built frontend and the real FastAPI backend on
    `backend/e2e_test.db`, and every test passes.
11. **If they are not satisfied at implementation time**: every test in
    both spec files is wrapped in a skip (e.g. `test.skip(true, "blocked
    on #15 — <link/reference>")); running `npx playwright test` reports
    every test as skipped, with zero failures and no hang waiting for a
    server that never starts; a comment is left on issue #16 identifying
    the missing prerequisite; the `webServer` configuration in
    `playwright.config.ts` and the full test bodies remain present and
    complete (criteria 2, 7, 8 still hold) — only execution is skipped, not
    the code.
12. `AGENTS.md` documents the e2e command sequence from Scope item 15.

## Edge cases considered

- **People can never be deleted, so the group only ever grows**: since v1
  has no delete-person endpoint (`specs/groomed/1-define-openapi-contract.md`),
  every person this suite (or a developer running it repeatedly without a
  DB reset) has ever created remains in the database. This is why criteria
  9/14 forbid count-based assertions, and why the expense-lifecycle test
  reads each person's balance as a per-test *baseline* and asserts
  *deltas* against it, rather than hardcoding an absolute expected balance
  that would depend on the database's entire history.
- **The default "everyone" participant selection grows with the group**:
  `ExpenseForm.vue` defaults every current person to checked in
  add mode (per `specs/groomed/6-add-and-edit-expense-form.md`); the
  expense-lifecycle test must explicitly uncheck every participant except
  its own two people (Scope item 11) so `participant_ids` is exactly those
  two regardless of how many other people already exist. Not doing this
  would make the $50/$50 balance math depend on the group's total size.
- **`reuseExistingServer` skipping the DB-reset command on repeated local
  runs**: if a developer runs `npx playwright test` twice in a row without
  the server ever stopping, Playwright's `reuseExistingServer: true`
  (non-CI) means the backend's startup command — including the
  delete-and-remigrate step — never re-executes, so `e2e_test.db` persists
  across those runs. This is acceptable specifically because every test
  generates fresh unique names each run (Scope item 7); the suite doesn't
  depend on starting from an empty database, only from a *consistent*
  schema.
- **A third person's data appearing in a locator's scope**: if another
  parallel test worker or a leftover person from a previous run happens to
  render in the same "Split between" list at the moment the
  expense-lifecycle test opens its form, that person is simply left
  checked or unchecked as the form's own default sets it — the test only
  looks for and toggles checkboxes matching its own two generated names,
  so a third person's presence never changes the tracked payer/participant
  math, since adding an unrelated person to a group with no expenses
  referencing them doesn't change anyone else's balance.
- **`e2e_test.db` must be a real file, not `:memory:`**: it's read and
  written by a separately-launched backend process (Playwright's
  `webServer`), which must outlive and be shared across every request in
  the run — an in-memory SQLite database is scoped to a single connection
  and isn't practical to share that way.
- **Currency/balance text parsing**: all amount/balance assertions compare
  against the rendered `$X.XX` (or `−$X.XX`) text exactly as
  `specs/groomed/6-add-and-edit-expense-form.md`/
  `specs/groomed/7-balances-view-ui.md` specify formatting it, not a raw
  floating-point comparison.

## Constraints

- `e2e/` is its own npm project (own `package.json`), matching
  `_docs/architecture.md`'s repository layout — not a subfolder of
  `frontend/`.
- No dependency beyond `@playwright/test` is added to `e2e/package.json`
  without separate sign-off, per `AGENTS.md`; pre-approved as described in
  Scope item 2.
- Tests use accessible-role/text/label locators (Playwright's
  `getByRole`/`getByLabel`/`getByPlaceholder`/`getByText`), matching the
  accessible-name attributes already required by #4/#5/#6 — the
  icon-only mobile add buttons (e.g. `aria-label="Add person"`,
  `aria-label="Add expense"`), each desktop row's per-row-unique
  `aria-label="Edit {description}"` / `aria-label="Delete {description}"`
  edit/delete icon buttons (`specs/groomed/5-expense-list-view.md`
  criterion 16), and the expense form's `aria-label="Close"` close icon
  (`specs/groomed/6-add-and-edit-expense-form.md` criterion 22) — no
  CSS-class or XPath selectors, and no new `data-testid` attributes are
  added to frontend components for this issue (none of #3–#7 specify
  any).
- The suite runs against the **built** frontend (`npm run build` +
  `npm run preview`), never `npm run dev`, per `_docs/architecture.md`'s
  description of this layer ("the real FastAPI backend (SQLite) and the
  built frontend, exercised together").
- No test in this suite ever sets `VITE_USE_MOCKS` — the frontend build
  used here must never intercept traffic with MSW; that flag exists
  precisely for the opposite (mock-only) workflow per
  `specs/groomed/15-wire-frontend-to-real-backend.md`.

## Open questions

- **No test-only reset/seed endpoint exists**: this spec resolves the
  resulting "database only ever grows" problem with per-test unique names
  and delta-based balance assertions (see "Edge cases considered") rather
  than requesting a new contract endpoint. Flag if a human would rather add
  a test-only reset/seed endpoint to the contract instead — that would be
  a change to the already-frozen `specs/groomed/1-define-openapi-contract.md`.
- **e2e backend/frontend ports (`8001`/`4173`)**: not specified anywhere
  else in the repo; chosen to avoid colliding with the documented local dev
  ports (`8000`/`5173`). Flag if different ports are preferred, e.g. to
  match a future CI port reservation.
- **CI wiring**: explicitly out of scope per `_docs/architecture.md`'s own
  open question on this; this spec only defines the local invocation. Flag
  once CI wiring is scoped so this suite can be added to it.
- **Playwright's default multi-worker parallelism**: assumed safe given
  this spec's "no exact-count assertions, always uniquely-named fixtures"
  rule (Scope item 14). Flag if a human would rather force `workers: 1` for
  extra determinism at the cost of suite runtime, especially as more spec
  files are added later.
