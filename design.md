# Llama Design System — web app

DefiLlama is a data-dense analytics UI: near-neutral surfaces, restrained color, tight radii, small type. Color signals **state and data direction** (up/down, brand, warning), never decoration. Hierarchy comes from surface elevation and text tiers, not shadows.

Design source of truth: the **Llama Design System** Figma library (Primitives + Semantics collections). Code source of truth: [`src/styles/primitives.css`](src/styles/primitives.css) and [`src/styles/semantics.css`](src/styles/semantics.css). If this document and those files disagree, the files win; if the files and the Figma library disagree, flag it — don't silently pick one.

> **Note:** this file is excluded from Tailwind's source scanning (`@source not` in `tailwind.css`) so the class names mentioned here never generate CSS. Keep it that way.

## Architecture

Three tiers, strictly ordered. Components may only reference tier 2 (or tier-3 component tokens where they exist):

1. **Primitives** (`primitives.css`) — raw ramp values (`--ld-blue-500`). Never used in components. Deliberately _not_ registered as Tailwind colors (names would collide with the built-in `neutral`/`blue`/… palettes).
2. **Semantics** (`semantics.css`) — role tokens (`--ld-bg-surface`, `--ld-text-data-up`), light values on `:root`, dark overrides under `html.dark`. Registered as Tailwind utilities: `bg-surface`, `text-primary`, `text-data-up`, `border-subtle`, …
3. **Component tokens** — only when a value genuinely diverges from a semantic (currently: chips). If a component token would just alias a semantic, bind the semantic directly instead.

The mode lives in the CSS selector, never in the token name: no `*-light`/`*-dark` suffixed pairs, and no `dark:*-[#hex]` utilities in components.

## Color tokens

CSS variables carry an `--ld-` prefix until the legacy variables of the same name are retired (see Migration).

### Backgrounds

| Utility                 | Light       | Dark        | Use                                  |
| ----------------------- | ----------- | ----------- | ------------------------------------ |
| `bg-page`               | `#f7f7f7`   | `#090b0c`   | Page background                      |
| `bg-surface`            | `#ffffff`   | `#131516`   | Cards, panels, dialogs               |
| `bg-surface-elevated-1` | `#eeeeee`   | `#181a1b`   | Nested emphasis inside a surface     |
| `bg-surface-elevated-2` | `#dedede`   | `#232628`   | Second elevation step                |
| `bg-brand`              | `#1f67d2`   | `#1f67d2`   | Primary actions, brand fills         |
| `bg-brand-muted`        | `#1f67d21f` | `#1f67d233` | Brand tint: hovers, selected states  |
| `bg-brand-faint`        | `#1f67d20f` | `#1f67d21f` | Lightest brand wash (dark value TBC) |

### Text

| Utility              | Light     | Dark      | Use                                     |
| -------------------- | --------- | --------- | --------------------------------------- |
| `text-primary`       | `#090b0c` | `#ffffff` | Main text                               |
| `text-secondary`     | `#484848` | `#c6c6c6` | Supporting text                         |
| `text-tertiary`      | `#878787` | `#878787` | De-emphasized text (same in both modes) |
| `text-disabled`      | `#dedede` | `#2f3336` | Disabled controls                       |
| `text-link`          | `#1853a8` | `#4b86db` | Links                                   |
| `text-on-brand`      | `#ffffff` | `#ffffff` | Text on `bg-brand`                      |
| `text-data-up`       | `#32933f` | `#3eb84f` | Positive movement (price, TVL)          |
| `text-data-down`     | `#b53b35` | `#e24a42` | Negative movement                       |
| `text-data-up-alt`   | `#1f67d2` | `#1f67d2` | Alternate up (blue), chart contexts     |
| `text-data-down-alt` | `#9333ea` | `#9333ea` | Alternate down (violet), chart contexts |
| `text-warning`       | `#a15d23` | `#ffa455` | Warnings (light value TBC by design)    |

`text-disabled` is only for actual disabled controls. Do not use it for metadata,
symbols, empty values, helper copy, or struck/excluded data; use `text-secondary`
for readable support text and `text-tertiary` for de-emphasized/missing values.
The legacy arbitrary class `text-(--text-disabled)` maps to tertiary for old
callers only and should not be introduced in new in-scope UI.

### Borders (alpha-based — layer on any surface)

| Utility              | Light       | Dark        | Use                           |
| -------------------- | ----------- | ----------- | ----------------------------- |
| `border-very-subtle` | `#090b0c08` | `#ffffff08` | Faintest separation           |
| `border-subtle`      | `#090b0c0f` | `#ffffff0f` | Default hairlines             |
| `border-medium`      | `#090b0c1f` | `#ffffff1f` | Card borders, form controls   |
| `border-strong`      | `#090b0c82` | `#ffffff29` | High-emphasis outlines        |
| `border-brand`       | `#1f67d2`   | `#1f67d2`   | Focus, active, brand outlines |
| `border-divider`     | `#eeeeee`   | `#232628`   | Opaque dividers               |

