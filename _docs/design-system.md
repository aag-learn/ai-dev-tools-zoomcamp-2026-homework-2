# Design system

Derived directly from the v1 mockups in `_docs/design/mockups/`
(standalone HTML you can open in a browser, source in the Design
Components format, live editable canvas linked in that folder's
`README.md`). Every value below was actually used in those mockups,
not invented separately — if this doc and the mockups ever disagree,
the mockups are stale and should be re-seeded to match, per that
folder's `README.md`.

The real frontend is Vue 3 + TypeScript + Tailwind CSS
(`_docs/architecture.md`). Because the mockups were built directly on
Tailwind's own default palette and scale, almost everything below maps
to a stock Tailwind utility class with no `tailwind.config` changes —
called out per section.

## Color

| Role | Hex | Tailwind |
|---|---|---|
| Page background | `#f8fafc` | `bg-slate-50` |
| Surface (cards, sidebar, inputs) | `#ffffff` | `bg-white` |
| Border | `#e2e8f0` | `border-slate-200` |
| Divider (between rows) | `#f1f5f9` | `border-slate-100` |
| Text, primary | `#0f172a` | `text-slate-900` |
| Text, secondary (inactive nav) | `#475569` | `text-slate-600` |
| Text, muted (subtitles, meta, balance status word, helper text) | `#64748b` | `text-slate-500` |
| Accent | `#4f46e5` | `bg-indigo-600` / `text-indigo-600` |
| Accent, active/hover text | `#4338ca` | `text-indigo-700` |
| Accent, tinted background | `#eef2ff` | `bg-indigo-50` |
| Positive (person is owed) | `#059669` text / `#10b981` fill | `text-emerald-600` / `bg-emerald-500` |
| Negative (person owes) | `#e11d48` text / `#f43f5e` fill | `text-rose-600` / `bg-rose-500` |

One accent (indigo) plus the two semantic balance colors (emerald,
rose) — no other hues anywhere in the UI.

## Typography

- **Font:** IBM Plex Sans (Google Fonts, weights 400/500/600/700),
  fallback `system-ui, sans-serif`. Deliberately not Inter/Roboto/Arial.
  Add to `tailwind.config`: `fontFamily.sans: ['IBM Plex Sans', ...defaultTheme.fontFamily.sans]`,
  and load the stylesheet in `index.html`.
- **Scale actually used:**

| Use | Size / weight | Notes |
|---|---|---|
| Page title (`h1`) | 26px / 600 | `-0.01em` letter-spacing |
| Modal title | 19px / 600 | |
| Sidebar wordmark | 17px / 600 | |
| List primary text (name, description) | 15px / 500–600 | |
| Nav item label | 14px / 500 (inactive), 600 (active) | |
| Body / button text | 14px | buttons always 600 |
| Meta text (expense date/payer/participants) | 13px / 400 | muted |
| Form field labels | 13px / 500 | muted |
| Balance status word ("is owed"/"owes") | 12px / 400 | muted |

Tailwind's default type scale doesn't line up exactly with all of
these (e.g. 26px sits between `text-2xl` and `text-3xl`) — use the
closest default (`text-2xl` + a touch of tracking) rather than adding
arbitrary one-off sizes; pixel-perfect fidelity to the mockup isn't a
requirement.

## Spacing & radius

| Token | Value | Tailwind |
|---|---|---|
| Sidebar width | 220px | `w-[220px]` |
| Page content padding | 48px / 56px | `py-12 px-14` |
| Page content max-width | 720px (single list), 820px (expenses) | `max-w-xl` / `max-w-3xl`-ish |
| Card/list container radius | 12px | `rounded-xl` |
| Button/input radius | 8px | `rounded-lg` |
| Modal radius | 16px | `rounded-2xl` |
| Avatar radius | full | `rounded-full` |
| Row padding | 16–18px vertical, 20px horizontal | `py-4 px-5` |
| Major section gap | 28px | `gap-7` |
| Inline element gap | 8–12px | `gap-2` / `gap-3` |

