---
issue: 5
label: groomed
---

# Expense list view

## Summary

Build the real Expenses screen — `frontend/src/views/ExpensesView.vue`,
replacing the placeholder `<h1>` scaffolded by issue #3 — showing every
expense in the group, most recent first, with a working per-row delete
action, wired against `GET /expenses` and `DELETE /expenses/{expense_id}`
(mocked via MSW during this phase, per
`specs/features/expense-splitter-poc.md`'s build order) through the
generated OpenAPI client. Layout and styling follow
`_docs/design-system.md`'s "Expense row" spec and the three Expenses
mockups (`expenses.html` desktop, `expenses-tablet.html`, and
`expenses-mobile.html`) in `_docs/design/mockups/standalone/`. This issue
is deliberately scoped to read + delete only; the add/edit form (issue #6)
is a separate, more complex surface (person picker, equal-split defaulting)
built independently.

## Scope

**Prerequisite gate** (see "Open questions" — this governs everything else
below):

1. This issue can only be implemented once `frontend/src/api/client.ts` and
   `frontend/src/api/schema.d.ts` both exist, generated from a real
   `openapi/openapi.yaml` — i.e. issue #3's acceptance criteria 10–12 have
   landed, which themselves require issue #1 to be merged first. As of this
   grooming, neither `openapi/` nor `frontend/` exist in the repo yet. If
   the prerequisite isn't met at implementation time, do not scaffold a
   project, fabricate a client, or hand-declare stand-in types — flag this
   issue as blocked on #1/#3 (e.g. a comment) and stop, following the same
   pattern `specs/groomed/3-scaffold-frontend-project.md` and
   `specs/groomed/4-people-management-ui.md` used for their own dependency
   on #1/#3.
2. This view resolves `payer_id`/`participant_ids` (integers, per
   `specs/groomed/1-define-openapi-contract.md`'s `Expense` schema) to
   person names for display, which requires a `GET /people` MSW handler.
   If issue #4 has already landed, its handler and shared in-memory people
   array (`specs/groomed/4-people-management-ui.md` criteria 8–9) are
   reused as-is — do not add a second, conflicting `GET /people` handler.
   If issue #4 has not landed yet, this issue adds a minimal `GET /people`
   handler itself (module-level in-memory array, typed against
   `frontend/src/api/schema.d.ts`) seeded with person records matching the
   IDs referenced by this issue's own seeded expense data (see item 15),
   purely so name resolution works; it does not add the `POST /people`
   handler, the People screen's add form, or any other part of issue #4's
   scope. See "Open questions" for why this cross-dependency exists even
   though it isn't listed on the GitHub issue.

**ExpensesView.vue content — desktop** (`lg:` and up, per `expenses.html`):

3. Page header: `h1` "Expenses" + muted subtitle "Most recent first." on
   the left; a primary "Add expense" button (leading 16px plus icon) on
   the right of the same row (design-system.md's "Page header" and
   "Primary button").
4. List/card container: white / `border-slate-200` / `rounded-xl`
   (design-system.md's "List/card container"); content padded `py-12
   px-14`, max width capped (`max-w-3xl`-ish, ~820px, per
   design-system.md's Spacing table).
5. One row per expense, single line (design-system.md's "Expense row"):
   description (15px/600) + meta line (13px/400, muted, not truncated —
   see item 14) stacked on the left; amount (15px/600) + a 30px edit
   (pencil) icon button (`aria-label="Edit {description}"`) + a 30px
   delete (trash) icon button (`aria-label="Delete {description}"`), in
   that order, on the right, each label interpolating that row's own
   expense description (e.g. an expense described "Groceries" renders
   `aria-label="Edit Groceries"` / `aria-label="Delete Groceries"`) so
   every row's buttons are distinguishable and locatable without relying
   on a CSS class or DOM position (see Acceptance criterion 16). Rows
   divided by `border-slate-100`, last row has no divider, per `py-4
   px-5`-ish row padding.
6. Meta line reads `"{date} · Paid by {payer name} · Split between
   {participant names}"` — e.g. "Oct 2 · Paid by Alice · Split between
   Alice, Bob, Priya, Sam" — always listing every participant's full name
   (never an "everyone" shorthand at this breakpoint; see item 9 for the
   mobile-only shorthand).

**ExpensesView.vue content — tablet** (`md:` only, per
`expenses-tablet.html` — this screen is the one place in the app with a
genuinely distinct tablet layout; see design-system.md's Responsive
behavior table):

7. Same header/row structure as desktop, but: content padding `py-9 px-8`
   (36px/32px) with no max-width cap; icon buttons 28px instead of 30px.
   Minor cosmetic deltas the mockup shows beyond this (e.g. 38px vs. 40px
   button height, 13px vs. 14px meta text) are not pixel-perfect
   requirements per design-system.md's general fidelity note — reusing the
   desktop sizes at `md:` is acceptable.
8. Unlike desktop, the meta line truncates to one line with an ellipsis
   when it overflows (matching `expenses-tablet.html`'s explicit
   `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` on that
   span, and requiring `min-width:0` on its flex ancestor so the ellipsis
   can actually engage).

**ExpensesView.vue content — mobile** (below `md:`, per
`expenses-mobile.html`):

9. Slim top bar: `h1` "Expenses" on the left, a 40px `bg-indigo-600`
   icon-only add button (plus icon only, `aria-label="Add expense"`) on
   the right — no subtitle rendered (matches `expenses-mobile.html`,
   which omits it, same pattern as issue #4's People screen).
10. Each row stacks to two lines (a real layout change, not just a
    narrower desktop row, per design-system.md's "Mobile-specific
    adaptations"): line one is description (15px/600) + amount (15px/600)
    space-between; line two is the meta text + edit/delete icon buttons
    (32px each on mobile, per design-system.md), space-between.
11. Mobile meta line truncates to one line with an ellipsis (`flex:1;
    min-width:0` on the text span, matching `expenses-mobile.html`),
    same mechanism as tablet.
12. Mobile-only wording: the meta line uses "Split with" instead of
    desktop/tablet's "Split between", and substitutes the shorthand
    "everyone" for the participant-name list whenever `participant_ids`
    includes every person currently returned by `GET /people` (i.e.
    `participant_ids.length === people.length`) — e.g. "Split with
    everyone" for a 4-of-4-person expense, "Split with Alice, Bob, Priya"
    for a 3-of-4-person expense. Desktop/tablet never use this shorthand;
    they always list full names, even when all people participate.
13. The bottom tab bar built by issue #3 remains visible and unchanged on
    this screen.

**Behavior** (all breakpoints):

14. Description text has no truncation rule at any breakpoint — a long
    description wraps and may make its row taller than its neighbors,
    matching `_docs/design-system.md`'s "What's not covered yet" (this is
    an acknowledged, pre-existing gap, not something this issue is
    expected to solve).
15. On mount, `ExpensesView.vue` calls `GET /expenses` and `GET /people`
    through the client from `frontend/src/api/client.ts`. Rows render in
    exactly the order `GET /expenses` returns (per
    `specs/groomed/1-define-openapi-contract.md`: `date` descending, `id`
    descending tiebreak) — no client-side re-sorting. Each row's payer
    name and participant names are resolved by looking up `payer_id`/each
    entry in `participant_ids` against the `GET /people` response by `id`;
    participant names are joined in ascending person-`id` order (i.e. the
    order `GET /people` returns them in), not whatever order
    `participant_ids` happens to list them in.
16. Amount is rendered as `$` followed by the number formatted to exactly
    2 decimal places (e.g. `84.2` → `$84.20`); no currency-locale/
    thousands-separator formatting is required (not exercised by any
    mocked amount, all under 1000).
17. Date is rendered as an abbreviated month name (`Jan`–`Dec`) + day of
    month with no leading zero and no year (e.g. `2026-10-02` → `Oct 2`),
    parsed from the contract's `YYYY-MM-DD` string — not `Date.prototype
    .toLocaleDateString()` or similar, since that varies by runtime
    locale/timezone and this project has no i18n requirement.
18. Clicking a row's delete (trash) icon button calls
    `DELETE /expenses/{expense_id}` for that row's `id` immediately — no
    confirmation dialog (none is designed; see "Open questions"). The row
    is removed from the rendered list only once the `204` response
    resolves — not optimistically before the response arrives, matching
    the non-optimistic pattern issue #4 used for adding a person.
19. If the `DELETE` call fails (mocked non-2xx or a thrown error), the row
    remains in the list; the exact visual error indicator shown to the
    user is unspecified — see "Open questions".
20. Clicking a row's edit (pencil) icon button, or the "Add expense"
    button in the header/top bar, has no effect in this issue — no modal,
    sheet, navigation, or console error. Both controls are rendered per
    the mockups for visual/layout fidelity with the "Expense row" and
    "Page header" components, but wiring them to open issue #6's add/edit
    form is that issue's responsibility (or a follow-up integration task,
    if #6 doesn't itself wire the trigger). Neither this issue's markup
    nor its tests should throw when these controls are clicked — they are
    inert by design in this issue.

**Mocking:**

21. `frontend/src/mocks/handlers.ts` gains handlers for `GET /expenses`
    and `DELETE /expenses/{expense_id}`, written against the
    `paths`/`components["schemas"]` types generated into
    `frontend/src/api/schema.d.ts` — never a hand-declared interface. Per
    item 2, it also gains (or reuses, if issue #4 already added one) a
    `GET /people` handler.
22. The mock `GET /expenses` handler is backed by a module-level in-memory
    array seeded with expense records mirroring the four sample expenses
    shown in `expenses.html` (Groceries $84.20, Electricity bill $132.00,
    Movie night $46.50, Internet $60.00, with the payer/participant
    patterns shown there), each referencing person IDs that resolve
    against whichever `GET /people` mock data is in effect per item 2.
23. The mock `DELETE /expenses/{expense_id}` handler removes the matching
    record from that same in-memory array and returns `204` with no body;
    for an `expense_id` not present in the array, it returns `404` with an
    `Error`-shaped body (`{ detail: ... }`), matching the contract. A
    subsequent `GET /expenses` reflects the removal, so the mocked screen
    behaves consistently across interactions within one dev/test session.

## Out of scope

- The add/edit expense form itself (modal on desktop/tablet, full-screen
  sheet on mobile), its validation, and its payer/participant picker —
  issue #6.
- Wiring the "Add expense" button or a row's edit icon to actually open
  that form — deferred to issue #6 (or a follow-up integration task if #6
  doesn't cover it itself); see Scope item 20.
- A confirmation dialog before deleting an expense — none is designed;
  see "Open questions".
- A fully designed error/validation state for a failed `DELETE` — not
  covered by `_docs/design-system.md`; see "Open questions".
- A fully designed empty state (zero expenses) — `_docs/design-system.md`
  explicitly lists this as undesigned; see "Open questions" for the
  interim default this spec assumes.
- Loading spinners/skeletons for the initial `GET /expenses`/`GET /people`
  fetch — `_docs/design-system.md` lists loading states under "What's not
  covered yet"; the screen simply renders an empty list until data
  arrives.
- Truncation of the description line at any breakpoint — an acknowledged
  gap per `_docs/design-system.md`'s "What's not covered yet" (see Scope
  item 14); not solved here.
- Implementing the `GET /expenses`/`DELETE /expenses/{expense_id}` (or
  `POST`/`PUT /expenses/{expense_id}`) backend routes — issue #12.
- Writing `openapi/openapi.yaml` itself — issue #1.
- Scaffolding the frontend project, router, app shell, or MSW wiring —
  issue #3; this issue only fills in `ExpensesView.vue`'s content inside
  that existing shell.
- The People screen's own add-person form/list UI — issue #4; this issue
  only reuses (or, if #4 hasn't landed, minimally stands up) a
  `GET /people` mock handler for name resolution, per Scope item 2. If a
  human wants issue #5 to formally depend on #4 given this, that's a
  GitHub-issue-metadata change to make separately — see "Open questions".
- The Balances view — issue #7.
- A shared/global store (e.g. Pinia) for expenses or people across
  screens — `_docs/architecture.md` doesn't mention a state-management
  library for this project; this screen fetches both `GET /expenses` and
  `GET /people` independently on its own mount, same as issue #4's screen
  does for `GET /people`.

## Acceptance criteria

1. **Prerequisite check**: if `frontend/src/api/client.ts` and
   `frontend/src/api/schema.d.ts` do not both exist at implementation
   time, none of criteria 2–20 below are attempted — no `ExpensesView.vue`
   content, MSW handler, or fabricated client/types are added as a
   stand-in; a comment is left on this issue noting it's blocked on
   #1/#3 instead.
2. Given the prerequisite is met, `frontend/src/views/ExpensesView.vue` no
   longer renders only the placeholder `<h1>` from issue #3; it renders
   the header and expense list described in Scope items 3–13.
3. On mount, `ExpensesView.vue` calls `GET /expenses` and `GET /people`
   through the client from `frontend/src/api/client.ts`. Every expense in
   the resolved `GET /expenses` response is rendered as a row, in the
   exact order returned (no client-side re-sort), showing its
   description, amount formatted as `$X.XX`, date formatted as
   abbreviated-month + day with no year, resolved payer name, and
   resolved participant names — resolution done by matching
   `payer_id`/`participant_ids` against the `GET /people` response by
   `id`.
4. Desktop (`lg:` and up): each row's meta line reads "{date} · Paid by
   {payer} · Split between {all participant names, comma-separated,
   ascending person-id order}" with no ellipsis/truncation applied, even
   when the text is long enough to overflow the row.
5. Tablet (`md:`) and mobile (below `md:`): the meta line truncates to a
   single line with an ellipsis when it overflows — checkable by
   inspecting the rendered markup for `overflow:hidden`/`text-overflow:
   ellipsis`-equivalent Tailwind classes (e.g. `truncate`) on that
   element and `min-w-0` on its flex ancestor.
6. Mobile only (below `md:`): the meta line uses "Split with" (not
   "Split between") and renders "everyone" instead of the full
   participant-name list when, and only when,
   `participant_ids.length === people.length` for that expense at render
   time; otherwise it lists the participant names as on desktop/tablet.
7. Mobile row layout: description + amount render on one line
   (space-between), and meta text + edit/delete icon buttons render on a
   second line (space-between) beneath it — checkable by inspecting the
   rendered markup's structure (e.g. two stacked flex rows within the
   expense-row container), not by simulating an actual narrow viewport in
   Vitest/JSDOM (same caveat as `specs/groomed/3-scaffold-frontend-project.md`'s
   criterion 5 and `specs/groomed/4-people-management-ui.md`'s criterion 6).
8. Desktop/tablet (`md:` and up): the header renders both the `h1`
   "Expenses" and the subtitle "Most recent first.", plus a primary
   button labeled "Add expense" with a leading plus icon. Mobile (below
   `md:`): no subtitle is rendered, and the add control is a 40px
   icon-only button (plus icon, no text) with `aria-label="Add expense"`
   in a top bar next to the `h1` — checkable by inspecting which
   responsive Tailwind classes gate each variant in the rendered markup.
9. Clicking a row's delete icon button calls `DELETE /expenses/{id}` for
   that row's `id`; once the mocked `204` resolves, that row is no longer
   present in the rendered list. Before the `204` resolves, the row is
   still present (proving the removal isn't optimistic).
10. If the mocked `DELETE /expenses/{id}` call fails (e.g. a `404`), the
    row remains in the rendered list after the failed response resolves.
11. Clicking a row's edit icon button, or the header/top-bar "Add
    expense" control, does not throw, does not change the route, and does
    not add/remove/alter any rendered row — verified by a test that
    clicks each and asserts the rendered list and current route are
    unchanged.
12. `frontend/src/mocks/handlers.ts` exports handlers for `GET /expenses`
    and `DELETE /expenses/{expense_id}` (in addition to a `GET /people`
    handler — reused from issue #4 if present, otherwise added minimally
    by this issue per Scope item 2), typed against
    `frontend/src/api/schema.d.ts`'s generated types.
13. Deleting an expense via the row's delete button, then triggering a
    second `GET /expenses` (e.g. by remounting `ExpensesView.vue` in a
    test), returns and renders a list that no longer includes the deleted
    expense — proving the mock `DELETE` handler in criterion 12 mutates
    the same in-memory state `GET /expenses` reads from.
14. A Vitest test co-located with `ExpensesView.vue` (or a subcomponent it
    uses) exercises, against the MSW-mocked handlers from criterion 12:
    (a) initial list render from `GET /expenses`/`GET /people` in the
    order returned, with correctly resolved payer/participant names; (b)
    deleting a row removes it from the rendered list only after the
    mocked `204` resolves; (c) a failed delete leaves the row in place;
    (d) clicking the edit icon or "Add expense" control is a no-op (per
    criterion 11).
15. `cd frontend && npm test` passes, including the tests from criterion
    14, and `cd frontend && npm run build` still exits 0 with
    `ExpensesView.vue`'s real content in place.
16. Desktop (`lg:` and up): each row's edit icon button has an
    `aria-label` of the form `"Edit {description}"` and each row's delete
    icon button has an `aria-label` of the form `"Delete {description}"`,
    where `{description}` is that row's own rendered expense description
    (e.g. a row for an expense described "Groceries" has an edit button
    with `aria-label="Edit Groceries"` and a delete button with
    `aria-label="Delete Groceries"`) — checkable by inspecting the
    rendered markup's `aria-label` attributes on each row's edit/delete
    buttons and confirming they vary per row and match that row's
    description text. This gives each row's controls a reliable,
    non-CSS-class way to be located (e.g. by an accessible-role/name
    query), matching the pattern already required of the mobile
    icon-only "Add expense" button (criterion 8).

## Edge cases considered

- **Empty list (zero expenses)**: renders the list card container with a
  single muted text row (e.g. "No expenses yet — add one above.") rather
  than an empty white box with no content or affordance, matching the
  interim default issue #4 assumed for zero people. Flagged as an
  assumption in "Open questions" since `_docs/design-system.md`
  explicitly lists this as an undesigned state.
- **Failed `DELETE /expenses/{id}`** (mocked non-2xx or a thrown error):
  the row is not removed (criterion 9/10), but the exact visual error
  indicator shown to the user is left unspecified — see "Open questions".
- **A person referenced by `payer_id`/`participant_ids` missing from the
  `GET /people` response**: not expected in normal operation, since
  people are never deleted in v1 (per
  `specs/features/expense-splitter-poc.md`'s exclusions) and any `id` that
  was ever valid stays valid (per
  `specs/groomed/1-define-openapi-contract.md`'s edge cases) — but if the
  two mocked datasets (Scope item 2) ever disagree, the lookup falls back
  to rendering the raw numeric id rather than throwing or crashing the
  row.
- **All participants selected vs. a subset, on mobile**: the "everyone"
  shorthand (Scope item 12) is re-evaluated per expense against the
  current `GET /people` response length, not hardcoded to a fixed
  four-person group — if the group's total size changes, an expense that
  previously covered "everyone" but no longer does (or vice versa) is
  reflected correctly on next fetch.
- **Duplicate delete clicks / double-submit**: not specially debounced;
  a second `DELETE` for an already-removed row would hit the mock's `404`
  path (Scope item 23) rather than silently no-op — acceptable since the
  row is only removed after the first request's `204` resolves, at which
  point its delete button is no longer in the DOM to be clicked again.
- **Long participant lists on desktop**: since desktop never truncates
  (Scope item 6/Acceptance criterion 4), a very long comma-separated name
  list can wrap or extend the row — not addressed by this issue, same
  "not covered yet" gap as long descriptions.
- **Two expenses sharing an identical description**: their `aria-label`s
  (criterion 16) are identical text, which is acceptable — consumers
  (e.g. `specs/groomed/16-end-to-end-playwright-test-suite.md`'s e2e
  suite) are expected to scope their locator to a specific row (e.g. via
  that row's container) before finding the edit/delete button within it,
  the same way they'd already have to disambiguate identical description
  text elsewhere in the row.

## Constraints

- Vue components use `<script setup lang="ts">`, per
  `_docs/architecture.md`.
- No new dependency is added to `frontend/package.json` for this issue —
  everything needed (Vue, MSW, the generated client) is already declared
  per issue #3's acceptance criterion 1; ask first if something's missing,
  per `AGENTS.md`.
- Styling is Tailwind utility classes only, matching the
  `_docs/design-system.md` tokens named in Scope — no CSS-in-JS and no
  hand-written arbitrary values beyond the roundings that doc already
  calls acceptable.
- All API calls go through the client exported from
  `frontend/src/api/client.ts` (`openapi-fetch`) — no raw `fetch`/`XHR`
  calls, and no hand-declared TypeScript interface standing in for the
  generated schema types.
- MSW is the only mocking mechanism used for this screen in dev and
  tests — no separate hand-rolled fixture module bypassing it.
- Date/amount formatting (Scope items 16–17) is implemented with plain
  JS/TS string manipulation or a small local helper, not a new date/number
  formatting library dependency, per the no-new-dependency constraint
  above.

## Open questions

- **Hard sequencing dependency on issues #1 and #3**: as of this
  grooming, neither `openapi/openapi.yaml` nor `frontend/` exist in this
  repo. This spec assumes both land — specifically issue #3's acceptance
  criteria 10–12, themselves gated on #1 — before this issue's work
  begins. Acceptance criterion 1 makes that gate explicit, same pattern as
  `specs/groomed/4-people-management-ui.md`.
- **Undeclared cross-dependency on issue #4 (or at least on a `GET
  /people` mock handler)**: the GitHub issue lists dependencies as
  "#1, #2, #3" only, but this screen cannot resolve payer/participant
  names without `GET /people` data. This spec resolves the gap by having
  this issue reuse issue #4's handler if it's already landed, or stand up
  a minimal one itself otherwise (Scope item 2) — so implementation isn't
  blocked either way. Flag if a human would rather formally add #4 as a
  declared dependency on the GitHub issue instead of leaving this
  implementation-level workaround.
- **No confirmation dialog before delete**: `_docs/design-system.md` and
  the mockups don't show one, so this spec assumes the delete icon button
  deletes immediately (Scope item 18), matching how the mockups render it
  as a plain icon button with no modal affordance. Flag if a
  confirm-before-delete interaction is actually wanted — that would be a
  design change beyond what's mocked today.
- **Empty-state design**: `_docs/design-system.md` explicitly lists "zero
  expenses" as undesigned. This spec assumes a minimal muted-text row
  inside the existing list container (see "Edge cases considered"),
  mirroring the interim default issue #4 used for zero people. Flag if a
  real empty-state design is wanted before implementation.
- **Error/validation-state design for a failed delete**: undesigned for
  this screen (design-system.md only calls this out for the expense
  form). This spec leaves the exact visual treatment (inline text, toast,
  etc.) to the implementer as long as the row isn't silently removed;
  flag if a specific treatment is required.
- **Rendering inert edit/add controls vs. hiding them**: this spec assumes
  the "Add expense" button and each row's edit icon should still render
  (matching the mockups' "Expense row"/"Page header" components exactly)
  even though clicking them does nothing until issue #6 lands, rather
  than hiding them until #6 is ready. Flag if hiding them until #6 lands
  is actually preferred — that would change Scope item 20 and Acceptance
  criterion 11.
- **Disabled/hover styling for icon buttons**: no hover-state visual is
  specified in `_docs/design-system.md`'s "Icon button" section beyond a
  note that a real implementation should add hover feedback the static
  mockup doesn't show. Assumed a standard Tailwind `hover:bg-slate-100`
  (or similar subtle) treatment; flag if a specific style is required.
- **Per-row `aria-label` scoped to desktop only, not tablet/mobile**:
  Acceptance criterion 16 mandates `"Edit {description}"`/`"Delete
  {description}"` accessible names only for the `lg:` (desktop) edit/
  delete buttons, per the gap identified while grooming
  `specs/groomed/16-end-to-end-playwright-test-suite.md` (its e2e suite
  runs only at Playwright's default desktop-sized viewport, per that
  spec's Out of scope). Since Scope item 7 already says tablet reuses
  "the same header/row structure as desktop" for the same markup, an
  implementation that shares row markup across `md:`/`lg:` will likely
  carry these labels onto tablet's buttons for free; that's acceptable
  but not separately required here. This spec does not mandate an
  equivalent labeled pattern for the mobile two-line row's edit/delete
  buttons (Scope item 10) — flag if mobile accessible names for these two
  buttons are also wanted, e.g. for a future mobile-viewport e2e pass.
