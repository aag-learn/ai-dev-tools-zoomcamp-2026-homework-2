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

## QA fix round: desktop icon button size (Scope item 5)

qa-engineer's first pass found 15/16 acceptance criteria passing, plus
all four self-flagged concerns from the round above checked out fine.
The one confirmed defect: the desktop/tablet edit/delete icon buttons'
shared class list was `h-[30px] w-[30px] ... md:h-[28px] md:w-[28px]`.
Because the whole row block only renders at `md:` and up (`hidden ...
md:flex`), the unprefixed base `h-[30px]`/`w-[30px]` never actually
applied at any visible viewport -- `md:h-[28px]`/`md:w-[28px]` (active
at >=768px) won at *all* widths >=768px, including desktop (>=1024px),
since there was no `lg:` rule to override it back. qa-engineer verified
this by inspecting the compiled `dist` CSS output directly, not just
the source classes.

**Fix**: added an explicit `lg:h-[30px] lg:w-[30px]` to both the edit
and delete buttons' class lists in `ExpensesView.vue`, so the intended
three-tier sizing (30px base -- dead/unused since the block never
renders unprefixed, 28px at `md:`-only i.e. tablet, 30px at `lg:` i.e.
desktop) actually resolves correctly.

**Verification this time**: ran `npm run build` again and inspected
`frontend/dist/assets/*.css` directly (not just the source). Confirmed:

```
@media (width>=48rem){ ... .md\:h-\[28px\]{height:28px}.md\:w-\[28px\]{width:28px} ... }
@media (width>=64rem){ ... .lg\:h-\[30px\]{height:30px}.lg\:w-\[30px\]{width:30px} ... }
```

The `md:` (48rem = 768px) block appears before the `lg:` (64rem =
1024px) block in the compiled stylesheet. At widths >=1024px both media
queries match; since both selectors have identical specificity (single
class each), CSS resolves the tie by *source order* -- the later `lg:`
rule wins, giving 30px at desktop and 28px only in the 768-1023px
tablet band. This is the same kind of compiled-output check qa-engineer
used to catch the original bug, applied to confirm the fix actually
holds post-build rather than trusting the source class list looks
right.

