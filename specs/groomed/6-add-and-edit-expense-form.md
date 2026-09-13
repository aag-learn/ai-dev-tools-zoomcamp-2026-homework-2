---
issue: 6
label: groomed
---

# Add and edit expense form

## Summary

Build `frontend/src/components/ExpenseForm.vue`, a shared modal
(desktop/tablet) / full-screen-sheet (mobile) component used for both adding
a new expense and editing an existing one — description, amount, payer,
date, participants (checkbox list, defaulting to everyone currently in the
group) — wired against `POST /expenses` and `PUT /expenses/{expense_id}`
(mocked via MSW during this phase, per
`specs/features/expense-splitter-poc.md`'s build order) through the
generated OpenAPI client. This issue also wires up the two triggers that
`specs/groomed/5-expense-list-view.md` deliberately left inert: the
"Add expense" button and each row's edit (pencil) icon in
`frontend/src/views/ExpensesView.vue` now open this form, in add and edit
mode respectively. Layout and styling follow `_docs/design-system.md`'s
"Modal dialog", "Full-screen sheet", "Form field group", and "Checkbox
(participant selector)" sections, and the `expense-form.html`
(desktop/tablet) and `expense-form-mobile.html` (mobile) mockups in
`_docs/design/mockups/standalone/`.

## Scope

**Prerequisite gate** (see "Open questions" — this governs everything else
below):

1. This issue can only be implemented once all of the following exist:
   - `frontend/src/api/client.ts` and `frontend/src/api/schema.d.ts`,
     generated from a real `openapi/openapi.yaml` (issue #3's acceptance
     criteria 10–12, themselves gated on issue #1).
   - A `GET /people` MSW handler with shared in-memory state (added by
     issue #4, or by issue #5 as its own minimal stand-in if #4 hadn't
     landed yet — see `specs/groomed/5-expense-list-view.md` scope item 2).
   - `frontend/src/views/ExpensesView.vue`'s real content from
     `specs/groomed/5-expense-list-view.md` (header, list, "Add expense"
     button, per-row edit/delete icons, `GET /expenses`/
     `DELETE /expenses/{expense_id}` mock handlers) — this issue edits that
     file to wire its two inert controls, so it cannot start from #3's
     placeholder `<h1>` alone.

   As of this grooming, none of `openapi/`, `frontend/`, or a real
   `ExpensesView.vue` exist in the repo yet. If any of the above isn't met
   at implementation time, do not scaffold a project, fabricate a
   client/types, or hand-write a stand-in `ExpensesView.vue` — flag this
   issue as blocked on the missing prerequisite(s) (e.g. a comment) and
   stop, following the same pattern `specs/groomed/3-scaffold-frontend-project.md`,
   `specs/groomed/4-people-management-ui.md`, and
   `specs/groomed/5-expense-list-view.md` used for their own dependencies.

**`ExpenseForm.vue` component — props and events:**

2. Props: `open: boolean` (controls visibility; the component is always
   mounted in `ExpensesView.vue`, visibility is prop-driven, not
   self-managed), `mode: 'add' | 'edit'`, `expense: Expense | null`
   (required — the full `Expense` object being edited — when
   `mode === 'edit'`; `null` when `mode === 'add'`), `people: Person[]`
   (the already-fetched list from `ExpensesView.vue`'s own `GET /people`
   call per `specs/groomed/5-expense-list-view.md` scope item 15 — this
   component does not perform its own `GET /people` fetch, avoiding a
   redundant request within the same mounted view).
3. Events: `close` (user cancelled — X icon, "Cancel", backdrop click, or
   Escape key; no network call happens) and `saved` (the `POST`/`PUT` call
   succeeded — carries no payload; the parent is responsible for
   re-fetching the list, per item 15 below).
4. Because `mode`/`expense`/`people` are unknown to the API contract's
   `GET /expenses/{id}` (which doesn't exist, per
   `specs/groomed/1-define-openapi-contract.md`'s "Out of scope"), edit
   mode is seeded entirely from the `expense` object the parent already
   holds in its fetched list — no network call is made to load the
   expense being edited.

**Rendering — desktop/tablet** (`md:` and up, per `expense-form.html` —
rendered as a centered modal):

5. `rgba(15,23,42,0.45)` backdrop; centered white card, 480px wide,
   `rounded-2xl`, drop shadow, 28px padding (design-system.md's "Modal
   dialog").
6. Header row: title ("Add expense" in add mode, "Edit expense" in edit
   mode) + a close (X) icon button that emits `close`.
7. Footer: right-aligned ghost "Cancel" button (emits `close`) + primary
   "Save expense" button (submits the form) — same label in both modes,
   per "Open questions."

**Rendering — mobile** (below `md:`, per `expense-form-mobile.html` —
rendered as a full-screen sheet, not a modal):

8. No backdrop; the sheet fills the viewport, white background.
9. Header is a three-part bar: ghost "Cancel" text button (left, emits
   `close`), title centered ("Add expense" / "Edit expense", same rule as
   item 6), primary "Save" text button (right, submits the form) — no
   separate footer, per design-system.md's "Full-screen sheet."
10. Payer and Date fields stack full-width (one per row), not side by side
    — the desktop/tablet two-column layout for these two fields (item 12)
    doesn't apply on mobile, per design-system.md's "Mobile-specific
    adaptations."

**Form fields (both breakpoints, per `expense-form.html`/
`expense-form-mobile.html`):**

11. **Description** — text `<input>`, label "Description", placeholder
    "e.g. Groceries", `maxlength="200"` matching `Expense.description`'s
    `maxLength: 200` (`specs/groomed/1-define-openapi-contract.md`).
12. **Amount** — bordered box with a static "$" prefix inside it (not a
    separate label) and a text `<input>` for the numeric value, label
    "Amount", placeholder "0.00" (design-system.md's "Text input"). On
    desktop/tablet this sits side by side with Date's row per the mockup's
    two-field row grouping — actually per the mockup, Description and
    Amount are each full-width, and Payer/Date are the side-by-side pair
    (see item 11 above and item 13 below for the correct grouping: Payer +
    Date share a row, Description and Amount are each their own full-width
    row).
13. **Paid by** and **Date** share one row on desktop/tablet (`flex`, each
    taking half the width); each is a custom-styled bordered box (not a
    native `<select>`/`<input type=date>`, per design-system.md's "Custom
    select / date control"): Paid by shows the selected person's name with
    a trailing chevron-down icon and opens a list of `people` to choose
    from; Date shows the selected date formatted as abbreviated month +
    day (no leading zero) + comma + 4-digit year (e.g. "Oct 4, 2025") with
    a trailing calendar icon and opens a date-selection control. See "Open
    questions" for the exact interaction mechanism, which is left
    implementer-flexible as long as the closed-state box matches this
    styling and no native default-chrome control is visibly rendered.
14. **Split between** — label, then a bordered container (`rounded-lg`,
    `border-slate-200`) listing every person in `people`, each row a
    checkbox (design-system.md's "Checkbox (participant selector)": 18px
    `rounded` box, checked = `bg-indigo-600` + white check icon, unchecked
    = white + `border-slate-300` outline) plus the person's name; below the
    list, muted helper text "Splits equally between everyone selected."
15. If `people` is empty when the form opens (no people in the group yet),
    the Paid by, Date, and Split-between controls are replaced by a single
    muted message (e.g. "Add at least one person before creating an
    expense.") and the Save control is disabled — mirrors the interim
    empty-state pattern `specs/groomed/4-people-management-ui.md` and
    `specs/groomed/5-expense-list-view.md` used elsewhere.

**Defaulting behavior:**

16. **Add mode, on open**: Description empty, Amount empty, Paid by
    unselected (shows a muted placeholder, e.g. "Select a person" — see
    "Open questions"), Date defaults to today (computed from local
    year/month/day, not `Date.prototype.toISOString()`/
    `toLocaleDateString()`, to avoid UTC/timezone off-by-one, same
    reasoning as `specs/groomed/5-expense-list-view.md` scope item 17),
    and every person in `people` is checked in Split between — "defaults
    to everyone currently in the group" per
    `specs/features/expense-splitter-poc.md`.
17. **Edit mode, on open**: Description, Amount (formatted to exactly 2
    decimal places, e.g. `84.2` → `"84.20"`), Paid by, and Date are
    pre-filled from the `expense` prop; Split between is checked for
    exactly the people whose `id` is in `expense.participant_ids` — not
    "everyone," since an edited expense's original participant selection
    must be preserved, not re-defaulted.
18. Re-opening the form after a prior close/save resets all fields to the
    appropriate default for the new `mode`/`expense` — no stale state
    carried over from a previous open.

**Validation (both modes):**

19. The Save control is disabled whenever any of the following is true:
    Description is blank after trimming; Amount does not parse as a number
    greater than `0`; Paid by has no selection; Date has no valid
    `YYYY-MM-DD` value; zero people are checked in Split between. This
    mirrors `ExpenseWrite`'s constraints in
    `specs/groomed/1-define-openapi-contract.md` (all fields required,
    `amount` `exclusiveMinimum: 0`, `participant_ids` `minItems: 1`)
    client-side, before any request is sent.
20. There is no requirement that the selected payer also be a checked
    participant — both the contract and the mockups are silent on this, so
    it's left unconstrained (see "Edge cases considered").

**Submission:**

21. Add mode: submitting a valid form calls `POST /expenses` with an
    `ExpenseWrite` body: `description` (trimmed), `amount` (parsed
    number), `payer_id` (selected person's `id`), `date` (`YYYY-MM-DD`),
    `participant_ids` (the `id` of every checked person, in ascending `id`
    order). Edit mode: submitting calls
    `PUT /expenses/{expense.id}` with the same body shape, built from the
    current field values (not a diff).
22. While a submission is in flight, the Save control is disabled (prevents
    a duplicate double-submit) and no additional request is sent for a
    second click.
23. On a successful response (`201` for add, `200` for edit), the component
    emits `saved` — it does not itself clear or reset the parent's list;
    `ExpensesView.vue` (item 27 below) is responsible for refreshing after
    this event.
24. On a failed response (mocked `422`/`400`/`404`, or a thrown network
    error), the form stays open, the entered values are preserved (nothing
    is cleared), the Save control is re-enabled, and a muted/rose inline
    error message is shown (exact copy left to the implementer — see "Open
    questions", since `_docs/design-system.md` explicitly lists expense-form
    error states as undesigned).

**Wiring into `ExpensesView.vue`:**

25. `ExpensesView.vue` renders one `<ExpenseForm>` instance (always
    mounted, `open` toggled), passing its own already-fetched `people`
    array as the `people` prop.
26. Clicking the header/top-bar "Add expense" control (desktop text button
    or mobile icon button, both already rendered inertly by
    `specs/groomed/5-expense-list-view.md`) sets the form to
    `mode="add"`, `expense=null`, `open=true` — this replaces that issue's
    "no effect" behavior for this control.
27. Clicking a row's edit (pencil) icon button sets the form to
    `mode="edit"`, `expense=<that row's full Expense object from the
    already-fetched list>`, `open=true` — this replaces that issue's "no
    effect" behavior for this control.
28. Handling the form's `close` event sets `open=false` with no further
    action.
29. Handling the form's `saved` event: sets `open=false`, then re-fetches
    `GET /expenses` and re-renders the list from that response (in the
    order returned, no client-side re-sort, same as
    `specs/groomed/5-expense-list-view.md` scope item 15) — the newly
    added/edited expense is not spliced into the list optimistically; the
    refetch is the single source of truth for the post-save list content
    and order.

**Mocking:**

30. `frontend/src/mocks/handlers.ts` gains handlers for `POST /expenses`
    and `PUT /expenses/{expense_id}`, operating on the same module-level
    in-memory expenses array `specs/groomed/5-expense-list-view.md`
    introduced for `GET /expenses`/`DELETE /expenses/{expense_id}` — not a
    second, conflicting array.
31. Mock `POST /expenses`: validates `amount > 0` and non-empty
    `participant_ids` (→ `422` with an `HTTPValidationError`-shaped body
    if violated) and that `payer_id` and every `participant_ids` entry
    resolve against the shared `GET /people` mock data (→ `400` with an
    `Error`-shaped body if not); otherwise assigns a new `id` (one greater
    than the current max in the array, or `1` if empty), appends the
    record, and returns `201` with the full `Expense`.
32. Mock `PUT /expenses/{expense_id}`: same validation as item 31; if
    `expense_id` doesn't match an existing record, returns `404` with an
    `Error`-shaped body; otherwise replaces that record in place (keeping
    its `id`) and returns `200` with the updated `Expense`.
33. A subsequent `GET /expenses` reflects any successful mock `POST`/`PUT`,
    so the mocked screen behaves consistently across interactions within
    one dev/test session, matching the pattern
    `specs/groomed/4-people-management-ui.md` and
    `specs/groomed/5-expense-list-view.md` established for their own mock
    handlers.

## Out of scope

- Unequal/percentage/exact-amount splitting — v1 is equal-split only, per
  `specs/features/expense-splitter-poc.md`; the form has no UI for
  per-person amounts.
- Adding or editing a person from within this form — the payer/participant
  picker only lists people already in the group (issue #4's scope); there
  is no "add a new person" affordance inside `ExpenseForm.vue`.
- Deleting an expense — already covered by
  `specs/groomed/5-expense-list-view.md`'s delete icon button; this issue
  doesn't touch that control.
- A confirmation-before-discard prompt when closing a form with unsaved
  edits — none is designed; closing always discards silently, per item 3.
- A fully designed empty state for zero people beyond the minimal message
  in item 15 — same interim-default pattern as
  `specs/groomed/4-people-management-ui.md`/
  `specs/groomed/5-expense-list-view.md`; a fuller design is a follow-up if
  wanted.
- A fully designed error/validation visual treatment — undesigned per
  `_docs/design-system.md`'s "What's not covered yet"; item 24 leaves the
  exact copy/styling to the implementer.
- A bespoke calendar-grid date picker or dropdown-menu component library —
  left implementer-flexible per item 13 and "Open questions"; no new
  frontend dependency is introduced for this (see "Constraints").
- Implementing the `POST /expenses`/`PUT /expenses/{expense_id}` backend
  routes — issue #12.
- Writing `openapi/openapi.yaml` itself — issue #1.
- Scaffolding the frontend project, router, app shell, or MSW wiring —
  issue #3.
- The People screen and its own add-person form — issue #4.
- The Expenses list's read/delete behavior, row layout, and header —
  issue #5; this issue only adds the two wiring points (items 26–27) that
  issue #5 deliberately left inert.
- The Balances view — issue #7.
- A shared/global store (e.g. Pinia) for people or expenses across
  screens — `_docs/architecture.md` doesn't mention one; `ExpensesView.vue`
  continues to own its own `GET /people`/`GET /expenses` fetches, passing
  the people list down as a prop to `ExpenseForm.vue` (item 2) rather than
  introducing a store.

## Acceptance criteria

1. **Prerequisite check**: if `frontend/src/api/client.ts`,
   `frontend/src/api/schema.d.ts`, a `GET /people` MSW handler, or
   `ExpensesView.vue`'s real (non-placeholder) content from
   `specs/groomed/5-expense-list-view.md` do not all exist at
   implementation time, none of criteria 2–24 below are attempted — a
   comment is left on this issue noting which prerequisite is missing,
   instead of scaffolding a stand-in.
2. Given the prerequisite is met, `frontend/src/components/ExpenseForm.vue`
   exists, accepting `open`/`mode`/`expense`/`people` props and emitting
   `close`/`saved` events as described in Scope items 2–4.
3. Desktop/tablet (`md:` and up): opening the form renders a centered modal
   with a backdrop, a header containing the correct title ("Add expense" /
   "Edit expense") and a close icon, the Description/Amount/Paid
   by/Date/Split-between fields, and a footer with "Cancel" and "Save
   expense" buttons.
4. Mobile (below `md:`): opening the form renders a full-screen sheet (no
   backdrop) with a three-part header bar ("Cancel" left, title centered,
   "Save" right) and the same fields, with Paid by and Date stacked
   full-width rather than side by side — checkable, per the same pattern as
   `specs/groomed/5-expense-list-view.md`'s criterion 7, by inspecting
   responsive Tailwind classes in the rendered markup, not by simulating an
   actual narrow viewport in Vitest/JSDOM.
5. Opening the form in add mode renders: empty Description, empty Amount,
   an unselected Paid-by placeholder, Date defaulted to today in
   `YYYY-MM-DD` under the hood, and every person in the `people` prop
   checked in Split between.
6. Opening the form in edit mode with a given `expense` prop renders:
   Description/Amount/Paid-by/Date pre-filled from that expense (Amount
   formatted to 2 decimal places), and Split between checked for exactly
   the people whose `id` appears in `expense.participant_ids` (not
   necessarily everyone).
7. The Save control is disabled when: Description is blank/whitespace-only,
   Amount is non-numeric or `<= 0`, no payer is selected, Date has no
   valid value, or zero participants are checked — verified by a test that
   asserts the disabled state for each violation independently while the
   other fields hold valid values.
8. Submitting a valid add-mode form calls `POST /expenses` with a body
   whose `participant_ids` array lists exactly the checked people's `id`s
   in ascending order, and whose other fields match the entered
   values (trimmed description, parsed amount, selected payer id, selected
   date).
9. Submitting a valid edit-mode form calls
   `PUT /expenses/{expense.id}` with the same body-construction rule as
   criterion 8, built from the current (possibly changed) field values.
10. Once the mocked `201`/`200` response resolves, the component emits
    `saved`; before that response resolves, `saved` has not yet been
    emitted (proving the non-optimistic ordering).
11. If the mocked `POST`/`PUT` call fails (e.g. a `422`), the component
    does not emit `saved`, the entered field values remain in the form,
    and the Save control returns to its enabled state (assuming the
    validation in criterion 7 would otherwise allow re-submission).
12. Clicking the close (X) icon, the "Cancel" button, the mobile header's
    "Cancel" text, a backdrop click (desktop/tablet only), or pressing
    Escape emits `close` and triggers zero network requests.
13. In `ExpensesView.vue`: clicking the "Add expense" control (desktop
    button or mobile icon button) opens `ExpenseForm` with
    `mode="add"`/`expense=null`; clicking a row's edit (pencil) icon opens
    it with `mode="edit"`/`expense=<that row's data>` — both previously
    inert per `specs/groomed/5-expense-list-view.md`'s criterion 11, which
    this issue supersedes for these two controls specifically.
14. In `ExpensesView.vue`: handling the form's `saved` event closes the
    form and triggers a new `GET /expenses` call; the rendered list
    reflects the response from that new call (including a newly
    added/edited expense in its correct sorted position), not a
    client-side splice/patch of the previous list.
15. `frontend/src/mocks/handlers.ts` exports handlers for `POST /expenses`
    and `PUT /expenses/{expense_id}` operating on the same in-memory array
    `specs/groomed/5-expense-list-view.md` introduced, typed against
    `frontend/src/api/schema.d.ts`'s generated types.
16. Adding an expense via the form, then triggering a `GET /expenses`
    (e.g. by the automatic refetch in criterion 14, or by remounting
    `ExpensesView.vue` in a test), returns and renders a list that
    includes the newly added expense — proving the mock `POST` handler
    mutates the same state `GET /expenses` reads from. The equivalent is
    true for editing an expense via `PUT`.
17. Mock `POST`/`PUT /expenses`: an `amount <= 0` or empty
    `participant_ids` in the request body returns `422`; a `payer_id` or
    `participant_ids` entry not present in the mock `GET /people` data
    returns `400`; a `PUT` to a nonexistent `expense_id` returns `404` —
    each matching the response shape in
    `specs/groomed/1-define-openapi-contract.md`.
18. If `people` is empty when the form opens, the Paid by/Date/Split
    between controls are replaced by the muted message from Scope item 15
    and the Save control is disabled.
19. A Vitest test co-located with `ExpenseForm.vue` exercises: add-mode
    defaulting (criterion 5), edit-mode defaulting (criterion 6), Save
    disabled/enabled transitions (criterion 7), a successful add submit
    (criteria 8, 10), a successful edit submit (criterion 9), a failed
    submit leaving the form open with values intact (criterion 11), and
    each close trigger emitting `close` with no request (criterion 12).
20. A Vitest test co-located with (or a cross-component test in
    `frontend/tests/` alongside) `ExpensesView.vue` exercises the wiring
    from criteria 13–14: clicking "Add expense" and a row's edit icon open
    the form in the correct mode, and a successful save closes the form
    and refreshes the rendered list from a new `GET /expenses` call.
21. `cd frontend && npm test` passes, including the tests from criteria 19
    and 20, and `cd frontend && npm run build` still exits 0 with
    `ExpenseForm.vue` and the updated `ExpensesView.vue` in place.

## Edge cases considered

- **Payer not among checked participants**: allowed — neither
  `specs/groomed/1-define-openapi-contract.md` nor the mockups require the
  payer to be a participant, so no client-side check blocks this
  combination (Scope item 20).
- **Zero people in the group**: the form degrades to the message-and-
  disabled-Save state in Scope item 15/Acceptance criterion 18, rather than
  rendering empty Paid-by/Split-between controls that can't be usefully
  interacted with.
- **Editing an expense whose participants no longer include the payer**
  (e.g. participants were narrowed on a prior edit): not a special case —
  same as the general "payer need not be a participant" rule above.
- **Whitespace-only or overlong description**: blank/whitespace-only blocks
  Save (criterion 7); the `maxlength="200"` attribute prevents typing past
  the contract's limit in the first place, so no separate "too long" error
  state is needed.
- **Non-numeric or negative amount input**: blocks Save (criterion 7); no
  specific inline error copy is mandated beyond the general treatment in
  Scope item 24.
- **Re-opening the form for a different expense while it's already open in
  edit mode** (e.g. clicking a different row's edit icon before closing):
  Scope item 18 requires fields to fully reset to the new `expense`'s
  values — no leftover state from the previously open expense.
- **Double-clicking Save**: prevented by disabling the control while a
  submission is in flight (Scope item 22), not by debouncing or
  deduplicating requests.
- **Mock `PUT` to an `expense_id` that was already deleted via
  `specs/groomed/5-expense-list-view.md`'s delete button in the same
  session**: returns `404` (Scope item 32) like any other nonexistent id —
  not specially distinguished from "never existed."
- **Server-side validation failing after client-side validation passed**
  (e.g. a `payer_id` that becomes invalid due to a state mismatch between
  the two mocked datasets): handled the same as any other failed
  submission (criterion 11) — the form stays open with an inline error.

## Constraints

- Vue components use `<script setup lang="ts">`, per
  `_docs/architecture.md`.
- No new dependency is added to `frontend/package.json` for this issue —
  no date-picker library, dropdown/menu library, or form-validation
  library; everything needed is already declared per issue #3's
  acceptance criterion 1, and the custom select/date/checkbox controls
  (Scope items 13–14) are built with plain Vue + Tailwind. Ask first if
  something's missing, per `AGENTS.md`.
- Styling is Tailwind utility classes only, matching the
  `_docs/design-system.md` tokens named in Scope — no CSS-in-JS and no
  hand-written arbitrary values beyond the roundings that doc already
  calls acceptable.
- All API calls go through the client exported from
  `frontend/src/api/client.ts` (`openapi-fetch`) — no raw `fetch`/`XHR`
  calls, and no hand-declared TypeScript interface standing in for the
  generated schema types.
- MSW is the only mocking mechanism used for this component in dev and
  tests — no separate hand-rolled fixture module bypassing it.
- Date formatting/parsing (Scope items 13, 16) is implemented with plain
  JS/TS string manipulation or a small local helper, not a new date
  library dependency, consistent with
  `specs/groomed/5-expense-list-view.md`'s equivalent constraint.
- `ExpenseForm.vue` does not perform its own `GET /people` fetch — it
  receives the list as a prop from `ExpensesView.vue` (Scope item 2), to
  avoid a redundant request within an already-mounted view.

## Open questions

- **Hard sequencing dependency on issues #1, #3, #4, and #5**: as of this
  grooming, none of `openapi/openapi.yaml`, `frontend/`, or a real
  `ExpensesView.vue` exist in this repo. The GitHub issue declares
  dependencies on #1–#4 only; this spec adds an undeclared cross-dependency
  on #5 as well, because this issue edits `ExpensesView.vue`'s "Add
  expense"/edit-icon wiring, which only exists once #5 lands (the same
  kind of gap `specs/groomed/5-expense-list-view.md` itself flagged for its
  own undeclared dependency on #4). Acceptance criterion 1 makes the full
  gate explicit. Flag if a human would rather formally add #5 as a
  declared dependency on the GitHub issue instead of leaving this
  implementation-level note.
- **Custom select/date control interaction mechanism**: `_docs/design-system.md`
  requires a fully custom-styled box for Paid by and Date, explicitly
  ruling out a native `<select>`/`<input type=date>`. This spec (Scope item
  13) leaves the exact interaction — a custom dropdown listbox for Paid by,
  and either a hand-built calendar or a hybrid approach (e.g. a visually
  hidden native date input triggered from a custom-styled box) for Date —
  to the implementer, since the mockups are static images with no
  interactive prototype to copy, and hand-building a full calendar-grid
  widget is a materially larger scope than anything else in this issue.
  Flag if a specific mechanism is mandated.
- **Default payer selection in add mode**: `expense-form.html`'s mockup
  shows "Alice Chen" pre-filled, but neither
  `specs/features/expense-splitter-poc.md` nor the contract specifies a
  default payer (only participants have a stated default — "everyone").
  This spec assumes no default (an empty "Select a person" placeholder,
  Scope item 16) since there's no "current user" concept in this
  single-user tool to default to. Flag if the first person in the list (or
  some other rule) should be pre-selected instead.
- **Edit-mode copy**: the mockups only show the add-expense variant. This
  spec assumes "Edit expense" as the modal/sheet title and reuses "Save
  expense"/"Save" as the button label unchanged in edit mode (Scope items
  6, 9). Flag if different copy (e.g. "Save changes") is wanted for edit.
- **Backdrop-click and Escape-key close behavior**: not demonstrated by the
  static mockups (which show no interactivity). This spec assumes both
  are standard modal-dismissal triggers, in addition to the X icon and
  Cancel button (Scope item 3, Acceptance criterion 12). Flag if either
  should be disabled (e.g. to prevent accidental data loss on a filled-out
  form).
- **Error/validation-state visual design**: undesigned per
  `_docs/design-system.md`'s "What's not covered yet" for this exact
  screen. This spec leaves the inline error copy/styling to the
  implementer (Scope item 24) as long as the form doesn't silently clear
  or close on failure. Flag if a specific treatment is required.
- **Refetch-after-save vs. optimistic/local list update**: this spec
  assumes `ExpensesView.vue` re-fetches `GET /expenses` after a successful
  save (Scope item 29) rather than re-implementing the contract's sort
  order client-side to splice the new/edited expense in locally. Simpler
  and less error-prone, but does mean one extra network round-trip per
  save. Flag if a local-splice approach is preferred instead.
