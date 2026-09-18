# Implementation notes: Expense list view (#5)

## Prerequisite gate

`frontend/src/api/client.ts` and `frontend/src/api/schema.d.ts` both
existed at implementation time (issues #1/#3 merged), and issue #4
(People management UI) had already merged, so the full scope was
implemented -- the "blocked" fallback in criterion 1 did not apply, and
Scope item 2's "stand up a minimal GET /people handler myself" branch
did not trigger either: I reused issue #4's `GET /people` handler and
shared in-memory `people` array as-is, unmodified.

## Files changed

- `frontend/src/views/ExpensesView.vue` -- replaced the placeholder
  `<h1>` with the real header + expense list, desktop/tablet and mobile
  variants, per Scope items 3-20.
- `frontend/src/components/icons/PencilIcon.vue`,
  `frontend/src/components/icons/TrashIcon.vue` -- new icon components,
  following the existing `PersonIcon.vue`/`ReceiptIcon.vue` pattern
  (24x24 viewBox, `currentColor`, `stroke-width="1.75"`), paths lifted
  directly from `expenses.html`'s inline SVGs.
- `frontend/src/mocks/handlers.ts` -- added typed `GET /expenses` and
  `DELETE /expenses/{expense_id}` handlers sharing a module-level
  in-memory array/reset function, built against
  `components["schemas"]["Expense"|"Error"]` from `schema.d.ts`,
  following the exact same shape as the existing `GET`/`POST /people`
  handlers. Also exports `resetExpensesStore()`, used only by
  `ExpensesView.test.ts` in a `beforeEach`, mirroring
  `resetPeopleStore()`. `GET /people`/`POST /people` themselves are
  untouched (reused from #4 per Scope item 2).
- `frontend/src/views/ExpensesView.test.ts` -- new, co-located test file
  (16 cases) covering the acceptance criteria (see below).

## Seed data (Scope items 21-22)

The mocked `GET /expenses` in-memory array is seeded with the four
sample expenses from `expenses.html` (Groceries $84.20, Electricity
bill $132.00, Movie night $46.50, Internet $60.00), referencing person
ids 1-4 (Alice/Bob/Priya/Sam), matching the ids those names would get
if created via `POST /people` in that order -- but since issue #4's
`people` store starts **empty** (no dev-mode seed data, confirmed by
reading `4-people-management-ui.notes.md`), a fresh `npm run dev`
session will show these four expenses with `payer`/`participant` names
falling back to raw numeric ids until a human manually adds Alice, Bob,
Priya, and Sam via the People screen. This is exactly the scenario the
spec's own edge case ("A person referenced by payer_id/participant_ids
missing from the GET /people response") anticipates and explicitly
accepts, so I did not add any additional people-seeding beyond what
issue #4 already established. Tests seed matching people via `POST
/people` (same `seedPerson` pattern `PeopleView.test.ts` uses) before
asserting resolved names.

Dates used: 2024-10-02, 2024-09-28, 2024-09-25, 2024-09-20 (year not
shown in any mockup or spec text; chosen arbitrarily, descending order
preserved to match "most recent first").

## Decisions / assumptions

- **Participant-name resolution with per-id fallback**: `participantNames`
  sorts `participant_ids` ascending and resolves each individually via
  `personName` (which falls back to the raw id) rather than filtering
  the `GET /people` response -- the latter would silently *drop* an
  unresolvable id instead of rendering it, which contradicts the edge
  case's explicit "falls back to rendering the raw numeric id rather
  than throwing **or crashing the row**" (i.e. the row, and the
  participant list within it, should stay intact and visible even with
  a stale id).
- **Delete error copy**: "Couldn't delete that expense. Please try
  again." -- mirrors #4's "Couldn't add that person. Please try again."
  wording pattern, per the confirmed "Inline error text" component
  applied consistently across #4/#5/#6.
- **Empty-state text**: "No expenses yet — add one above." -- the
  design-system.md example, matching #4's pattern for its own empty
  state ("No people yet — add one above.").
- **Disabled/hover styling**: `hover:bg-slate-100` on all icon buttons,
  per pm's stated default in the spec's "Open questions".
- **No accessible name on tablet/mobile edit/delete buttons**: per the
  spec's confirmed default ("Per-row aria-label scoped to desktop only,
  not tablet/mobile"), I did not add `aria-label` to the mobile block's
  edit/delete buttons. They render with no accessible name at all on
  mobile (icon-only, no visible text) -- a real, known a11y gap, but
  the spec explicitly confirmed this default rather than asking for a
  fix, and the e2e suite (issue #16) is desktop-only per its own scope.
  The desktop/tablet block's buttons *do* carry `aria-label`s (Scope
  item 5 requires it for desktop, and tablet reuses the exact same
  markup block per item 7's "same header/row structure as desktop" --
  there's no separate template branch to selectively omit it for
  tablet-only), so in practice tablet gets the aria-label too. That's a
  superset of what criterion 16 requires (desktop only), not a
  violation of it.
- **Responsive page-content padding/max-width override (Scope items 4
  and 7)**: `AppShell.vue` (issue #3, out of scope here) applies a
  single shared `px-8 py-12 md:px-14 pb-24 md:pb-12` to `<main>` for
  every screen -- i.e. desktop-sized padding (56px/48px) uniformly from
  `md:` (768px) up, with no distinct tablet tier and no max-width cap.
  That already happens to match this issue's desktop target exactly,
  but not tablet's (which needs smaller 32px/36px padding and no
  max-width cap, only `lg:` gets the 820px-ish cap). Since editing
  `AppShell.vue` is out of scope (issue #3) and `PeopleView.vue` doesn't
  need this distinction (no tablet-specific delta, no max-width, per
  its own spec), I added a wrapper `<div>` inside `ExpensesView.vue`
  that cancels the parent's inherited `md:` padding via negative
  margins (`md:-mx-14 md:-my-12`) and reapplies the exact three-tier
  scheme from the spec: mobile inherits `AppShell`'s own padding
  untouched; tablet (`md:` only) gets `px-8 py-9`; desktop (`lg:`) zeroes
  the wrapper's own padding back out (`lg:px-0 lg:py-0 lg:mx-0 lg:my-0`),
  letting the parent's already-correct 56px/48px padding show through
  unchanged, plus `lg:max-w-3xl` for the cap. I used `lg:mx-0` (not
  `lg:mx-auto`) for the cap's horizontal centering, since the
  `expenses.html` mockup's own content div (`flex:1; padding:...;
  max-width:820px`) has no auto-margin centering -- it's a `flex:1` box
  that stops growing at the cap and stays left-aligned, not centered.
  This isn't independently exercised by any of the 16 acceptance
  criteria (none assert computed padding/margin values, only class
  presence for the truncation criteria), so it's unverified by the test
  suite -- flagging for qa-engineer's own visual/class inspection if
  desired.
- **Date seed year**: arbitrary (2024); the spec's mockups never state a
  year, and the contract's `date` field is a bare `YYYY-MM-DD` string
  with no timezone/locale handling per the spec's own note on
  `formatDate`.
- **`data-testid="expense-row-{id}"` on each row wrapper**: not
  mentioned by the spec, added purely as a test-scoping aid. Both the
  desktop/tablet and mobile blocks are always present in the DOM
  simultaneously (CSS `hidden`/`md:flex`/`md:hidden` toggles visibility,
  which JSDOM doesn't apply layout for), so most queries need to be
  scoped to a specific row and/or breakpoint block to avoid ambiguous
  multi-match errors -- this mirrors `AppShell.test.ts`'s own use of
  `data-testid="sidebar"`/`"tabbar"` for the same reason (sidebar nav
  and tab-bar nav render the same three items simultaneously). Not a
  CSS-class-based locator, so doesn't conflict with criterion 16's
  intent for the *design's own* per-row controls (aria-label).

## Left out of scope (per spec's "Out of scope" section)

- No add/edit expense form, modal, or full-screen sheet (issue #6).
- Edit icon button and both "Add expense" controls render but do
  nothing (no `@click` handler at all -- a plain `type="button"` with no
  handler is inherently a no-op, satisfying "does not throw" trivially).
- No confirmation dialog before delete.
- No Pinia/shared store -- `ExpensesView.vue` calls `GET /expenses` and
  `GET /people` independently on its own mount.
- No loading spinner/skeleton for the initial fetch.
- No truncation rule for the description line at any breakpoint.

## Test coverage

`frontend/src/views/ExpensesView.test.ts` (16 cases) covers acceptance
criteria 2-16:

- Initial render replaces the placeholder (criterion 2).
- `GET /expenses`/`GET /people` on mount, rows in server-response order,
  resolved names/amount/date formatting (criterion 3), plus a dedicated
  case for the raw-numeric-id fallback edge case (not separately
  numbered, but documented in "Edge cases considered").
- Desktop meta line: no truncation classes active, full participant list
  (criterion 4).
- Tablet/mobile meta line: truncation classes + `min-w-0` flex ancestor
  present (criterion 5).
- Mobile-only "Split with"/"everyone" shorthand, evaluated per expense
  (criterion 6).
- Mobile two-stacked-line row structure (criterion 7).
- Header/top-bar responsive variants: subtitle, labeled vs. icon-only
  "Add expense" (criterion 8).
- Delete removes the row only after the mocked `204` resolves, not
  optimistically before (criterion 9).
- Failed delete (404) leaves the row in place, with inline error text
  (criterion 10).
- `GET /expenses`/`DELETE /expenses/{expense_id}` handlers, typed
  against `schema.d.ts` (criterion 12, exercised structurally by every
  other test using them).
- Delete + remount reflects the removal via the shared in-memory store
  (criterion 13).
- Edit icon and both "Add expense" controls are no-ops: no throw, no
  route change, list unchanged (criterion 11).
- Desktop-scoped per-row `aria-label`s on edit/delete buttons, varying
  by description (criterion 16).
- Empty-state row instead of an empty white box (edge case, not
  separately numbered).

`cd frontend && npm test` -> 4 files, 36 tests, all passing (16 new +
20 pre-existing, unmodified in behavior).

`cd frontend && npm run build` -> exits 0 (`vue-tsc -b && vite build`).

## Not independently verified

Per my role, I have not done an independent qa-style pass against the
groomed spec's acceptance criteria -- the above is my own account of
what was built and why. Visual fidelity against the mockups was checked
by reading the rendered Tailwind classes against `expenses.html`/
`expenses-tablet.html`/`expenses-mobile.html`, not by rendering the app
in a real browser at each breakpoint. In particular, the padding/margin
override described above (Scope items 4/7) is my own derivation from
the mockups' pixel values and is not verified against an actual
rendered layout -- worth a real-browser spot-check.