Also added a new test case in `ExpensesView.test.ts` ("edit/delete icon
buttons are 28px at tablet (md:) and 30px at desktop (lg:), with an
explicit lg: override so it wins over md: at desktop widths") asserting
both buttons carry `md:h-[28px]`, `md:w-[28px]`, `lg:h-[30px]`, and
`lg:w-[30px]` in their class list, following the same class-presence
assertion pattern as the existing truncation/padding tests. `npm test`
-> 4 files, 37 tests, all passing (17 in `ExpensesView.test.ts`, up from
16). `npm run build` -> exits 0.

## Response to PR #24 review

Human review on PR #24 verdict: "Safe to merge", four non-blocking
notes. Went through each on its merits (no blocking issues, so no
change was required to merge, but per the team's own review-response
convention each note gets a real decision, not a rubber stamp):

1. **`handlers.ts` conflict with PR #23** -- acknowledged, no action
   needed here. This is a merge-sequencing question between two
   already-open PRs (#24/#5 and #23/#7), the same shape as the earlier
   #4/#7 `handlers.ts` conflict the orchestrator already resolved once.
   The reviewer already verified the union resolves cleanly (47/47
   tests + build). Nothing for this branch's code to change; flagging
   here purely so the record shows it wasn't missed.

2. **Mobile edit/delete buttons have no accessible name** --
   deferred to #6, not fixed here. Re-checked my own reasoning from the
   "Decisions / assumptions" section above and it still holds: the
   spec's own "Open questions" confirmed default is "Per-row
   `aria-label` scoped to desktop only, not tablet/mobile" (see
   `5-expense-list-view.md`), so the mobile block correctly has no
   `aria-label` per that confirmed default -- it's not an oversight,
   it's the spec as written. The reviewer's phrasing ("worth a
   deliberate follow-up in #6 rather than being forgotten") explicitly
   frames this as *not* a request to fix it in #5; they're asking that
   it not get silently dropped. I agree with deferring rather than
   fixing now: changing the confirmed default here would contradict
   this issue's own groomed spec without a corresponding spec update,
   and #6 (the add/edit expense form issue) is a more natural place to
   revisit per-row mobile control accessibility since it already touches
   those same controls. **Flagging explicitly for #6**: mobile edit/delete
   icon buttons in `ExpensesView.vue` currently render with no
   accessible name at all (icon-only, no `aria-label`, no visible text)
   -- worth deciding then whether to add mobile `aria-label`s or leave
   as a permanent, spec-confirmed default.

3. **Responsive padding override fragility** -- spot-checked, no
   bug found, no code change. Built the frontend (`npm run build`) and
   inspected `frontend/dist/assets/*.css` directly: `md:-mx-14`,
   `md:-my-12`, `md:px-8`, `md:py-9` (wrapper) and `md:px-14`,
   `md:pb-12` (parent `AppShell` `<main>`) all compile into the same
   `@media (width>=48rem)` block; `lg:mx-0`, `lg:my-0`, `lg:px-0`,
   `lg:py-0`, `lg:max-w-3xl` compile into the later `@media
   (width>=64rem)` block -- same source-order-wins-the-tie mechanism
   already verified for the icon-size fix above. Then drove a real
   headless Chromium (Playwright, already cached locally at
   `~/.cache/ms-playwright`; no new project dependency added) against
   the built `dist/` output and read `getComputedStyle` on both `<main>`
   and its child wrapper at both breakpoints:
   - **Tablet (800px viewport)**: `main` computed padding 48px
     top/bottom, 56px left/right; wrapper computed margin -48px
     top/bottom, -56px left/right (exact cancellation) plus wrapper
     padding 36px top/bottom, 32px left/right; wrapper `max-width:
     none`. Net content padding = 36px vertical / 32px horizontal,
     matching the spec's tablet target `py-9 px-8` (36px/32px) exactly,
     with no max-width cap, as item 7 requires.
   - **Desktop (1200px viewport)**: wrapper margin and padding both
     reset to 0px (the `lg:` overrides win), so `main`'s own 48px/56px
     padding shows through unmodified -- matching the spec's desktop
     target `py-12 px-14` (48px/56px) exactly. Wrapper `max-width:
     768px` (Tailwind's canonical `max-w-3xl`), consistent with the
     spec's own "`max-w-3xl`-ish, ~820px" phrasing (768px chosen as
     the nearest Tailwind utility, already documented above as a
     deliberate approximation, not a new finding).

   No residual offset at either breakpoint -- the negative-margin
   cancellation nets out to precisely the spec's numbers, not just
   approximately. Considering this verified; no code change made.
   (Script used for the Playwright check was scratch/throwaway, not
   committed -- it's a one-off measurement, not project test
   infrastructure.)

4. **No CI on the repo** -- acknowledged, no action needed. This is
   about the repository as a whole, not something addressable within a
   single feature branch/PR.

## Rebase-conflict resolution (post-hoc, after #7/PR #23 merged)

Issue #5 was built in parallel with issue #7 ("Balances view UI",
PR #23). Both branched off the same MSW scaffold state (post-#4), so
rebasing `issue-5` onto `main` (after #23 merged) produced a conflict in
exactly one file, matching what both PR #23's and PR #24's own reviews
had already predicted -- see #7's own notes file
(`specs/groomed/7-balances-view-ui.notes.md`, "Rebase-conflict
resolution" section) for the earlier #4/#7 instance of this same
pattern:

- **`frontend/src/mocks/handlers.ts`**: #7 added the real
  `GET /balances` handler (the `Balance` type import, the static
  `balances` array), #5 added the real `GET /expenses` and
  `DELETE /expenses/{expense_id}` handlers (the `Expense`/`Error` type
  imports, the `initialExpenses` seed data, the mutable `expenses` store,
  and `resetExpensesStore()`) -- both as pure additions to the same
  `handlers` array/file that already carried #4's `people`-related
  content, not competing edits to shared logic. Resolved by taking the
  union: all three type-import groups (`Person`/`PersonCreate`,
  `Balance`, `Expense`/`ErrorBody`), all three pieces of state
  (`people`/`nextPersonId` + `resetPeopleStore()`, the static `balances`
  array, and `initialExpenses`/`expenses` + `resetExpensesStore()`), and
  all five routes (`GET`/`POST /people`, `GET /balances`,
  `GET /expenses`, `DELETE /expenses/:expense_id`) registered together in
  one `handlers` array.

`jj resolve --list` confirmed this was the only conflicted file. After
resolving it by hand and squashing the fix down into the "implement
Expense list view" commit (the point the conflict was introduced --
`jj squash --into <that commit>`, same approach as the earlier #4/#7
resolution, so no commit in the `main..issue-5` range is left marked
conflicted even though a later commit "fixes" it), `jj resolve --list -r
main..issue-5` showed zero remaining conflicts across all four commits
in the range. Ran `npm test` (47/47 passing across 5 suites) and `npm
run build` (passes, including `vue-tsc` type-checking) from `frontend/`
-- no further adjustments were needed; the two features' MSW handlers
and mock stores coexist independently, exactly as both reviews had
already verified.
