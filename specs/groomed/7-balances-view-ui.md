---
issue: 7
label: groomed
---

# Balances view UI

## Summary

Build the real Balances screen — `frontend/src/views/BalancesView.vue`,
replacing the placeholder `<h1>` scaffolded by issue #3 — showing each
person's net position (who's owed, who owes, how much), wired against
`GET /balances` (mocked via MSW during this phase, per
`specs/features/expense-splitter-poc.md`'s build order) through the
generated OpenAPI client. Layout and styling follow
`_docs/design-system.md`'s "Balance row" spec and the two Balances mockups
(`balances.html` desktop/tablet, `balances-mobile.html` mobile) in
`_docs/design/mockups/standalone/`. This is a read-only, purely
computed-data view — no add/edit/delete control, no settle-up action, and
no suggested payment plan exist anywhere on this screen, per
`specs/features/expense-splitter-poc.md`'s v1 scope ("view balances" is
net positions only).

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
   pattern `specs/groomed/3-scaffold-frontend-project.md`,
   `specs/groomed/4-people-management-ui.md`, and
   `specs/groomed/5-expense-list-view.md` used for their own dependency on
   #1/#3.
2. Unlike issues #5 and #6, this view has no cross-dependency on issue #4's
   `GET /people` handler or #5/#6's expense data: the `Balance` schema
   (`specs/groomed/1-define-openapi-contract.md`) already carries
   `person_id`, `name`, and `balance` directly, so no other entity needs to
   be fetched or looked up to render this screen. This issue is
   self-contained against `GET /balances` alone.

**BalancesView.vue content — desktop/tablet** (`md:` and up, per
`balances.html` — tablet reuses this layout unchanged except tighter
content padding, per design-system.md's Responsive behavior table's
documented rationale that only Expenses got a dedicated tablet mockup):

3. Page header: `h1` "Balances" + muted subtitle "Net position for
   everyone in the group." (design-system.md's "Page header" component).
   No action button — there is nothing to add on this screen.
