---
issue: 4
label: groomed
---

# People management UI

## Summary

Build the real People screen — `frontend/src/views/PeopleView.vue`, replacing
the placeholder `<h1>` scaffolded by issue #3 — with an add-person form and a
list of everyone currently in the group, wired against `POST /people` and
`GET /people` (mocked via MSW during this phase, per
`specs/features/expense-splitter-poc.md`'s build order) through the generated
OpenAPI client. Layout and styling follow `_docs/design-system.md`'s People
screen spec and the `people.html` (desktop/tablet) and `people-mobile.html`
(mobile) mockups in `_docs/design/mockups/standalone/`. This is the last v1
screen with no dependency on expense data; the list it renders is what the
expense form's payer/participant picker (issue #6) will read from later.

## Scope

**Prerequisite gate** (see "Open questions" — this governs everything else
below):

1. This issue can only be implemented once `frontend/src/api/client.ts` and
   `frontend/src/api/schema.d.ts` both exist, generated from a real
   `openapi/openapi.yaml` — i.e. issue #3's acceptance criteria 10–12 have
   landed, which themselves require issue #1 to be merged first. As of this
   grooming, neither `openapi/` nor `frontend/` exist in the repo yet. If the
   prerequisite isn't met at implementation time, do not scaffold a project,
   fabricate a client, or hand-declare stand-in types — flag this issue as
   blocked on #1/#3 (e.g. a comment) and stop, following the same pattern
   `specs/groomed/3-scaffold-frontend-project.md` used for its own dependency
   on #1.

**PeopleView.vue content — desktop/tablet** (`md:` and up, per `people.html`):

2. Page header: `h1` "People" + muted subtitle "Everyone splitting expenses
   in this group." (design-system.md's "Page header" component).
3. Add-person control: a `<form>` (so Enter submits) containing a text
   `<input>` — placeholder "Add a person's name", `maxlength="100"` matching
   `PersonCreate`'s `maxLength: 100` constraint fixed in
   `specs/groomed/1-define-openapi-contract.md` — and a primary button
   labeled "Add" with a leading 16px plus icon (design-system.md's "Icons"
   and "Primary button" sections).
4. Person list: white / `border-slate-200` / `rounded-xl` card container
   (design-system.md's "List/card container"); one row per person — a 36px
   `bg-indigo-50`/`text-indigo-700` avatar circle showing the uppercased
   first character of the person's name, plus the full name at 15px/500
   (design-system.md's "Person row"); rows divided by `border-slate-100`,
   last row has no divider.

**PeopleView.vue content — mobile** (below `md:`, per `people-mobile.html`):

5. Slim top bar: `h1` "People" on the left, a 40px `bg-indigo-600` icon-only
   add button on the right (plus icon only, no "Add" text — this is a real
   layout change per design-system.md's Responsive behavior table, not just
   a narrower desktop button). Since it carries no visible text, it needs
   `aria-label="Add person"` for an accessible name.
6. No subtitle is rendered on mobile (matches `people-mobile.html`, which
   omits it to save vertical space).
7. Add-person input renders full-width below the top bar, same placeholder
   and `maxlength` as desktop; there is no separate visible submit button
   beside it — the top-bar icon button and the Enter key are the two ways to
   submit.
8. Same list/row styling as desktop, with the tighter row padding shown in
   `people-mobile.html` (design-system.md already says pixel-perfect
   fidelity isn't required — round to the nearest stock Tailwind spacing
   utility).
9. The bottom tab bar built by issue #3 remains visible and unchanged on
   this screen.

**Behavior** (both breakpoints):

10. On mount, call `GET /people` through the client exported from
    `frontend/src/api/client.ts` and render every person returned, in the
    order the response returns them (no client-side re-sorting).
11. Submitting the form (Enter key, desktop "Add" button, or mobile icon
    button) with a name that is non-blank after trimming leading/trailing
    whitespace calls `POST /people` with `{ name: <trimmed value> }`. Once
    the `201` response resolves, the returned `Person` (with its
    server-assigned `id`) is appended to the rendered list and the input is
    cleared. The list is not updated optimistically — nothing is added
    before the `201` arrives.
12. Submitting with an empty or whitespace-only input is a no-op: no
    `POST /people` request is sent, and the submit control (desktop "Add"
    button / mobile icon button) is in its disabled state whenever the
    trimmed input value is empty.
13. No control anywhere on this screen edits or deletes an existing person —
    matches `specs/features/expense-splitter-poc.md`'s v1 exclusion; only
    add and list exist.

**Mocking:**

14. `frontend/src/mocks/handlers.ts` gains handlers for `POST /people` and
    `GET /people` (extending the empty array left by issue #3), written
    against the `paths`/`components["schemas"]` types generated into
    `frontend/src/api/schema.d.ts` — never a hand-declared interface.
15. The mock `GET /people` and mock `POST /people` handlers share in-memory
    state (e.g. a module-level array): adding a person and then triggering
    another `GET /people` (such as remounting the component) returns a list
    that includes the newly added person, so the mocked screen behaves
    consistently across interactions within one dev/test session.

## Out of scope

- Editing or deleting a person — excluded from v1 entirely per
  `specs/features/expense-splitter-poc.md`; no UI, contract endpoint, or
  handler exists for either.
- The expense form's participant/payer picker that will consume this
  person list — issue #6.
- A shared/global store (e.g. Pinia) for the people list across screens —
  `_docs/architecture.md` doesn't mention a state-management library for
  this project; each screen that needs the list (this one, and later #6)
  fetches it independently via `GET /people`. If cross-screen consistency
  needs later prove this insufficient, that's a separate follow-up to file
  then, not part of this issue.
- Loading spinners/skeletons for the initial `GET /people` fetch —
  `_docs/design-system.md` lists loading states under "What's not covered
  yet"; the screen simply renders an empty list until data arrives.
- A fully designed empty state (zero people) — `_docs/design-system.md`
  explicitly lists this as undesigned; see "Open questions" for the interim
  default this spec assumes.
- A fully designed error/validation state for a failed `POST /people` (e.g.
  network error, unexpected `422`) — `_docs/design-system.md` only calls out
  the expense form's error states as undesigned, but the same gap applies
  here; see "Open questions."
- Implementing the `POST /people`/`GET /people` backend routes — issues #9
  and #11.
- Writing `openapi/openapi.yaml` itself — issue #1.
- Scaffolding the frontend project, router, app shell, or MSW wiring —
  issue #3; this issue only fills in `PeopleView.vue`'s content inside that
  existing shell.
- A separate tablet-specific mockup/layout — `_docs/design-system.md` notes
  only Expenses got a dedicated tablet mockup since the other three screens
  (including People) reuse the desktop sidebar layout unchanged at tablet
  width, just with tighter content padding; no new decision is needed here.

## Acceptance criteria

1. **Prerequisite check**: if `frontend/src/api/client.ts` and
   `frontend/src/api/schema.d.ts` do not both exist at implementation time,
   none of criteria 2–15 below are attempted — no `PeopleView.vue` content,
   MSW handler, or fabricated client/types are added as a stand-in; a
   comment is left on this issue noting it's blocked on #1/#3 instead.
2. Given the prerequisite is met, `frontend/src/views/PeopleView.vue` no
   longer renders only the placeholder `<h1>` from issue #3; it renders the
   add-person form and person list described in Scope items 2–9.
3. On mount, `PeopleView.vue` calls `GET /people` through the client from
   `frontend/src/api/client.ts`, and every person in the resolved response
   is rendered as a row showing the person's name and an avatar with the
   uppercased first character of that name.
4. Submitting the form with a valid name containing leading/trailing
   whitespace (e.g. `"  Dana Lee  "`) calls `POST /people` with
   `{ name: "Dana Lee" }` (whitespace trimmed before sending); once the
   mocked `201` resolves, a new row for "Dana Lee" appears in the rendered
   list and the input is cleared to empty.
5. Submitting the form with an empty or whitespace-only input value results
   in zero `POST /people` calls, and the submit control (desktop "Add"
   button / mobile icon button) is in its disabled state whenever the
   trimmed input is empty.
6. Desktop/tablet (`md:` and up): the submit control renders the word "Add"
   next to the plus icon, and the page header renders both the `h1` "People"
   and the subtitle "Everyone splitting expenses in this group." Mobile
   (below `md:`): the submit control is icon-only (plus icon, no "Add" text)
   with `aria-label="Add person"`, positioned in a top bar next to the `h1`,
   and the desktop subtitle is not rendered — checkable, per the same
   pattern as `specs/groomed/3-scaffold-frontend-project.md`'s criterion 5,
   by inspecting which responsive Tailwind classes gate each variant in the
   rendered markup, not by simulating an actual narrow viewport in
   Vitest/JSDOM.
7. Inspecting the rendered markup of the person list finds no edit, delete,
   or other mutating control on any row — only the avatar and name text.
8. `frontend/src/mocks/handlers.ts` exports handlers for `POST /people` and
   `GET /people` (in addition to the previously-empty array from #3), typed
   against `frontend/src/api/schema.d.ts`'s generated types.
9. Adding a person via the form, then triggering a second `GET /people`
   (e.g. by remounting `PeopleView.vue` in a test), returns and renders a
   list that includes the newly added person — proving the mock handlers in
   criterion 8 share state.
10. A Vitest test co-located with `PeopleView.vue` (or a subcomponent it
    uses) exercises, against the MSW-mocked handlers from criterion 8: (a)
    initial list render from `GET /people`, (b) adding a person updates the
    rendered list, (c) submitting a blank/whitespace name sends no request.
11. `cd frontend && npm test` passes, including the tests from criterion 10,
    and `cd frontend && npm run build` still exits 0 with `PeopleView.vue`'s
    real content in place.
12. The add-person `<input>` has `maxlength="100"`, matching `PersonCreate`'s
    `maxLength: 100` constraint from
    `specs/groomed/1-define-openapi-contract.md`.
13. The rendered person list's row order matches the order `GET /people`
    returns (ascending `id` / insertion order, per the contract) — the
    frontend applies no client-side sort.

## Edge cases considered

- **Empty list (zero people)**: renders the list card container with a
  single muted text row (e.g. "No people yet — add one above.") rather than
  an empty white box with no content or affordance. Flagged as an assumption
  in "Open questions" since `_docs/design-system.md` explicitly lists this
  as an undesigned state.
- **Failed `POST /people`** (mocked non-2xx or a thrown error): the input is
  not cleared and no row is added (criterion 4 requires the `201` to resolve
  first), but the exact visual error indicator shown to the user is left
  unspecified — see "Open questions."
- **Duplicate names**: allowed, matching
  `specs/groomed/1-define-openapi-contract.md`'s own edge cases for
  `POST /people` — no client-side uniqueness check or warning.
- **Very long names (up to the 100-character limit)**: no truncation rule is
  specified by the mockups for the person-row name text (only the mobile
  expense row's meta line is called out as truncating in
  `_docs/design-system.md`) — a long name may wrap or make its row taller
  than its neighbors; not addressed by this issue, consistent with
  `_docs/design-system.md`'s "What's not covered yet."
- **Internal whitespace** (e.g. `"Dana  Lee"` with a double space): trimmed
  only at the two ends before sending to `POST /people`; internal spacing is
  sent as-is — no collapsing, since neither the contract nor the mockups
  call for it.
- **Avatar initial for an unusual name** (e.g. starting with a non-letter):
  not specially handled — simply the first character of the trimmed name,
  uppercased, whatever it is; the mockups only demonstrate plain Latin
  first-and-last names.

## Constraints

- Vue components use `<script setup lang="ts">`, per `_docs/architecture.md`.
- No new dependency is added to `frontend/package.json` for this issue —
  everything needed (Vue, MSW, the generated client) is already declared per
  issue #3's acceptance criterion 1; ask first if something's missing, per
  `AGENTS.md`.
- Styling is Tailwind utility classes only, matching the
  `_docs/design-system.md` tokens named in Scope — no CSS-in-JS and no
  hand-written arbitrary values beyond the roundings that doc already calls
  acceptable.
- All API calls go through the client exported from
  `frontend/src/api/client.ts` (`openapi-fetch`) — no raw `fetch`/`XHR`
  calls, and no hand-declared TypeScript interface standing in for the
  generated schema types.
- MSW is the only mocking mechanism used for this screen in dev and tests —
  no separate hand-rolled fixture module bypassing it.

## Open questions

- **Hard sequencing dependency on issues #1 and #3**: resolved by events —
  both #1 and #3 have since merged, so `frontend/src/api/client.ts` and
  `frontend/src/api/schema.d.ts` exist. The prerequisite gate in Scope
  item 1 / acceptance criterion 1 is satisfied; criteria 2–15 apply as
  written.
- **Empty-state design**: confirmed. A human reviewed this question
  (previously open) and confirmed the stated default: a minimal muted-text
  row (see `_docs/design-system.md`'s new "Empty list row" component,
  added while resolving this question across issues #4/#5/#6/#7).
- **Error/validation-state design for a failed add**: confirmed. A human
  reviewed this question (previously open) and chose a consistent house
  style over per-implementer discretion: `_docs/design-system.md`'s new
  "Inline error text" component (small `text-sm text-rose-600` near the
  form), applied identically across issues #4/#5/#6.
- **Disabled-button styling**: not separately raised for human review —
  low-stakes, cosmetic, no product impact. Stands as pm's assumed default:
  a standard reduced-opacity/`cursor-not-allowed` treatment via Tailwind's
  `disabled:` variant.
- **Shared people-list state across screens**: confirmed. A human reviewed
  this question (previously open) and chose to keep pm's assumed default
  for now — no shared store, each screen independently calls `GET
  /people` — but asked that a follow-up feature be filed via planner to
  revisit shared frontend state management later. That follow-up is
  tracked separately, not part of this issue's scope.
