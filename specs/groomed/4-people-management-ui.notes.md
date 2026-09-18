# Implementation notes: People management UI (#4)

## Prerequisite gate

`frontend/src/api/client.ts` and `frontend/src/api/schema.d.ts` both
existed at implementation time (issue #3 merged), so the full scope was
implemented — the "blocked" fallback in criterion 1 did not apply.

## Files changed

- `frontend/src/views/PeopleView.vue` — replaced the placeholder `<h1>`
  with the real add-person form and person list, desktop/tablet and
  mobile variants, per Scope items 2–13.
- `frontend/src/components/icons/PlusIcon.vue` — new icon component,
  following the existing `PersonIcon.vue`/`ReceiptIcon.vue` pattern
  (24×24 viewBox, `currentColor`). Uses `stroke-width="2"`, matching
  design-system.md's note that small utility glyphs (the plus/add icon)
  use `stroke-width: 2` rather than the `1.75` used by the larger nav
  icons — this exactly matches the plus icon markup already in
  `people.html`/`people-mobile.html`.
- `frontend/src/mocks/handlers.ts` — added typed `GET /people` and
  `POST /people` handlers sharing a module-level in-memory array/counter,
  built against `components["schemas"]["Person"|"PersonCreate"]` from
  `schema.d.ts`. Also exports `resetPeopleStore()`, used only by
  `PeopleView.test.ts` in a `beforeEach` to isolate test cases from each
  other — this is still the same MSW handler module, not a separate
  fixture mechanism, so I believe it's consistent with the "MSW is the
  only mocking mechanism" constraint, but flagging the addition since
  the spec doesn't mention it explicitly.
- `frontend/src/views/PeopleView.test.ts` — new, co-located test file
  covering the acceptance criteria (see below).
- `frontend/vitest.config.ts` and `frontend/src/mocks/setup.ts` — test
  *environment* fixes, not scope changes; see "Environment issue found
  and fixed" below.

## Environment issue found and fixed (not in the original spec)

This is the first PR to actually exercise a real (mocked) network call
from a component under Vitest — issue #3's tests only covered routing
and the static app shell. Doing so exposed two pre-existing gaps in the
Vitest/jsdom test setup from issue #3 that had to be fixed for *any*
future MSW-backed component test to work at all, not just this one:

1. **Relative URLs crash `openapi-fetch`'s `new Request(...)` call under
   Vitest's jsdom pool.** Vitest 5's jsdom environment builds
   `globalThis.Request` on top of Node's undici `Request`, which (unlike
   a browser) throws on a relative URL like `/people` — it does not
   resolve it against `window.location`, even with
   `environmentOptions.jsdom.url` set. Since `client.ts` uses
   `baseUrl: '/'` (correct for the real browser, where the base is the
   page's own origin), every `client.GET`/`client.POST` call threw
   `TypeError: Invalid URL` before MSW even got a chance to intercept it.
   Fixed in `src/mocks/setup.ts` by installing a small `Request` subclass
   that resolves a leading-`/` string input against a fixed
   `http://localhost` origin before delegating to the real `Request`
   constructor. This is test-environment plumbing, not a change to any
   application code or to the `no raw fetch` constraint.
2. **MSW's fetch patch was applied too late.** `setup.ts` previously
   called `server.listen()` inside a `beforeAll` hook. Vitest imports a
   test file's whole module graph (including `PeopleView.vue` →
   `api/client.ts`, whose top-level `createClient()` call captures
   `globalThis.fetch` once, immediately) before running that file's
   hooks — so by the time `beforeAll` patched `fetch`, `client.ts` had
   already captured the original, unpatched one, and requests hit real
   sockets (`ECONNREFUSED`). Fixed by calling `server.listen(...)`
   synchronously at the top level of `setup.ts` (a designated Vitest
   `setupFiles` entry, guaranteed to run before any test file's own
   imports), instead of inside `beforeAll`.

Both fixes are scoped to `frontend/vitest.config.ts` and
`frontend/src/mocks/setup.ts` only — no application/runtime code
changed. I did not touch `frontend/src/api/client.ts`.

## Decisions / assumptions

- **Empty-state text**: used the design-system.md example verbatim —
  "No people yet — add one above." — since the spec's own edge-case
  section suggests exactly that string.
