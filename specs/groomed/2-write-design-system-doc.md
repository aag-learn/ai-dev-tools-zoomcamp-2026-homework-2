---
issue: 2
label: groomed
---

# Write _docs/design-system.md

## Summary

`_docs/design-system.md` is referenced by `AGENTS.md` ("For anything
touching the UI, read `_docs/design-system.md`") and flagged in
`_docs/architecture.md` as an open question blocking any UI-facing work.
The document — plus its supporting mockups — has now been written. This
spec documents the deliverable as it actually exists today, so its
completeness can be verified and so the "what's not covered yet" gaps are
tracked as known, deliberate follow-ups rather than silently missing.

## Scope

- `_docs/design-system.md`: a single Markdown doc covering color,
  typography, spacing/radius, icons, a component inventory, and
  responsive behavior for the Tally v1 frontend (Vue 3 + TypeScript +
  Tailwind CSS), plus an explicit "What's not covered yet" section.
- `_docs/design/mockups/`: the supporting static mockups the doc is
  derived from — `source/*.dc.html` (Design Components source, editable
  canvas), `standalone/*.html` (dependency-free HTML viewable directly in
  a browser), and a `README.md` explaining both and linking the live
  canvas.
- Coverage: all four v1 screens (People, Expenses, Add/Edit expense,
  Balances) at three widths (desktop 1440px, tablet 768px, mobile 390px),
  with tablet mocked only for Expenses (the doc states the other three
  screens follow the identical pattern).
- `_docs/architecture.md`: remove the stale "not yet written" note on
  `design-system.md` in the file-tree comment, and remove the "Open
  questions" bullet stating the doc doesn't exist yet — both are now
  inaccurate now that the doc exists.

## Out of scope

- Empty states (zero people, zero expenses) — not designed yet. Needs a
  follow-up design task before any screen that can be empty is
  implemented.
- Error/validation states on the expense form — not designed yet. Needs a
  follow-up design task.
- Loading states — not designed yet. Needs a follow-up design task.
- Truncation/overflow priority rules for long descriptions or long
  participant lists (beyond the mobile expense row's meta line, which
  already ellipsis-truncates) — needs a follow-up design decision.
- A resolved decision on mobile touch target sizing (32px icon buttons vs.
  the usual 44px minimum for primary actions) — flagged in the doc as a
  known gap needing a deliberate decision, not yet resolved.
- Any `tailwind.config` change beyond the one named in the doc (adding
  `fontFamily.sans` for IBM Plex Sans) — implementing that config change
  and wiring the Google Fonts stylesheet into `index.html` is
  implementation work for the frontend build, not part of this doc.
- Building the actual Vue components — this issue is documentation/design
  reference only.

## Acceptance criteria

1. `_docs/design-system.md` exists and its first line is a `# Design
   system` heading.
2. The doc states it is derived from `_docs/design/mockups/` and that the
   mockups are the source of truth if the two ever disagree.
3. The doc contains a Color section with a table mapping each of the
   following roles to both a hex value and a Tailwind utility class: page
   background, surface, border, divider, primary text, secondary text,
   muted text, accent, accent active/hover, accent tinted background,
   positive (owed), negative (owes).
4. The doc contains a Typography section naming the typeface (IBM Plex
   Sans, weights 400/500/600/700, `system-ui, sans-serif` fallback), the
   required `tailwind.config` addition (`fontFamily.sans`), and a size/use
   table covering at minimum: page title, modal title, sidebar wordmark,
   list primary text, nav item label, body/button text, meta text, form
   field labels, balance status word.
5. The doc contains a Spacing & radius section with a table covering at
   minimum: sidebar width, page content padding, page content max-width,
   card/list container radius, button/input radius, modal radius, avatar
   radius, row padding, major section gap, inline element gap — each with
   a Tailwind class.
6. The doc contains an Icons section specifying: inline SVG only (no
   emoji), 24×24 viewBox, `stroke="currentColor"`, `fill="none"`, and the
   list of icons used (person, receipt, balance scale, plus, pencil,
   trash, x, chevron-down, check).
7. The doc contains a Components section describing, at minimum: app
   shell, sidebar nav item, logomark, page header, primary button,
   secondary/ghost button, text input, custom select/date control,
   list/card container, person row, expense row, icon button, modal
   dialog, full-screen sheet (mobile), bottom tab bar (mobile), form field
   group, checkbox, balance row.
8. The doc contains a Responsive behavior section with a table listing
   three breakpoints (desktop `lg:`, tablet `md:`, mobile base) each
   mapped to a Tailwind breakpoint, a mocked width, and the sidebar/nav
   pattern used at that width.
9. The doc explicitly documents at least these three mobile-specific
   layout adaptations (not just narrower versions of desktop): the
   two-line mobile expense row, the full-screen sheet replacing the modal
   for the expense form, and the up-sized (32px) mobile icon buttons.
10. The doc contains a "What's not covered yet" section (or equivalently
    named) listing at minimum: empty states, error/validation states,
    loading states, truncation/overflow priority rules, and the mobile
    touch-target sizing gap.
11. `_docs/design/mockups/README.md` exists and documents: what screens
    and widths are mocked, the difference between `source/` and
    `standalone/`, and a link to the live editable canvas.
12. `_docs/design/mockups/source/` contains one `.dc.html` file per mocked
    screen/width combination (8 files: People, PeopleMobile, Expenses,
    ExpensesMobile, ExpensesTablet, ExpenseForm, ExpenseFormMobile,
    Balances, BalancesMobile — currently 9, confirm count matches what's
    present) plus `canvas.json`.
13. `_docs/design/mockups/standalone/` contains one dependency-free
    `.html` file per mocked screen/width combination, openable directly in
    a browser with no build step or local server.
14. `_docs/architecture.md`'s file-tree comment for `design-system.md`
    (currently "referenced by AGENTS.md, not yet written") is updated to
    no longer say "not yet written", and the "Open questions" entry
    stating `_docs/design-system.md` does not exist yet is removed from
    that file.

## Edge cases considered

- **Doc/mockup drift**: the doc explicitly calls out that if the doc and
  mockups disagree, the mockups are stale and should be re-seeded to
  match (per the mockups' `README.md`) — this doc, not the mockups, is
  the doc-of-record for values used elsewhere in the codebase.
- **Non-default-scale values**: several exact pixel values (26px page
  title, 9px nav-item padding, 30px icon buttons, 18px checkbox) don't
  land on Tailwind's default scale. The doc explicitly instructs rounding
  to the nearest stock utility rather than reaching for arbitrary-value
  classes, and explicitly waives pixel-perfect fidelity as a requirement
  (this is a PoC).
- **Contrast regressions caught during design**: the doc calls out two
  corrected mistakes explicitly — inactive nav/tab text using
  `slate-500` (not the lighter `slate-400`, which fails WCAG AA) both on
  desktop and on the mobile tab bar, and the balance status word using
  `slate-500` for the same reason. Both are now the documented, final
  values.
- **Tablet coverage gap**: only Expenses is mocked at tablet width. The
  doc explicitly states the other three screens follow the identical
  pattern and instructs reusing that approach rather than re-deriving one
  — this is a deliberate scope reduction, not an oversight.

## Constraints

- Frontend stack is fixed: Vue 3 + TypeScript + Tailwind CSS
  (`_docs/architecture.md`) — the doc's Tailwind-class mappings assume
  this and were chosen to avoid `tailwind.config` changes wherever
  possible.
- Per `AGENTS.md`, any future task touching the UI must read this doc
  first; this doc must therefore stay accurate as the actual source of
  truth rather than aspirational.
- No dependency additions were needed to produce this doc or the
  mockups (static HTML, no build tooling) — consistent with
  `AGENTS.md`'s rule that dependencies aren't added without asking.

## Open questions

None. The deliverable (doc + mockups) already exists; this spec verifies
it against the acceptance criteria above rather than proposing new
scope. Acceptance criterion 12's file count should be reconciled against
whatever is actually present in `source/` at verification time (9 files
were found during grooming, one more than the 8 named screen/width
combinations, since `canvas.json` is also in that directory and isn't a
mockup file itself — verify the 8 `.dc.html` files plus `canvas.json` are
all present, no more, no less).