4. List/card container: white / `border-slate-200` / `rounded-xl`
   (design-system.md's "List/card container"), content padded `py-12
   px-14` on desktop / `py-9 px-8` on tablet (no max-width cap on tablet),
   max width capped at the "single list" token (`max-w-xl`-ish, ~720px,
   per design-system.md's Spacing table) on desktop.
5. One row per balance (design-system.md's "Balance row"): a 36px
   `bg-indigo-50`/`text-indigo-700` avatar circle showing the uppercased
   first character of the person's name; name (15px/500) and a status word
   ("is owed" / "owes", 12px/400, muted `slate-500`) stacked in a column,
   on the left; a signed amount (16px/600, `emerald-600` or `rose-600`
   matching the sign) on the right; a 5px pill-shaped bar underneath the
   row's content, `slate-100` track, filled proportionally per item 9
   below. Rows divided by `border-slate-100`, last row has no divider,
   `py-4 px-5`-ish row padding (design-system.md's "List/card container").

**BalancesView.vue content — mobile** (below `md:`, per
`balances-mobile.html`):

6. Slim top bar: `h1` "Balances" only — no subtitle (matches
   `balances-mobile.html`, same pattern as issues #4/#5's mobile headers)
   and no action button (nothing to add on this screen, at any breakpoint).
7. Same row structure as desktop, except: avatar shrinks to 32px, and **no
   status word is rendered** — `balances-mobile.html` shows only the
   name directly across from the amount, dropping the "is owed"/"owes"
   line entirely to save vertical space. This is a real content
   difference, not a cosmetic sizing delta; see "Open questions" for why
   this diverges from design-system.md's generic (desktop-derived)
   "Balance row" description. Font-size deltas between desktop and mobile
   (e.g. 15px vs. 14px name, 16px vs. 15px amount) are the kind of
   cosmetic rounding design-system.md's general fidelity note already
   allows — round to the nearest stock Tailwind size rather than chasing
   the exact pixel value.
8. The bottom tab bar built by issue #3 remains visible and unchanged on
   this screen.

**Behavior** (all breakpoints):

9. On mount, `BalancesView.vue` calls `GET /balances` through the client
   from `frontend/src/api/client.ts` and renders one row per entry, in
   the exact order returned (per `specs/groomed/1-define-openapi-contract.md`:
   `person_id` ascending) — no client-side re-sorting. For each row:
   - `balance > 0`: status word "is owed", amount rendered as `+$` followed
     by `Math.abs(balance)` formatted to exactly 2 decimal places (e.g.
     `58.4` → `+$58.40`), text/bar color `emerald`.
   - `balance < 0`: status word "owes", amount rendered as `−$` (a real
     minus sign, U+2212, not a hyphen — matching the mockups' `&minus;`
     entity) followed by `Math.abs(balance)` formatted to 2 decimal places
     (e.g. `-22.1` → `−$22.10`), text/bar color `rose`.
   - `balance === 0`: see item 10 for the interim treatment (undesigned by
     the mockups).
   The bar's fill width is `round(abs(balance) / maxAbsBalance * 100)`,
   where `maxAbsBalance` is the largest `abs(balance)` across every entry
   currently rendered on screen (matching the mockups: the largest-
   magnitude row renders a 100%-width bar, e.g. Alice's `+$58.40` in
   `balances.html`, and every other row is proportional to it). If every
   rendered balance is `0` (an empty group, or a fully-settled one),
   `maxAbsBalance` is `0`; every bar renders at `0` width in that case
   rather than dividing by zero.
10. **Zero-balance row** (`balance === 0`, e.g. a person with no expenses
    yet, or a settled group): not shown in either mockup (both sample
    datasets are all-nonzero). This spec's interim treatment: status word
    "settled up", amount rendered as `$0.00` (no `+`/`−` sign), text
    rendered in muted `slate-500` (neither emerald nor rose), and a 0%-
    width bar (consistent with item 9's zero-fill rule). Flagged as an
    assumption in "Open questions" since neither the mockups nor
    design-system.md depict this state.
11. No control anywhere on this screen adds, edits, deletes, or "settles"
    anything — matches `specs/features/expense-splitter-poc.md`'s v1 scope
    ("view balances" is net positions only, no settle-up, no suggested
    payment plan); the screen is pure display.

**Mocking:**

12. `frontend/src/mocks/handlers.ts` gains a handler for `GET /balances`,
    written against the `paths`/`components["schemas"]` types generated
    into `frontend/src/api/schema.d.ts` — never a hand-declared interface.
13. The mock `GET /balances` handler is backed by its own module-level
    in-memory array, seeded with the four sample balances shown in
    `balances.html`: `{ person_id: 1, name: "Alice Chen", balance: 58.4 }`,
    `{ person_id: 2, name: "Bob Diaz", balance: -22.1 }`,
    `{ person_id: 3, name: "Priya Nair", balance: 14.75 }`,
    `{ person_id: 4, name: "Sam Okafor", balance: -51.05 }`. This array is
    independent of any people/expenses in-memory state issues #4/#5/#6
    introduce — since this screen has no mutating action (item 11), there
    is nothing that needs to keep it in sync with those, unlike the shared
    mutable state those issues' handlers require.

## Out of scope

- Settle-up / "mark as paid" actions — excluded from v1 entirely per
  `specs/features/expense-splitter-poc.md`; no UI, contract endpoint, or
  handler exists for this.
- A suggested minimal settlement plan (who-pays-whom) — excluded from v1
  per the same feature scope; this screen shows only net positions, never
  a payment graph.
- Any edit/delete control on this screen — it is read-only by design (per
  the GitHub issue's own framing: "no form or delete interaction").
- A separate tablet-specific mockup/layout — `_docs/design-system.md`
  notes only Expenses got a dedicated tablet mockup; Balances (like
  People) reuses the desktop sidebar layout unchanged at tablet width,
  just with tighter content padding; no new decision is needed here.
- Reusing or depending on issue #4's `GET /people` handler, or #5/#6's
  expense/people in-memory state — not needed, since `Balance` already
  carries `person_id`/`name`/`balance` directly (Scope item 2).
- A fully designed empty state (zero people) — `_docs/design-system.md`
  explicitly lists this as undesigned; see "Open questions" for the
  interim default this spec assumes.
- A fully designed zero-balance ("settled up") row treatment — neither the
  mockups nor design-system.md depict this state; see Scope item 10 and
  "Open questions" for the interim default this spec assumes.
- Loading spinners/skeletons for the initial `GET /balances` fetch —
  `_docs/design-system.md` lists loading states under "What's not covered
  yet"; the screen simply renders an empty list until data arrives.
- Implementing the `GET /balances` backend route, or its remainder-
  distribution/rounding algorithm for unevenly-split expenses — issue #13;
  this issue only consumes the contract's fixed response shape (a number,
  rounded to 2 decimal places) against a static MSW mock.
- Writing `openapi/openapi.yaml` itself — issue #1.
- Scaffolding the frontend project, router, app shell, or MSW wiring —
  issue #3; this issue only fills in `BalancesView.vue`'s content inside
  that existing shell.
- The People screen and Expenses screen/form — issues #4, #5, #6.
- A shared/global store (e.g. Pinia) for balances across screens —
  `_docs/architecture.md` doesn't mention a state-management library for
  this project; this screen fetches `GET /balances` independently on its
  own mount, same pattern as #4/#5's screens.

## Acceptance criteria

1. **Prerequisite check**: if `frontend/src/api/client.ts` and
   `frontend/src/api/schema.d.ts` do not both exist at implementation
   time, none of criteria 2–14 below are attempted — no `BalancesView.vue`
   content, MSW handler, or fabricated client/types are added as a
   stand-in; a comment is left on this issue noting it's blocked on
   #1/#3 instead.
2. Given the prerequisite is met, `frontend/src/views/BalancesView.vue` no
   longer renders only the placeholder `<h1>` from issue #3; it renders
   the header and balance list described in Scope items 3–8.
3. On mount, `BalancesView.vue` calls `GET /balances` through the client
   from `frontend/src/api/client.ts`. Every entry in the resolved response
   is rendered as a row, in the exact order returned (no client-side
   re-sort), showing: an avatar with the uppercased first character of
   the person's name, the person's name, and a signed amount formatted to
   exactly 2 decimal places.
4. A row with `balance > 0` renders the status word "is owed" and the
   amount prefixed with `+`, in `emerald` text; a row with `balance < 0`
   renders "owes" and the amount prefixed with a real minus sign (`−`,
   U+2212), in `rose` text.
5. Desktop/tablet (`md:` and up): each row renders the status word text
   described in criterion 4, in addition to the name and amount. Mobile
   (below `md:`): the status word is not rendered anywhere in the markup
   for any row — checkable by inspecting the rendered markup for the
   absence of "is owed"/"owes"/"settled up" text at this breakpoint,
   following the same "inspect responsive classes/markup, don't simulate
   a real viewport" pattern as `specs/groomed/3-scaffold-frontend-project.md`'s
   criterion 5 and `specs/groomed/4-people-management-ui.md`'s criterion 6.
6. Each row's bar element's width is `round(abs(balance) / maxAbsBalance *
   100)` percent, where `maxAbsBalance` is the largest `abs(balance)`
   among all currently-rendered rows; the row(s) with the largest
   magnitude render a 100%-width bar. Verified with a fixture matching
   `balances.html`'s four sample values (58.40, -22.10, 14.75, -51.05),
   asserting bar widths of 100%, 38%, 25%, and 87% respectively (rounded).
7. If every rendered balance is `0` (e.g. an empty `GET /balances`
   response, or a fixture where every entry is `0`), every row's bar
   renders at `0%` width — verified by a test using such a fixture, proving
   no division-by-zero exception is thrown and no bar renders at `100%` by
   default.
8. A row with `balance === 0` renders the status word "settled up" (on
   desktop/tablet; omitted on mobile per criterion 5), the amount as
   `$0.00` with no `+`/`−` prefix, and in muted `slate-500` text rather
   than `emerald`/`rose`.
9. Desktop/tablet (`md:` and up): the header renders both the `h1`
   "Balances" and the subtitle "Net position for everyone in the group.",
   and no button or other action control. Mobile (below `md:`): no
   subtitle is rendered, and no action control is rendered either —
   checkable by inspecting which responsive Tailwind classes gate each
   variant in the rendered markup, and by asserting no `<button>` exists
   in the header/top-bar region at either breakpoint.
10. Inspecting the rendered markup of the balance list finds no edit,
    delete, settle-up, or other mutating/actionable control on any row or
    in the header — only display text, the avatar, and the bar.
11. `frontend/src/mocks/handlers.ts` exports a handler for `GET /balances`,
    typed against `frontend/src/api/schema.d.ts`'s generated types, backed
    by the seeded in-memory array from Scope item 13.
12. A Vitest test co-located with `BalancesView.vue` (or a subcomponent it
    uses) exercises, against the MSW-mocked handler from criterion 11: (a)
    initial list render from `GET /balances` in the order returned, with
    correct status word/sign/color per criterion 4; (b) the bar-width
    fixtures from criteria 6–7; (c) the zero-balance treatment from
    criterion 8; (d) the mobile-vs-desktop status-word presence from
    criterion 5.
13. `cd frontend && npm test` passes, including the tests from criterion
    12, and `cd frontend && npm run build` still exits 0 with
    `BalancesView.vue`'s real content in place.
14. `frontend/src/views/BalancesView.vue` makes no `GET /people` or
    `GET /expenses` request — verified by asserting, in the test from
    criterion 12, that only the `GET /balances` mock handler is invoked on
    mount.

## Edge cases considered

- **Empty group (zero people, `GET /balances` returns `[]`)**: renders the
  list card container with a single muted text row (e.g. "No balances yet
  — add a person and an expense to see balances.") rather than an empty
  white box with no content or affordance, matching the interim default
  issues #4/#5 used for their own zero-item states. Flagged as an
  assumption in "Open questions" since `_docs/design-system.md` explicitly
  lists this as an undesigned state.
- **A very small nonzero balance relative to the largest on screen**: its
  bar can round down to `0%` width (Scope item 9's `round()`), visually
  indistinguishable from the `balance === 0` "settled up" row (item 10).
  Not specially handled — accepted as a minor, unaddressed fidelity gap,
  consistent with `_docs/design-system.md`'s general "not pixel-perfect"
  stance, rather than inventing a minimum-visible-width floor the mockups
  don't show.
- **A single person in the group**: `maxAbsBalance` equals that person's
  own `abs(balance)` (or `0` if they're settled), so their bar renders at
  either `100%` or `0%` — no special-casing needed beyond the general
  formula in Scope item 9.
- **All balances the same sign** (e.g. everyone but one person is owed
  money — arithmetically unusual but not excluded by the contract): the
  formula in Scope item 9 still applies uniformly; no assumption is made
  that the largest-magnitude entry is always positive.
- **Long names**: no truncation rule is specified by the mockups for the
  balance row's name text, same gap `specs/groomed/4-people-management-ui.md`
  noted for the People screen's person rows — not addressed by this issue.
- **Floating-point display of `balance`**: values are rendered via
  `Math.abs(balance).toFixed(2)` (or equivalent), the same
  plain-string-formatting approach used for amounts in
  `specs/groomed/5-expense-list-view.md` — no currency-locale/thousands-
  separator formatting is required (not exercised by any mocked balance,
  all under 1000).

## Constraints

- Vue components use `<script setup lang="ts">`, per `_docs/architecture.md`.
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
- Amount/bar-width formatting (Scope items 9–10) is implemented with plain
  JS/TS arithmetic and string manipulation, not a new number/currency
  formatting library dependency, per the no-new-dependency constraint
  above and consistent with `specs/groomed/5-expense-list-view.md`'s
  equivalent constraint for amount formatting.

## Open questions

- **Hard sequencing dependency on issues #1 and #3**: resolved by events —
  both have since merged. This issue also has no cross-dependency on
  #4/#5/#6 (Scope item 2), so it's cleared to implement independently of
  their sequencing.
- **Mobile omission of the status word — design-system.md gap or intended
  divergence?**: not separately raised for human review — the concrete
  behavior was already decided (follow the mobile mockup literally); this
  is a documentation-fidelity note about design-system.md's prose, not a
  functional ambiguity. Worth a small doc fix later, non-blocking.
- **Zero-balance ("settled up") treatment**: not separately raised for
  human review — low-stakes, well-reasoned interim default. Stands as
  pm's assumed default: status word "settled up", unsigned `$0.00`, muted
  `slate-500`, `0%`-width bar.
- **Empty-state design**: confirmed. A human reviewed this question
  (previously open) and confirmed the stated default: a minimal muted-text
  row (see `_docs/design-system.md`'s new "Empty list row" component).
- **Static vs. computed mock data**: confirmed. A human reviewed this
  question (previously open) and confirmed the stated default: a static,
  independent in-memory array matching `balances.html`'s sample values,
  not derived from #4/#5/#6's shared people/expenses mock state.
