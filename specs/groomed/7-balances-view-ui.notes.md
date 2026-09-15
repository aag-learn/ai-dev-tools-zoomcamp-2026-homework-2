# Implementation notes — issue #7 (Balances view UI)

## Summary of what was built

- `frontend/src/views/BalancesView.vue` — real content, replacing the
  issue #3 placeholder `<h1>`. Fetches `GET /balances` on mount via
  `frontend/src/api/client.ts`, renders the header (h1 + subtitle gated
  `hidden md:block`) and the balance list.
- `frontend/src/components/BalanceRow.vue` — new subcomponent, one row
  per balance. Props: `balance`, `barWidth`, `showStatus`, `size`
  (`'desktop' | 'mobile'`). Owns all the per-row formatting logic (avatar
  initial, status word, signed amount text/color, bar color).
- `frontend/src/mocks/handlers.ts` — added the `GET /balances` handler,
  typed against `schema.d.ts`, backed by a module-level array seeded with
  the four `balances.html` sample values, independent of any other
  issue's mock state.
- `frontend/src/views/BalancesView.test.ts` — co-located Vitest suite
  covering row order/formatting, bar-width fixtures (incl. the all-zero
  case), the zero-balance "settled up" treatment, mobile-vs-desktop
  status-word presence, the header's subtitle/no-button gating, the
  empty-state row, and that only `GET /balances` is called on mount.

## Two pre-existing test-infrastructure bugs fixed

Both of these blocked *any* future frontend test from exercising a real
`GET`/`POST` call through `client.ts` under MSW — not specific to this
issue's screen — so I fixed them in the shared files rather than working
around them locally. Flagging clearly since they touch files nominally
owned by issue #3's scaffold, which issue #7's spec lists as out of scope:

1. **`frontend/src/api/client.ts`**: `createClient({ baseUrl: '/' })`
   fails under Vitest/JSDOM with `TypeError: Invalid URL` — Node's native
   `fetch`/`Request` (unlike a real browser) requires an absolute URL and
   won't resolve `'/balances'` against a page location. Changed `baseUrl`
   to `window.location.origin` (falling back to `'/'` if `window` is
   undefined). This resolves to the exact same effective URL in a real
   browser (same-origin), so it's behavior-neutral for dev/prod — it only
   fixes testability under Node.
2. **`frontend/src/mocks/setup.ts`**: `server.listen()` was called inside
   `beforeAll()`. `openapi-fetch`'s `createClient()` captures
   `globalThis.fetch` once, into a closure, at module-evaluation time —
   which happens when `client.ts` is imported (transitively, by every
   view under test), and that import happens *before* `beforeAll` hooks
   run. So MSW's patched `fetch` landed too late: `client.ts` had already
   captured the original, unpatched `fetch`, and requests silently hit
   the real network (`ECONNREFUSED`) instead of being intercepted. Moved
   `server.listen()` to run synchronously at setup-file evaluation time
   (still inside `setup.ts`, just not deferred into `beforeAll`), which
   happens before any test file's own imports load. `afterEach`/`afterAll`
   remain as hooks since ordering doesn't matter for those.

I did not touch anything else in `client.ts`/`setup.ts` (routing,
handlers array wiring, etc.) — both changes are minimal and additive.

## Design decisions / assumptions

- **Two separate row containers (desktop vs. mobile), not one row with a
  CSS-hidden status word.** The spec's acceptance criterion 5 says the
  status word must be "not rendered anywhere in the markup" at the mobile
  breakpoint — a stronger claim than "hidden via CSS but still in the
  DOM". Since JSDOM doesn't apply real CSS, a single shared row with
  `hidden md:inline` on the status-word span would still have that text
  present in the render tree in tests. I followed the same pattern
  `AppShell.vue` already uses for the sidebar vs. tab bar (two full,
  separately-gated blocks, both always in the DOM, `hidden md:flex` /
  `md:hidden`) so that literal absence is genuinely checkable by scoping
  a query to the mobile container. The header (h1/subtitle) uses the
  single-shared-element-with-gating-class approach instead, per
  criterion 9's weaker wording ("checkable by inspecting which responsive
  classes gate each variant") — and because rendering the `<h1>` twice
  would break the existing `frontend/tests/navigation.test.ts`, which
  does `getByRole('heading', { level: 1, name: 'Balances' })` and expects
  exactly one match.