A few odd values (9px nav-item padding, 30px icon-button size, 18px
checkbox) don't land exactly on Tailwind's default scale — round to
the nearest stock utility (`p-2` vs `p-2.5`) rather than reaching for
arbitrary-value classes everywhere; this is a PoC, not a pixel-perfect
handoff.

## Icons

Inline SVG only, never emoji. 24×24 viewBox, `stroke="currentColor"`,
`fill="none"`, `stroke-width: 1.75` (2 for small utility glyphs),
rounded caps/joins. Icons used: person (nav), receipt (nav), balance
scale (nav), plus (add), pencil (edit), trash (delete), x (close),
chevron-down (select), check (checkbox). See the mockup source files
for the exact paths.

## Components

**App shell** — fixed 220px white sidebar with a right border, page
background `slate-50`, main content padded and width-capped. Present
identically on every screen.

**Sidebar nav item** — icon + label, `rounded-lg`. Active:
`bg-indigo-50`, `text-indigo-700`, 600 weight, icon also indigo.
Inactive: transparent, `text-slate-600`, 500 weight, icon `slate-500`.

**Logomark** — 28px `rounded-lg` indigo-600 square containing a small
white tally-mark glyph (three verticals + one diagonal strike),
alongside the "Tally" wordmark.

**Page header** — `h1` + muted subtitle; optional primary action
button right-aligned on the same row (used on Expenses).

**Primary button** — `bg-indigo-600`, white text, 600 weight,
`rounded-lg`, optional leading 16px icon.

**Secondary/ghost button** — white background, `border-slate-300`,
`text-slate-600`. Same sizing as primary. Used for "Cancel."

**Text input** — white background, `border-slate-300`, `rounded-lg`,
14px text. The amount field prefixes a static "$" inside the same
bordered box rather than a separate label.

**Custom select / date control** — same bordered-box styling as a text
input, value text left, trailing icon (chevron for select, calendar
for date) right. Not a native `<select>`/`<input type=date>` — fully
custom-styled to stay visually consistent with the rest of the form.

**List/card container** — white, `border-slate-200`, `rounded-xl`,
`overflow-hidden`; rows divided by a `slate-100` bottom border, last
row has none.

**Person row** — 36px avatar circle (`bg-indigo-50`, `text-indigo-700`
initial) + name, 15px/500.

**Expense row** — description (15px/600) + meta line (13px, muted:
date • payer • participants) on the left; amount (15px/600) + edit
and delete icon buttons on the right.

**Icon button** — 30px square, `rounded-lg`, `text-slate-500`,
transparent background (give it a hover background in the real
implementation — the mockup is static so this isn't shown, but a
click target with no hover feedback would be a regression).

**Modal dialog** (desktop/tablet) — `rgba(15,23,42,0.45)` backdrop,
centered white card (480px, `rounded-2xl`, drop shadow, 28px padding).
Header row: title + close icon button. Footer: right-aligned ghost
"Cancel" + primary "Save" button. Used for the add/edit expense form.

**Full-screen sheet** (mobile only) — replaces the modal at mobile
width. White background fills the viewport; header is a three-part bar
(ghost "Cancel" text button left, title centered, primary "Save" text
button right, `border-slate-200` bottom border) instead of a
close-icon-plus-footer-buttons layout — there's no room for a fixed
footer above the keyboard on a phone.

**Bottom tab bar** (mobile only) — replaces the sidebar at mobile
width. Fixed to the viewport bottom, white background, `border-slate-200`
top border, ~70px tall, 3 items evenly spaced (`justify-around`), each
an icon (22px) over an 11px label. Same active/inactive coloring as
the desktop sidebar nav item (indigo-700 vs. slate-500) — an earlier
draft used the lighter slate-400 for the inactive state, but that
fails WCAG AA contrast against white and was corrected; use slate-500
consistently for inactive nav text everywhere, mobile included.