**Divider floor (owner decision, 2026-07-08):** 1px row/section dividers use `border-subtle` as the minimum — the frames spec `stroke-very-subtle` on metric rows and panel headers, but 3% alpha at 1px is invisible on real monitors (raised as a design ask). `border-very-subtle` stays reserved for oversized separators and non-hairline separation. Sidebar section dividers are `border-medium` per the dividers node (6476:29270, stroke-medium at 0.75 — we keep 1px; browsers render sub-pixel borders inconsistently).

### States & component tokens (CSS variables only, no utility yet)

| Variable             | Light       | Dark        | Use                                      |
| -------------------- | ----------- | ----------- | ---------------------------------------- |
| `bg-hover-row`       | `#1f67d21f` | `#ffffff0f` | Popover/menu/table row hover — and focus |
| `bg-hover-card`      | `#1f67d20f` | `#ffffff08` | Card/tile hover wash — and focus         |
| `--ld-bg-screen-dim` | `#090b0c33` | `#090b0c33` | Backdrops                                |
| `--ld-chip-bg`       | `#dedede`   | `#232628`   | Filter chips                             |
| `--ld-chip-text`     | `#484848`   | `#c6c6c6`   | Filter chip text                         |

Hover washes paint _over_ `bg-surface` and are deliberately asymmetric across modes: brand-tinted in light, white-lift in dark (verified from the metrics-card hover pair and the columns-popover row). Interactive rows and cards use the same wash for `:hover` and `:focus-visible`; selection/active is a different concept and uses brand tokens (tint, solid, or brand border depending on the control — see Components).

**Two hover mechanisms — pick by resting background:**

- `hover:bg-hover-row` — only for elements whose resting background is **transparent** (popover/menu/table rows, ghost buttons). It _replaces_ the background, which is fine when there is nothing to replace.
- `.hover-wash` ([semantics.css](src/styles/semantics.css)) — for any element whose resting background is **tinted or opaque** (`bg-brand-muted` pills, selected segments, `bg-surface` tiles). It applies the wash as a `background-image`, stacking over the resting color. Handles `:hover` + `:focus-visible` and skips `:disabled`/`aria-disabled` automatically. Variants: `.hover-wash-card` (fainter `--ld-hover-card`, used by interactive `Card`) and `.group-hover-wash` (washes when the ancestor `.group` is hovered — for sticky table cells that must keep an opaque bg). Never put `hover:bg-hover-row` on a `bg-brand-muted` element: light-mode `hover-row` is the _same value_ as light `bg-brand-muted` (`#1f67d21f`), so the hover is invisible, and in dark it strips the brand tint.
- Exception: an **opaque→opaque elevation step** is also a valid hover for triggers resting on `bg-surface-elevated-1` (e.g. the Select `default` trigger hovers to `bg-surface-elevated-2`) — a full-strength deliberate affordance, stronger than the wash. Don't mix both on one element.

### Usage rules

- **Surfaces** step `page → surface → elevated-1 → elevated-2`. Cards sit on `bg-surface`; elevation steps are for nested emphasis, not general fills.
- **Text tiers rank information.** They are text-only by convention — never `bg-primary`.
- **Solid colors for text and fills; translucent for borders, dividers, and hover washes.**
- **Data direction:** `text-data-up`/`text-data-down` for movement; the `-alt` pair when a chart needs a second axis of meaning. Reserve `--success`/`--error` for genuine feedback (form validation, toasts) — a price drop is not an error.
- **Brand blue `#1f67d2` comes only from the brand tokens.** Never restate it as a hex literal.

## Typography

From the Figma library text styles, implemented as utilities in [`src/styles/typography.css`](src/styles/typography.css). The family decision (Inter Display vs current Inter var) is pending with design.