- **Font-size rounding** (design-system.md explicitly allows rounding to
  the nearest stock Tailwind size rather than one-off arbitrary values):
  name text is `text-sm` (14px) at both breakpoints — desktop's mockup
  value (15px) sits exactly between `text-sm`/`text-base`, mobile's
  mockup value already is 14px, so I used the same class for both rather
  than introduce a delta the mockup doesn't have a natural stock-size
  match for. Amount text is `text-base` (16px, exact match) on desktop
  and `text-sm` (14px, rounded from the mockup's 15px) on mobile.
  Avatar-initial text uses `text-sm` (14px, exact) on desktop and
  `text-xs` (12px, rounded from the mockup's 13px) on mobile.
- **Avatar size**: `h-9 w-9` (36px, exact) desktop, `h-8 w-8` (32px,
  exact) mobile — both land exactly on stock Tailwind sizes, no rounding
  needed.
- **List/card container max-width**: applied `lg:max-w-xl` on
  `BalancesView.vue`'s own content wrapper (not in `AppShell.vue`), so
  the desktop-only cap (no cap at tablet width) is scoped to this view,
  per Scope item 4. Outer page padding (`py-12`/`px-14` vs. tablet's
  `px-8`) is already supplied globally by `AppShell.vue`'s `<main>` — I
  did not duplicate or adjust that padding in `BalancesView.vue` itself,
  reading Scope item 4's padding language as restating the existing
  global page-padding token rather than asking for view-local padding on
  top of it.
- **Empty state**: one shared (non-breakpoint-split) row using the
  "Empty list row" pattern from design-system.md, text taken verbatim
  from the spec's Edge cases section: "No balances yet — add a person and
  an expense to see balances."
- **Zero-balance row**: implemented exactly as Scope item 10 describes —
  "settled up", `$0.00` (no sign), `text-slate-500`, 0%-width bar.
- **Minus sign**: used the literal U+2212 character (`−`) in the
  template/component source, not an HTML entity or escape sequence,
  matching the mockup's `&minus;` semantically.

## Out of scope / not built

Everything the spec's "Out of scope" section lists (settle-up, payment
plan, edit/delete, tablet-specific mockup, `GET /people`/`GET /expenses`
dependency, backend route, loading states, Pinia) — none of it was
touched, matching the spec.

## Test coverage mapping (acceptance criteria → test)

All in `frontend/src/views/BalancesView.test.ts` unless noted:

- AC2/3: "renders one row per balance, in the order returned..."
- AC4: same test (sign/color assertions) + "renders a balance of 0..."
- AC5: "renders the status word on desktop/tablet rows but never on
  mobile rows"
- AC6: "renders bar widths proportional to the largest magnitude on
  screen" (58.40/-22.10/14.75/-51.05 fixture → 100/38/25/87)
- AC7: "renders every bar at 0% width, with no division-by-zero error,
  when every balance is 0"
- AC8: "renders a balance of 0 as 'settled up', $0.00, in muted
  slate-500 text"
- AC9: "renders both the h1 and subtitle, gated so the subtitle is
  desktop/tablet only, and no button anywhere in the header"
- AC10: "renders no edit, delete, settle-up, or other actionable control
  anywhere on the screen"
- AC11: covered by `frontend/src/mocks/handlers.ts` itself (typed against
  generated schema types) plus every test in the suite exercising it
- AC12: all of the above, collectively
- AC13: `npm test` and `npm run build` both verified to pass/exit 0
  locally
- AC14: "only calls GET /balances on mount, never GET /people or GET
  /expenses"
- AC1 (prerequisite gate): satisfied by inspection — `client.ts` and
  `schema.d.ts` both already existed, so criteria 2-14 were implemented
  in full rather than the "blocked" fallback.

Edge case "empty group" (not a numbered acceptance criterion, but
described in the spec's "Edge cases considered" section) is covered by
"renders a muted empty-list row when GET /balances returns an empty
array".

## Things I did not do

- Did not add a separate `BalanceRow.test.ts`; its behavior is fully
  exercised through `BalancesView.test.ts` (the spec explicitly allows
  "A Vitest test co-located with BalancesView.vue (or a subcomponent it
  uses)").
- Did not add any lint tooling/config — none exists in the repo yet and
  none was requested.
