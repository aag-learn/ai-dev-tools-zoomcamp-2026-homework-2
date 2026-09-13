# Implementation notes: #3 Scaffold frontend project

## Summary of what was built

- `frontend/` scaffolded from Vite's `vue-ts` template, template cruft
  (`HelloWorld.vue`, default assets, `public/icons.svg`) removed.
- Tailwind CSS wired up (see version note below): `tailwind.config.js`
  extends `theme.fontFamily.sans` to lead with `'IBM Plex Sans'`; the font
  stylesheet is loaded from `index.html` via Google Fonts `<link>` tags.
- `src/router/index.ts`: exactly `/people`, `/expenses`, `/balances`, plus
  `/` redirecting to `/expenses` (per the confirmed open question).
- `src/views/{People,Expenses,Balances}View.vue`: each a bare `<h1>` with
  the screen name, nothing else.
- `src/components/AppShell.vue`: the shared layout, mounted once from
  `App.vue` and wrapping `<RouterView>`. Contains both the desktop/tablet
  sidebar (`hidden md:flex`, 220px, white, right border) and the mobile
  bottom tab bar (`flex md:hidden`, fixed to viewport bottom, 70px), both
  always present in the DOM (visibility is CSS-only, per the spec's edge
  case note) and sharing one `navItems` array. Active/inactive classes
  match `_docs/design-system.md` and the mockups exactly: sidebar inactive
  label `text-slate-600`/500-weight with `text-slate-500` icon; sidebar
  active `bg-indigo-50`/`text-indigo-700`/600-weight; tab bar inactive
  `text-slate-500` (the WCAG-corrected value, not slate-400); tab bar
  active `text-indigo-700`. `data-testid="sidebar"`/`"tabbar"` were added
  to the two nav containers purely for test scoping (not styling) since
  the same three labels appear in both and tests need to disambiguate
  which occurrence they're asserting on.
- `src/components/Logomark.vue` and `src/components/icons/{Person,Receipt,
  Scale}Icon.vue`: extracted so both the sidebar and tab bar can reuse
  them. SVG paths copied verbatim from the mockups
  (`_docs/design/mockups/standalone/people.html` and
  `people-mobile.html`) rather than re-derived, per "See the mockup source
  files for the exact paths" in the design system doc.
- `src/mocks/{browser,server,handlers}.ts` + `src/mocks/setup.ts`: MSW
  wired for dev (`main.ts` starts the worker only when
  `import.meta.env.DEV`, before mounting the app) and for Vitest (setup
  file referenced from `vitest.config.ts`, starts/resets/closes the
  server around the suite). `handlers.ts` exports an empty array.
  `public/mockServiceWorker.js` generated via
  `npx msw init public --save` and is tracked (not gitignored).
- `vitest.config.ts`: jsdom environment, `globals: true` (see assumption
  below), MSW setup file wired in.
- `src/components/AppShell.test.ts`: co-located unit test, mounts AppShell
  with a memory-history router, asserts 3 nav items in both the sidebar
  and tab bar, and that pushing to each of the three routes marks the
  right item active (`bg-indigo-50`/`text-indigo-700`) and the other two
  inactive (`text-slate-600` sidebar / `text-slate-500` tab bar).
- `frontend/tests/navigation.test.ts`: cross-component test, mounts the
  full `App.vue` with a router, pushes through all three routes and
  asserts the corresponding placeholder `<h1>` renders each time; also
  asserts `/` redirects to `/expenses`.