| Style          | Size | Weight | Family         |
| -------------- | ---- | ------ | -------------- |
| `heading-lg`   | 32   | 600    | Inter          |
| `heading-sm`   | 20   | 600    | Inter          |
| `heading-xs`   | 18   | 600    | Inter          |
| `label-xl`     | 18   | 500    | Inter          |
| `label-lg`     | 16   | 500    | Inter          |
| `label-md`     | 14   | 500    | Inter          |
| `label-sm`     | 12   | 500    | Inter          |
| `label-xs`     | 10   | 500    | Inter          |
| `body-xl`      | 18   | 400    | Inter          |
| `body-lg`      | 16   | 400    | Inter          |
| `body-md`      | 14   | 400    | Inter          |
| `body-sm`      | 12   | 400    | Inter          |
| `body-xs`      | 10   | 400    | Inter          |
| `mono-xl`      | 24   | 700    | JetBrains Mono |
| `mono-md`      | 14   | 400    | JetBrains Mono |
| `mono-md-bold` | 14   | 700    | JetBrains Mono |
| `mono-sm`      | 12   | 400    | JetBrains Mono |
| `mono-sm-bold` | 12   | 700    | JetBrains Mono |

Sizes in the table are Figma px for reference; the utilities implement them in **rem** (px ÷ 16) so user browser font-size preferences are respected — same basis as Tailwind's built-in `text-*` scale. Verified line heights follow the Figma per-style values as exact unitless fractions (`Figma line-height ÷ font-size`): Label 10/12, 12/16, 14/17; Heading 18/22; Body 12/16, 14/21. Remaining TODO styles are interpolated to integer default-root line boxes until checked in Figma. This avoids the off-center placeholder/control text that fractional band ratios caused. Vertical rhythm still belongs to containers (`gap`, `padding`, `min-h`), not arbitrary `leading-[…]` or `tracking-[…]` one-offs. (1px hairline borders and canvas chart fonts stay px on purpose.)

`label-*` (medium) carries single-line scannable text: table headers, nav, form labels, metadata. `body-*` (regular) is multi-line copy. `mono-*` sets numbers, addresses, and code — prefer it wherever figures must align. Do not set arbitrary font sizes (`text-[10px]`) — the ramp has a step for every approved size.

**Size floors (owner decisions — the frames' smallest sizes read too small in the browser; don't copy Figma sizes verbatim):** interactive text (buttons, pills, selects, menu rows) is **12px minimum** (`label-sm`/`body-sm`); card body and data rows are **14px** (`body-md` labels, `mono-md`/`mono-md-bold` values); 10px (`label-xs`/`body-xs`) is reserved for non-interactive metadata — eyebrow section headers, count badges. Dense table cells may use 12px.

## Spacing, radius, borders

- **Spacing** is a 4px-based scale — the standard Tailwind scale; no arbitrary `p-[10px]` values (ratcheted by `lint:tokens`).
- **Border width** is 1px in almost all cases. Data-table row/grid dividers use `border-divider`; section separators and detail-card internal rules use `border-subtle` or `border-very-subtle` depending on the surface contrast. Do not use `border-medium` for simple dividers.
- **Layout is gap/padding/min-h driven.** Figma values for margins, absolute offsets, and per-element line heights are rendering artifacts of the design tool — do not transcribe them. Space siblings with flex/grid `gap`, size boxes with `padding` and `min-h`, and let text wrap naturally. Margins are reserved for opting out of a parent's rhythm (`mt-auto`, negative bleed), not for building it.
- **Responsive spacing picks both ends from the palette** (`gap-2 lg:gap-4`), never an invented in-between value. Viewport-fluid scaling (Utopia-style `clamp()` interpolation) was considered and rejected: this is a density-first data app — big screens get more data, not bigger chrome — and fluid values would break pixel-diff verification and Figma-frame review.

### Space palette (roles, measured from the page frames)

| Role                            | Value                             | Tailwind          |
| ------------------------------- | --------------------------------- | ----------------- |
| Icon ↔ text in a control        | 4px (tight: 2px)                  | `gap-1`/`gap-0.5` |
| Tight inline control internals  | 4px                               | `gap-1`           |
| Dense toolbar control cluster   | 6px                               | `gap-1.5`         |
| Between toolbar/control groups  | 8px                               | `gap-2`           |
| Home top controls gap           | 12px                              | `gap-3`           |
| Dense card padding              | 8px                               | `p-2`             |
| Directory card padding          | 12px                              | `p-3`             |
| Roomy card/panel padding        | 16px                              | `p-4`             |
| Panel header                    | 16px x / 12px y                   | `px-4 py-3`       |
| Chart/table toolbar row         | 8px, no chart-side bottom padding | `p-2 pb-0`        |
| Popover/menu row                | 12px x / 8px                      | `px-3 py-2`       |
| Between cards / panels / tables | 8px                               | `gap-2`           |
| Prose/detail card internals     | 12px                              | `gap-3`           |
| Card sections                   | 24px                              | `gap-6`           |
| Page gutter (vs sidebar)        | 16px                              | `p-4`-ish         |
| Sidebar item padding            | 8px                               | `p-2`             |

