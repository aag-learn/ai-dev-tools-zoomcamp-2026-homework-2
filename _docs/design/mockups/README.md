# v1 mockups

Static mockups for Tally's four v1 screens — People, Expenses, Add/Edit
expense, Balances — at desktop, tablet, and mobile widths. Referenced
from `_docs/design-system.md`.

Live editable canvas: https://claude.ai/code/artifact/8e86899a-fcba-4d4c-aaf7-d8b87bbc4135

- `standalone/` — plain, dependency-free HTML files. Open any of them
  directly in a browser to see the screen rendered. This is the
  easiest way to look at a mockup without any tooling.
  - Desktop (1440px): `people.html`, `expenses.html`,
    `expense-form.html`, `balances.html`.
  - Tablet (768px, one representative screen — see
    `_docs/design-system.md` for why the other three aren't
    separately mocked): `expenses-tablet.html`.
  - Mobile (390px): `people-mobile.html`, `expenses-mobile.html`,
    `expense-form-mobile.html`, `balances-mobile.html`.
- `source/` — the original Design Components source for all of the
  above, as authored on the canvas linked above. Same content as
  `standalone/`, kept for exact reference values (colors, spacing,
  font sizes) and in case the canvas needs re-seeding later — see the
  `design` skill's "Updating an existing canvas" section.

Palette/type used: Tailwind's default slate neutrals + indigo-600
accent, green/rose for balance signs, IBM Plex Sans. Sample names and
amounts throughout are placeholder data, not real values.