**Form field group** — 13px/500 muted label + control, small gap.

**Checkbox (participant selector)** — 18px `rounded` box. Checked:
`bg-indigo-600` with a white check icon. Unchecked (not shown in the
mockup, since it only demonstrates the "everyone selected" default):
white background with a `border-slate-300` outline, no icon — kept
consistent with every other unfilled control in the system.

**Balance row** — avatar + name + status word ("is owed"/"owes",
12px, muted slate-500 — not the lighter slate-400, which fails
contrast for text this small) on the left; signed amount (16px/600,
emerald or rose) on the right; a thin (5px) pill-shaped bar
underneath, `slate-100` track, filled proportionally to the balance's
magnitude relative to the largest balance on screen, emerald or rose
to match the sign.

## Responsive behavior

Three widths, matching Tailwind's own breakpoints so the real
implementation is mostly `lg:`/`md:`/base utility variants rather than
custom breakpoints:

| Breakpoint | Width | Sidebar/nav | Notes |
|---|---|---|---|
| Desktop (`lg:` and up) | 1440px mocked | Full 220px sidebar, labels + icons | As designed originally. |
| Tablet (`md:`, ≥768px) | 768px mocked | Same full sidebar, reused as-is | 220px sidebar still leaves ~550px for content — no new nav pattern needed, just tighter content padding (`px-8` instead of `px-14`) and no `max-width` cap. Only **Expenses** is mocked at this width (`expenses-tablet.html`) since the other three screens follow the identical pattern with no new decisions — don't re-derive one from scratch, reuse this screen's approach. |
| Mobile (base, <768px) | 390px mocked | Bottom tab bar | Sidebar doesn't fit; replaced by a fixed bottom bar (icon + 11px label, 3 items, ~70px tall) reusing the same nav icons. Page title moves to a slim top bar with a compact 40px icon-only action button (add person / add expense) instead of desktop's labeled pill button. |

**Mobile-specific adaptations** (not just "the same screen, narrower" —
these are real layout changes, see the mockups):

- **Expense row** — stacks to two lines: description + amount on line
  one, meta text (date · payer · participants, truncated with an
  ellipsis if too long) + edit/delete icon buttons on line two. The
  desktop single-line row doesn't fit at 390px.
- **Add/Edit expense form** — becomes a full-screen sheet, not a
  centered modal (a fixed 480px card doesn't fit a phone viewport at
  all — this isn't a style choice, it's a hard constraint). Header
  becomes the standard "Cancel / Title / Save" three-part bar, which
  also removes the need for a separate button footer competing with
  the on-screen keyboard. Payer and Date stack full-width instead of
  sitting side by side.
- **Icon buttons** — sized up slightly on mobile (32px vs. desktop's
  30px) to stay closer to a comfortable touch target; still short of
  the usual 44px minimum for a primary action, which is a real gap —
  see "What's not covered yet" below.

## What's not covered yet

- Empty states (zero people, zero expenses) — the mockups only show a
  populated group.
- Error/validation states on the expense form.
- Loading states.
- Truncation/overflow rules for long descriptions or long participant
  lists — the mobile expense row's meta line correctly ellipsis-truncates
  (verified: `flex:1; min-width:0` on the text span so it can actually
  shrink), but that only handles *that it* truncates, not *what content*
  should take priority when it does (date? payer? participant count?).
  The description line above it has no truncation at all yet — a long
  one will currently wrap and make that row taller than its neighbors.
- Touch target sizing — mobile icon buttons in the mockup are 32px,
  below the usual 44px minimum recommended for primary actions. Worth
  a deliberate decision (bigger buttons vs. accepting 32px for
  secondary actions like edit/delete) rather than carrying the gap
  into implementation unexamined.

Add these here as they're designed, rather than leaving
software-engineer to invent them mid-implementation.