The frames disagree in a few places (content gutter 12 vs 16, page vertical rhythm 6 vs 12/16, toolbar control heights 24/26/32); the palette above is the reconciled pick — deviations from a specific frame are listed in the sweep PR description for design veto.

### Intentional Figma Reconciliations

These are owner decisions, not extraction mistakes:

- Interactive text never goes below 12px even when Figma shows 10px controls or chips. Use `label-sm`/`body-sm`; reserve `label-xs`/`body-xs` for non-interactive metadata.
- Card body/data rows stay 14px for browser readability, even where a frame uses 12px.
- Dense stat/data cards use 8px padding on all sides. Some Figma cards show 12px vertical padding; code should prefer the 8px dense-card rhythm unless a route-specific frame requires the extra space.
- Home/analytics page stacks use 8px major gaps. Some home frame siblings measure as 6px; the implementation should use one page-level `gap-2` rhythm and keep the top controls' 12px horizontal gap as the explicit exception.
- Chart/table/action toolbars use 32px controls from primitive padding/min-height. Dense adjacent controls use 6px gaps; larger control groups and toolbar padding use 8px.
- Titled `PanelHeader` remains the taller Figma panel recipe. Inline chart/table toolbars use the compact toolbar recipe instead of forcing every chart control row into `PanelHeader`.
- Popover/menu surfaces own background, border, radius, and overflow only. Search blocks, action rows, footers, and list rows own vertical spacing.
- Cartesian ECharts grid insets stay as-is for now. A 12px chart grid inset can optically read closer to 8px DOM spacing because axes, labels, dataZoom, and canvas drawing are involved; changing it is a visual chart change requiring screenshots/pixel checks.

| Radius | Tailwind                      | Use                                          |
| ------ | ----------------------------- | -------------------------------------------- |
| 4px    | `rounded-sm`                  | Chain pills, small chips                     |
| 6px    | `rounded-md`                  | Small buttons (h-24), toggle groups          |
| 8px    | `rounded-[8px]` in primitives | Cards, panels, inputs, medium buttons (h-32) |
| 12px   | `rounded-xl`                  | Popovers, menus, dialogs, roomy cards        |
| 9999px | `rounded-full`                | Filter pills, avatars, icon buttons          |

One radius family per component type — don't mix radii within a view. The current
Tailwind scale in this app does not make `rounded-lg` a live 8px guarantee, so
design-system primitives use exact 8px radius classes until the global scale can
move without disturbing quarantined legacy surfaces. If a Figma component has a
real exception, expose it as a primitive variant rather than a page-local
`rounded-*` class; current exception: unlock event cards use `Card radius="large"`
for the 12px card in Figma 6298:39347/6291:39214.

## Component recipes

Measured from the redesigned frames (node IDs in the sweep PRs). These are the shared vocabulary for all page sweeps; build them once, reuse everywhere.