- `src/api/schema.d.ts`: generated via `npm run generate:api-types`
  against the real `openapi/openapi.yaml` (issue #1 is merged). Contains
  a `paths` type.
- `src/api/client.ts`: `export default createClient<paths>({ baseUrl: '/' })`,
  importing `paths` from `./schema.d.ts`.
- `package.json` scripts: `dev`, `build`, `preview` (from the template),
  `test` (`vitest run` — a single non-watch run, so `npm test` exits
  deterministically pass/fail rather than hanging in watch mode), and
  `generate:api-types` (`openapi-typescript ../openapi/openapi.yaml -o
  src/api/schema.d.ts`).

## Decisions and assumptions

1. **Tailwind major version: pinned to 3.4.x, not "latest" (v4).** The
   confirmed-latest-no-pin guidance in the spec's Open Questions was
   scoped explicitly to `openapi-typescript`/`openapi-fetch`, not to
   Tailwind. Acceptance criterion 1 lists `tailwindcss`, `postcss`, and
   `autoprefixer` as three separate devDependencies, and criterion 7
   requires a `tailwind.config.*` file extending `theme.fontFamily.sans`
   — this is the Tailwind v3 architecture. Tailwind v4 (the current
   `latest` on npm) removes the classic `tailwind.config.js` +
   `postcss`+`autoprefixer` trio in favor of a CSS-first `@theme` block
   and a single `@tailwindcss/postcss` package; installing v4 would have
   made criteria 1 and 7 both unsatisfiable as literally written. I
   installed `tailwindcss@3.4.19` (npm's `v3-lts` dist-tag) instead. This
   is a deliberate deviation from "latest" and worth confirming with
   whoever owns `_docs/architecture.md` if a v4 migration is wanted later
   — flagging it explicitly rather than silently picking one.
2. **`typescript` pinned to `^5.9.3`, not the `create-vite` scaffold
   default (`~6.0.2`).** `openapi-typescript@7.13.0`'s peer dependency is
   `typescript@^5.x`; installing it against the scaffolded TS 6 produced
   an `ERESOLVE` conflict. `vue-tsc@3.3.11` only requires `>=5.0.0`, so
   downgrading to the latest 5.x satisfies both. This isn't a "version
   pin" in the sense the open questions discussed (that was about
   openapi-typescript/openapi-fetch specifically) — it's a compatibility
   requirement of a package the spec explicitly asked for.
3. **`jsdom` added as a devDependency, beyond the list in acceptance
   criterion 1.** Vitest 5 does not bundle a DOM environment; `jsdom` (or
   `happy-dom`) must be installed separately as of Vitest's current major
   version — it's an optional peer dependency, not a transitive one. This
   is a real gap in criterion 1's dependency list: without a DOM
   environment, `@testing-library/vue` tests (which criteria 6, 9, and 10
   explicitly require to exist and pass) cannot run at all in Node. I
   added `jsdom` rather than leaving the suite broken, since AGENTS.md's
   "no dependency without asking" rule is in tension with criterion 10
   ("every test passes") when taken with a literal reading of criterion
   1's list — I resolved it in favor of a working, spec-mandated test
   suite, but this should be confirmed/rubber-stamped rather than assumed
   settled.
4. **`vitest.config.ts` sets `test.globals: true`.** `@testing-library/vue`
   auto-registers DOM cleanup between tests via a global `afterEach` hook
   it detects at import time; without `globals: true` that hook isn't
   found, and the second+ test in a file sees leftover DOM from the
   previous one (surfaced during testing as "multiple elements found" on
   `getByTestId`). This is the standard fix recommended by Vue Testing
   Library's own setup docs, not a design choice with real alternatives
   worth listing.
5. **`package.json` `name` field changed from the scaffold's `"frontend"`
   to `"tally-frontend"`**, per AGENTS.md's "use `tally` as the base name
   for anything that needs one." This field isn't published or otherwise
   user-visible; called out only for completeness.
6. **`data-testid` attributes on the sidebar/tab-bar containers.** Not
   mentioned in the spec, added purely to make the app-shell test able to
   scope `getByText('People')`-style queries to "the sidebar's People" vs.
   "the tab bar's People" (both render the same three labels
   simultaneously in jsdom, per the spec's own edge-case note that both
   are always in the DOM). This is test wiring, not styling — no `class`
   or visual behavior depends on it.
7. **`openapi-fetch` client `baseUrl`** set to `'/'` in `src/api/client.ts`
   as a placeholder — nothing in this issue makes a real request, and
   issue #15 ("wire the frontend to a real backend") is explicitly where
   the real base URL / env wiring would matter. Not specified by the spec
   either way.
8. **Icon SVG paths** copied verbatim from the design mockups
  (`_docs/design/mockups/standalone/people.html` /
  `people-mobile.html`) for person/receipt/scale, per the design system
  doc's explicit instruction to use the mockup source rather than
  redrawing. Not independently re-verified against every other mockup
  file (they should be identical everywhere per the doc, but I only
  cross-checked the People screen's desktop and mobile variants).

## What I deliberately left out

- Everything listed under "Out of scope" in the spec: no feature UI, no
  MSW handlers, no backend wiring, no e2e, no CI, no ESLint/Prettier
  beyond the Vite template default, no deployment config, no empty/error/
  loading states.
- `README.md` and `.vscode/extensions.json` were left as Vite's scaffold
  defaults — not mentioned by the spec either way.

## Verification performed

- `cd frontend && npm install && npm run build` — exit 0, produces
  `frontend/dist/`.
- `cd frontend && npm test` — 2 files, 6 tests, all passing.
- `cd frontend && npm run generate:api-types` — exit 0, regenerates
  `src/api/schema.d.ts` with a `paths` export, verified `npm run build`
  (which type-checks via `vue-tsc -b`) still passes afterward.
- Did a clean-room check: `rm -rf node_modules dist && npm install && npm
  run build && npm test` all succeeded from scratch.

Not independently verified: actual `npm run dev` in a browser (no browser
available in this environment) — the MSW worker-start path
(`import.meta.env.DEV` branch in `main.ts`) is therefore unexercised at
runtime, only read-reviewed.