- **Failed-POST error copy**: the spec explicitly leaves this
  unspecified beyond "use Inline error text". I used "Couldn't add that
  person. Please try again." No retry/dismiss affordance beyond
  resubmitting the form, since none was described.
- **Disabled-button styling**: `disabled:cursor-not-allowed
  disabled:opacity-50`, per pm's stated default.
- **No shared store**: `PeopleView.vue` calls `GET /people`
  independently on mount, per the spec's explicit out-of-scope item.
- **Avatar initial**: `person.name.charAt(0).toUpperCase()` on the
  (already-trimmed, since it came from a successful `POST`) name — no
  special-casing for non-letter first characters, per the spec's edge
  case.
- Sizes/spacing rounded to the nearest stock Tailwind utility per
  design-system.md, with the one arbitrary-value class
  (`text-[15px]` for person-row name text) following the same pattern
  already used in `AppShell.vue` (`text-[11px]` for the tab bar label) —
  15px doesn't land on Tailwind's default scale (`text-sm`=14px,
  `text-base`=16px).

## Left out of scope (per spec's "Out of scope" section)

- No edit/delete UI or handlers.
- No participant/payer picker (issue #6).
- No Pinia/shared store.
- No loading spinner/skeleton for the initial fetch.
- No truncation rule for long names.
- No client-side name collapsing/uniqueness checks.

## Test coverage

`frontend/src/views/PeopleView.test.ts` (11 cases) plus the environment
fix covers acceptance criteria 2–13:

- Initial render replaces the placeholder (criterion 2).
- `GET /people` on mount renders name + avatar initial for every person
  (criterion 3), in server response order with no re-sort (criterion 13).
- Trimmed-name submission calls `POST /people` with the trimmed body,
  appends the row once the mocked `201` resolves, and clears the input
  (criterion 4).
- Blank/whitespace-only submission is a no-op (zero POST calls) and the
  submit control is disabled whenever the trimmed value is empty; a
  separate case confirms it becomes enabled once non-empty (criterion 5).
- Responsive markup: desktop "Add" button (`md:flex`/`hidden`) + visible
  subtitle vs. mobile icon-only button (`md:hidden`, `aria-label="Add
  person"`) + hidden subtitle — checked via class/attribute inspection,
  not a simulated viewport (criterion 6).
- No edit/delete/mutating control found in any person row (criterion 7).
- `maxlength="100"` on the input (criterion 12).
- Mock handlers share state: add via the form, remount, second `GET`
  includes the addition (criteria 8–9).
- Failed `POST` (forced via `server.use` override): inline error text
  appears, input is not cleared, no row is added (edge case coverage,
  not separately numbered but tied to the confirmed "Inline error text"
  decision).

`npm run build` (criterion 11) and `npm test` both pass; `npm test`
output: 3 files, 17 tests, all passing (includes the pre-existing
`AppShell.test.ts` and `tests/navigation.test.ts`, unmodified in
behavior — the environment fixes didn't change their outcomes).

## Not independently verified

Per my role, I have not done an independent qa-style pass against the
groomed spec's acceptance criteria — the above is my own account of
what was built and why. Visual fidelity against the mockups was checked
by reading the rendered Tailwind classes against `people.html`/
`people-mobile.html`, not by rendering the app in a real browser.

## Response to PR #21 review

The review (positive overall, "ship it after deciding on 1 and 2") raised
six numbered findings. Per-finding disposition below.

### 1. No double-submit guard — FIXED

Agreed, and cheap. Added a `submitting` ref in `PeopleView.vue`: set to
`true` at the top of `handleSubmit` (after the existing blank-input
early-return), reset in a `finally` block, and folded into both submit
buttons' `:disabled="!canSubmit || submitting"`. `handleSubmit` itself
also bails early if `submitting.value` is already true, so even a
programmatic second call (not just a disabled-button click) is a no-op.
Covered by a new test: `'ignores a second submit while the first POST
/people is still in flight (no double-add)'`, which holds the mocked
`POST` open via an unresolved promise, clicks twice, asserts exactly one
`POST` fired, then resolves and asserts exactly one row was added.

### 2. Network-level fetch failures unhandled — FIXED

Agreed with the review's own caveat: `openapi-fetch` only returns
`{ data, error }` for HTTP-status responses and throws on a transport
failure. Wrapped both `client.GET('/people')` (in `loadPeople`) and
`client.POST('/people', ...)` (in `handleSubmit`) in `try/catch`.

- `loadPeople`'s catch is a silent no-op (list stays empty) — the spec
  has no inline-error design for a failed *initial load*, only for a
  failed `POST` (see "Edge cases considered" → "Failed `POST
  /people`"), so I didn't invent one. A comment in the code says why.
- `handleSubmit`'s catch sets the same `error.value` message as the
  existing non-2xx path, since the spec's edge case for a failed POST
  says "a thrown error" explicitly and doesn't distinguish it from a
  mocked non-2xx for UI purposes.

Test: reusing the review's own suggested technique — `server.close()`
before the click so the request falls through MSW to a real `fetch`
against an address nothing listens on (genuine transport failure,
not a mocked status), then `server.listen(...)` again in a `finally` to
restore state for later tests. This is still "MSW is the only mocking
mechanism" in spirit: no hand-rolled fetch/stub is introduced, the real
network stack is just allowed to fail naturally for one request. Ran
this test standalone and in the full suite repeatedly; it resolves
near-instantly (loopback connection-refused, not a DNS/timeout wait) and
isn't flaky in this environment.

### 3. Add-person input has no accessible name — FIXED

Agreed — placeholders aren't an accessible name. Added
`aria-label="Add a person's name"` to the input, matching its
placeholder text, mirroring the existing `aria-label="Add person"`
pattern on the mobile icon button. Covered by a new test asserting
`getByRole('textbox', { name: "Add a person's name" })` resolves.

### 4. Inline error persists until the next submit — FIXED

Agreed this is a judgment call (design-system.md defers real
error/validation design), but it's a standard, cheap pattern and
strictly improves UX with no spec conflict. Added a `watch(newName, ...)`
that clears `error.value` whenever the input changes. Covered by a new
test: submit an invalid name, confirm the error appears, edit the input,
confirm the error is gone.

### 5. Test nits — mixed (fixed 2, skipped 2)

- `document.querySelector('.text-rose-600')` → **FIXED**. Replaced with
  `screen.getByText("Couldn't add that person. Please try again.")` in
  the existing failed-POST test, and used the same pattern in all new
  error-related tests. Cheap, and removes a CSS-class coupling.
- Enter-key submit path (Scope item 11) → **FIXED**. Added a test that
  updates the input then `fireEvent.submit`s the enclosing `<form>`
  (the standard Testing-Library way to simulate "Enter submits a form"
  under jsdom, which doesn't synthesize the browser's implicit-submission
  behavior from a raw keydown) and asserts the row is added and the
  input clears.
- Avatar assertions (`getByText('A')`) brittleness → **SKIPPED**. Real,
  but pre-existing and out of scope for a review-response pass — fixing
  it means restructuring the existing initial-render test's queries
  (e.g. scoping to the row container), which is unrelated to any of the
  four substantive findings and risks broadening this change beyond
  "respond to review." Leaving as-is; worth a follow-up if it ever
  actually causes a false pass.
- Responsive test asserting classes rather than two rendered viewports →
  **SKIPPED**. The review itself calls this "fine and pragmatic, just
  noting" — not a suggested change, just an acknowledged tradeoff (and
  the same pattern issue #3's own tests already established). Nothing to
  fix.

### 6. Coordination with #7 — acknowledged, no code change here

This is a cross-PR sequencing note, not something actionable inside
`issue-4`'s diff. No `client.ts` change was made in this PR (confirmed
unchanged), so the reconciliation the review describes (#7 dropping its
`client.ts` change and picking up `setup.ts`/`vitest.config.ts` on
rebase once #21 lands) is still exactly the situation on disk. Flagging
here for whoever merges #7 next, per the review's own suggested plan;
not a code change in scope for this response.

## Verification after review response

`cd frontend && npm test` → 3 files, 22 tests, all passing (17 prior +
1 double-submit-guard test + 1 transport-failure test + 1
stale-error-clears test + 1 Enter-key-submit test + 1 accessible-name
test = 22; the pre-existing failed-POST test was edited in place, not
added, so it's not a new count).

`cd frontend && npm run build` → exits 0 (`vue-tsc -b && vite build`),
same as before.