- **Button** — [`src/ui/Button.tsx`](src/ui/Button.tsx). Heights are **padding-driven, never fixed** (every control in a row shares the same `py`, so mixed content always lines up): `sm` = `min-h-6 px-2 py-0.5 rounded-md`, `md` = `min-h-8 px-3 py-1.5 rounded-[8px]`, both `label-sm`; icon-only (`square`) = `p-0.5`/`p-1.5`. Variants: _secondary_ = transparent + `border-medium`; _primary_ = `bg-brand text-on-brand`; _outline_ ("active = branded") = `border-brand text-link`; _filter_ = full-radius `border-brand text-primary` with active `bg-brand-muted` for metrics-directory filter pills; _metricBrowse_ = 6px-radius dashed brand selected pill for the home metrics browse toolbar; _ghost_ = borderless trigger. Compose into Ariakit via `render={<Button/>}`; `buttonStyles()` only for class-only hosts.
- **Chain pill** — `rounded-sm px-2 py-1 body-sm font-medium`, resting `bg-brand-muted text-link-on-tint`; active `bg-brand text-on-brand`; hover/focus = `hover-wash`; row container `bg-surface border-subtle rounded-[8px] p-1 gap-1` clipped to exactly one row. (`font-medium` is an owner decision: the frame's 10px-Regular pill text was rejected with the same file-artifact reasoning as its size; uniform weight also keeps pill widths stable across active/inactive.) `text-link-on-tint` = `text-link` in light but a lighter interim blue (`#6a9be0`) in dark, because dark `Text/links` is below AA on `bg-brand-muted` — collapses back into `text-link` once the library fixes the token (design ask below). The "Others" overflow trigger is `bg-surface-elevated-2` + `hover-wash`.
- **Segmented control (Tabs)** — wrapper `bg-surface border-medium rounded-[8px] p-0.5 gap-0.5`; items `px-2 py-1 body-sm rounded-md` (the wrapper's `min-h` size pins control height — `py-1.5` would push content past the `sm`/24px floor), selected `bg-brand-muted text-link`, unselected `text-tertiary`; hover/focus = `hover-wash`. This is the standard toolbar segmented control for chart periods, denominations, table metric/period filters, and view-mode switches. (Figma instances disagree on unselected item size; this is the reconciled pick.)
- **Joined toggle group** — wrapper `border-subtle rounded-md` (6px), no padding; segments `px-2 body-sm`, selected segment solid `bg-brand text-on-brand`. Figma 6183:354509/6183:354649 is 26px with 10px text; code intentionally reconciles to the 12px interactive text floor and the 32px `md` toolbar control floor. Use only for explicit scope switches such as the metrics header All|Protocols|Chains exception; class-only hosts compose `TAG_GROUP_VARIANTS.solid` with `TAG_GROUP_SIZES.md` rather than introducing page-local aliases.
- **Filter chip (emoji row)** — `rounded-full border-strong px-3 py-1.5 label-sm text-secondary`. Metrics-directory category filters are the Button `filter` variant (Figma 6183:354658 inside 6183:354646): 24px floor, full radius, `border-brand`, `px-2 py-0.5`, `label-sm text-primary`. Chart-dialog metric option pills use the same 24px/full-radius shape but neutral resting border + brand active state; selected chart-toolbar chips stay 32px via `MetricChip`.
- **Popover surface** (menus, selects, tooltips, search results) — [`src/ui/Popover.ts`](src/ui/Popover.ts). Surface: `bg-surface-elevated-1 border-medium rounded-xl px-0 py-0`; rows `px-3 py-2 body-sm` full-bleed with `hover:bg-hover-row`; search blocks own full inset padding (`px-3 pt-3 pb-3`), while action rows, footers, and list rows own their own vertical spacing. Mobile menu/select popovers follow the app shell breakpoint (`lg`): shared drawer popovers portal to body by default (`portal={false}` is the explicit opt-out), the Ariakit wrapper anchors the sheet to the viewport bottom, and the surface keeps the reserved drawer height (`calc(100dvh - 80px)`) even when content is short and long content scrolls internally. Drawer animations own their transform; do not add `transform-none` to animated drawer surfaces to work around Floating UI placement. Action/footer button rows must stay contained by the popover width; use row-owned padding plus `min-w-0`/flex or grid sizing rather than viewport-wide children. Select/menu multi-select indicators always use a compact 14px rounded checkbox footprint: checked = `bg-brand border-brand` with a white check that fills the box, unchecked = an empty `border-strong` box. Single-select rows do not render an empty box/circle; the selected row shows only a blue check mark at the same compact size. Select/Deselect action rows are multi-select only. `FailedDataPopover` owns the shared failed-chart warning popover markup. `Popover.ts` also exports compatibility styles (`legacy*` plus explicit excluded-surface styles) only to keep quarantined ProDashboard/Yields/LlamaAI callers pixel-stable while shared components migrate; do not add new compatibility consumers outside those surfaces.
- **Dialog surface** — [`src/ui/Dialog.tsx`](src/ui/Dialog.tsx). Desktop dialogs remain centered modal surfaces. Mobile dialogs follow bottom-sheet behavior at the app shell breakpoint (`lg`): portal to the viewport, anchor to the bottom edge, use rounded top corners with no bottom radius, slide up/down smoothly, and scroll long content internally instead of exposing page content below the sheet. Dialogs should share chrome, close-button sizing, footer button sizing, and heading treatment through the dialog recipe; do not reuse popover drawer helpers for task dialogs.
- **Text input** — [`src/ui/Input.tsx`](src/ui/Input.tsx). h-32/min-h-8, `bg-page border-medium rounded-[8px] px-3 py-1.5`, optional 16px leading icon at left-3 with `pl-8`, placeholder `body-sm text-tertiary`; direct Ariakit input hosts use `inputStyles`.
- **Checkbox** 14×14 `rounded-[4px]`: checked `bg-brand` + white check, unchecked `border-strong`. **Switch** 40×24 track, brand when on, `label-sm` label at `gap-2`.
- **Card** — Base repeated content/data surface: `bg-surface rounded-[8px]`, constrained padding variants, a border variant, and a documented radius variant. Use `border-medium` for directory/repeated tiles; use `border-subtle` for protocol/detail surfaces that match the Figma surface stroke. Hover/focusable tiles use `.hover-wash-card` so the card-strength wash stacks over `bg-surface` instead of replacing it. Dense cards use `p-2`; summary strips use `px-4 py-3`; roomy detail cards use `p-4` only when a route-specific frame calls for that extra inset. `radius="large"` is 12px and is currently reserved for unlock event cards (`6298:39347`); do not use it as a generic drift patch. Protocol/stablecoin overview information/methodology cards (`6183:312146`, `6183:312158`, `6183:312167`) and related token/unlocks/RWA notes-prose cards are `Card padding="sm"` with `gap-3`, `heading-xs`, and `body-md` content; metadata labels such as `Category` and `Minting and Redemption` are `label-md text-secondary` (owner decision 2026-07-08, aligned with the metric-row label tier), while values/body copy remain `text-primary`. Action links inside these cards use neutral `Button md` / `buttonStyles({ size: 'md' })` styling with 32px height, 8px radius, `border-medium`, 12px horizontal padding, and 12px gaps between buttons; do not use blue outline/link styling unless the link is inline table/body text. Do not reintroduce responsive `xl:p-4` padding on those cards.
- **Summary metric cards** — Distinguish standalone headline metrics from secondary metric rows inside the same card. Headline totals in chart-adjacent summary cards (token overview, stablecoins, bridges, hacks, raises, chain/RWA/equity overview, extra TVL/adapter totals) use label text `text-secondary` and value text `font-jetbrains text-2xl font-semibold`. Secondary rows stay compact row content: row labels use the local row recipe (`body-md`/`body-sm` secondary or `MetricRow`), and values use `mono-md`/`mono-md-bold` or plain `font-jetbrains`; do not promote every row to the headline size. Inline top summary strips such as unlock token stats, token-rights counts, and CEX stablecoin summaries use 14px label/value pairs: `text-secondary` labels and `font-medium` values inside a `Card padding="strip"`/`px-4 py-3` strip. **Metric-row labels are `text-secondary` (owner decision, 2026-07-08):** the frames spec Text/tertiary for the dotted tooltip-able labels, but ~38 existing sites already used secondary, tertiary fails AA in light mode, and secondary was preferred visually — `MetricRow`/`MetricSection` label text is `body-md text-secondary` (chevrons/utility icons stay `text-tertiary`). `text-tertiary` remains for genuinely de-emphasized sub-data: raise dates, "(24h)"/"(30d)" suffixes, counts.
- **Entity/Page title strip** — Standalone title surface, not a panel header: `bg-surface border-subtle rounded-[8px] p-2`, 28px logo where present, 12px media/title gap, `heading-sm`/20px title, optional right-action slot. Current adopters include protocol TVL/Treasury/Active Loans/Forks, CEX assets/stablecoins, chain overview empty/title shell, bridge protocol overview, and LiquidationsV2 summary. Unlocks/governance/LST and data-card headers still need separate slot checks before reuse.
- **Panel** — True titled chart/table shell: `bg-surface border-subtle rounded-[8px]` with a separate header/body contract. `PanelHeader` stays the Figma-derived titled-panel recipe: `px-4 py-3 heading-xs` with `border-b border-subtle` (divider floor); header controls are `md` buttons/switch groups and dense control clusters use 6px gaps. Unlock allocation/events panels follow the same header/slot split from `6291:39042` and `6291:39214`; the section headings remain in the header and the cards/rows live in the padded slot. Do not use `PanelHeader` for standalone title strips or inline chart toolbars.
- **Status states (loading / error / empty)** — [`src/ui/Status.tsx`](src/ui/Status.tsx) is canonical: `PanelStatus` (container `min-h-[360px] flex-1 items-center justify-center p-2`; text `text-center body-sm`; loading/empty = `text-tertiary`, error = `text-data-down` + `role="alert"`) and `PanelLoadingStatus` (same container around a loader + `sr-only` label). Ad-hoc placeholders must match those tokens: loading/empty copy is `body-sm text-tertiary`, error copy is `body-sm text-data-down` — never raw `text-red-*`, `--error`, or `text-primary` for a "No results found". Dropdown/combobox empty rows: `px-3 py-6 text-center body-sm text-tertiary`. Full-panel zero-states (table "No columns selected", PnL no-data) may keep a `text-lg font-semibold text-primary` heading over a `body-sm`/`body-md` subtext. Placeholder shells reserve space with `min-h-*` (360 default; 400/406/450 where the shell reserves more), while actual ECharts mount nodes keep their fixed 360px chart body unless a caller explicitly passes a `height`. `TokenPrivateSectionGate` deliberately uses `text-secondary` for all three states so gated sections read uniformly.
- **Footer note / attribution** — De-emphasized source/attribution notes at the bottom of a page or panel: optional `Card padding="sm" border="subtle"` shell, heading `label-md text-primary` (e.g. "Attribution"), body `body-sm text-tertiary` with underlined links. Never raw `text-xs`/`text-sm` for these.
- **Sidebar divider** — Nav-only separator helper: `w-full max-w-53 border-t border-medium` (212px cap from the spacing scale; `border-medium` per dividers node 6476:29270). Keep sidebar scroll containers horizontally clipped so long pinned labels or capped dividers never create a horizontal scrollbar. Do not use black/white opacity border classes in the nav.
- **Chart panel toolbar** — Route-specific inline toolbar above a chart: `px-2 pt-2 pb-0`, 32px controls from primitive padding/min-height, 6px inside dense control clusters, 8px between larger groups. The chart body stays flush; cartesian plot inset comes from ECharts grid settings, not DOM padding. Panels may stretch to match adjacent content, but the ECharts plot itself stays at the 360px chart-body height unless a route explicitly supplies another `height`; extra panel height remains blank surface. When reserving a whole lazy-loaded chart shell that includes this toolbar plus a 360px chart body, use `406px` (`398px` was the old 24px-toolbar reservation); inner chart-only fallbacks stay `360px`.
- **Table** — 40px rows, `border-divider` row borders, numeric cells right-aligned `mono-sm`/`mono-sm-bold`, header `label-sm` with the active sort icon in `text-link`; row hover `bg-hover-row`. Filter/toolbar band: `p-2`, title `label-md`, 32px controls. `TableToolbar`/`TableToolbarControlGroup` provide the 6px dense internal gap; callers that need distinct left/right action groups should wrap those groups and use `gap-2` between groups. Table metric/period groups use the standard tinted segmented control, not the solid joined-toggle exception.
- **Paginated tables** — `PaginatedTable` owns pagination/scroller behavior and keeps its
  built-in shell for standalone use. When a page already renders a surrounding `Panel`/`Card`
  table shell, pass `shell="none"` so there is exactly one rounded border.
- **Tab navigation (page-level)** — items `px-3 py-2 label-md`, inactive `text-tertiary`, active `text-primary` + 2px `bg-brand` underline bar with rounded top corners.
- **Active = branded** is the cross-component rule: selection is shown with brand tint/solid/border + link-blue text, never with grays.

## Charts

Chart **series** colors come from `CHART_COLORS` + `getNDistinctColors` (golden-angle generator) in code — they are intentionally _not_ design tokens and must not be bulk-changed; the Figma library has no N-series concept.

Chart **chrome** (axis labels, gridlines, legend, dataZoom, PNG-export framing) uses the `--ld-chart-*` tokens in `semantics.css`. These are seeded with the exact pre-refresh literals and are deliberately decoupled from the text/border semantics so refactoring can never change chart rendering. The accent tokens (`--ld-chart-up/down/-alt`) are consumed only when a Figma frame explicitly restyles a specific chart, as part of that page's redesign PR.

**Chart consistency debt** (visual changes, scheduled for page sweeps — never as refactoring side effects): axis label color varies per chart (`ink(1)` in shared defaults, `ink(0.8)` in HBar/Scatter/Netflow, `ink(0.6)` on Candlestick's secondary axis) and should converge on one token — per the Figma frames, likely tertiary gray rather than full black/white; gridline alpha varies (0.02/0.03 vs 0.05 in Candlestick); Candlestick's light-mode candles use `#018a13`/`#e60d02` instead of the Figma `data-up/down` values its dark mode already matches; tooltip backgrounds vary (ECharts default, `#1e1e1e`-based in UnlocksTreemap, ink-based in Sankey) and should become surface tokens. The `--ld-chart-up/down/-alt` accents exist for exactly these fixes.

ECharts renders to canvas and cannot read `var()`: resolve tokens through [`src/components/ECharts/chartTheme.ts`](src/components/ECharts/chartTheme.ts) — `useChartTheme(isThemeDark)` in components, `getChartTheme(isDark)` in plain functions. Never read `--ld-chart-*` by hand and never reintroduce `isDark ? literal : literal` color forks; the per-chart-type configs still carrying them (Treemap, Candlestick, …) migrate to the hook during their page sweeps.

## Utility & reuse policy

- **Reuse lives in React components** (Card, Button, …), not in `@apply` composites. A component owns its class string in one place. [`src/ui/Card.tsx`](src/ui/Card.tsx) is the card surface — constrained `padding` variants, `className` for layout placement only; all new cards use it, existing cards migrate during page sweeps.
- `@utility` is allowed only for **small, flat, variant-free** declaration sets (a border color, a type style). No `@apply` chains with embedded `hover:`/`dark:` variants — that pattern re-emits its full body per variant and is why the legacy `dialog`/`pro-btn-*` utilities are quarantined, not multiplied.
- Prefer registered utilities (`bg-surface`) over arbitrary-value syntax (`bg-(--ld-bg-surface)`) in all new code.

## Do's and Don'ts

- Do rank text with the tier tokens; don't hardcode grays (`#666`, `#919296`).
- Do use `text-data-up/down` for movement; don't signal direction with color alone where it matters — pair with sign or arrow.
- Do flip modes via tokens; never write `dark:text-[#hex]`.
- Don't introduce a new token for a one-off value — either it maps to an existing semantic or it goes to design for a library decision first.
- Don't use `bg-surface-elevated-*` as page-level fills; they are for nested emphasis.
- Don't restate brand blue, premium gold, or any palette hex inline; if a needed token is missing, that's a design.md/library gap to raise, not a literal to paste.
- `bun run lint:tokens` enforces the above as a ratchet: existing debt is baselined in `scripts/design-token-baseline.json`, and the check fails only if hex-in-className, `dark:*-[#hex]`, arbitrary-font-size, or arbitrary-spacing counts increase. After removing debt, run with `--update` to lock in the improvement.

## Migration status

| Phase          | Scope                                                                                   | Status      |
| -------------- | --------------------------------------------------------------------------------------- | ----------- |
| Foundation     | Token foundation, legacy quarantine, chart tokens, Card/type ramp, `useChartTheme`      | merged      |
| Current branch | Home/chain plus shared primitives, route-family stabilization, and merge-readiness pass | in progress |
| After merge    | Token namespace cleanup, radius-scale codemods, broad typography/file-placement cleanup | deferred    |

Legacy namespaces (`--sub-*`, `--pro-*`, `--sl-*`, `--signin-*`, and the pre-refresh `--text-*`/`--bg-*`/`--cards-*` globals) are quarantined in `src/styles/legacy-*.css` / `tailwind.css`. Do not add new consumers; they are deleted as surfaces migrate.

**Excluded surfaces (owner decision, 2026-07-07; reconciled for merge):** ProDashboard, LlamaAI, yields, account/subscription, Downloads (incl. SQL/notebook tooling), Articles/research/authors/newsletters/reports surfaces, and investor-relations dashboard surfaces (`containers/Investors` / `pages/investors` dashboard products) are out of the sweep — separate products or upcoming rewrites. Their legacy-token debt is intentional. Raises/investor-like list pages remain in scope unless they are part of the investor-relations dashboard product. Shared components consumed by excluded surfaces still migrate; those surfaces pin legacy visuals through explicit compat props (`popoverVariant="legacy"`, `variant="pro"`), never by forking styles into page files.

### Open items with design

- Light-mode `Text/Warning` value; dark `bg-brand-transparent-subtle`.
- Rename `hover-neutral-normal` (it is brand-tinted in light, not neutral).
- Hover state for brand-tinted pills/segments: the frames define none, and `hover-neutral-normal` collides with `bg-brand-transparent` in light (same value). Code now stacks the wash via `.hover-wash`; library should publish a real state.
- Dark `Text/links` `#4b86db` is ~4.2:1 on `bg-brand-transparent` over `bg-surface` — below AA (4.5:1) at 12px. Ask: one step lighter (≈`#6a9be0`). Chain pills carry an interim local override (`--ld-text-link-on-tint`, dark `#6a9be0`); the segmented control's selected tab, active `MetricChip` option chips, and `MultiSelectCombobox` value pills still show the failing pair and inherit the fix when the library token moves (or adopt `text-link-on-tint` if it doesn't).
- `Text/tertiary` `#878787` is 3.6:1 on white — fails AA at 12px in **light** mode (dark passes at ~5.2:1). Ask: light value ≈`#6f6f6f`.
- `stroke-very-subtle` at 1px is invisible as a divider on dark surfaces; code floors dividers at `stroke-subtle` (see Divider floor above).
- Collapse `Text/branded` + `Text/links`; drop `Text/branded-2`.
- Fix `Brand/priamry-main` typo; remove stray SDS-library variables from page frames (chevron icons are bound to `--sds-color-border-default-default` — need a real token; using `text-tertiary` meanwhile).
- Publish full primitive ramps (the old in-file palette diverged from the library; the `--ld-primitive-scale-*` variables visible on the Tab Navigation component suggest they exist).
- Inter Display vs Inter var.
- Library hygiene found during extraction: radii bound to space variables (space-04/space-08) instead of corner-radius; `Mono/XL` font size bound to `space-24`; segmented-control instances disagree on unselected item sizing; promo-card body text set in "Inter Variable" instead of "Inter Display"; unlocks chart bars/chips bound to `Text/disabled`/`Text/tertiary` as fills; content gutter 12 vs 16 and toolbar control heights 24/26/32 vary between frames.
