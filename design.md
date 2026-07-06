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

### Borders (alpha-based — layer on any surface)

| Utility              | Light       | Dark        | Use                           |
| -------------------- | ----------- | ----------- | ----------------------------- |
| `border-very-subtle` | `#090b0c08` | `#ffffff08` | Faintest separation           |
| `border-subtle`      | `#090b0c0f` | `#ffffff0f` | Default hairlines             |
| `border-medium`      | `#090b0c1f` | `#ffffff1f` | Card borders, form controls   |
| `border-strong`      | `#090b0c82` | `#ffffff29` | High-emphasis outlines        |
| `border-brand`       | `#1f67d2`   | `#1f67d2`   | Focus, active, brand outlines |
| `border-divider`     | `#eeeeee`   | `#232628`   | Opaque dividers               |

### States & component tokens (CSS variables only, no utility yet)

| Variable             | Light       | Dark        | Use                                  |
| -------------------- | ----------- | ----------- | ------------------------------------ |
| `--ld-hover-brand`   | `#1f67d21f` | `#1f67d233` | Brand-tinted hover wash              |
| `--ld-hover-neutral` | `#090b0c08` | `#ffffff08` | Neutral hover wash (light value TBC) |
| `--ld-bg-screen-dim` | `#090b0c33` | `#090b0c33` | Backdrops                            |
| `--ld-chip-bg`       | `#dedede`   | `#232628`   | Filter chips                         |
| `--ld-chip-text`     | `#484848`   | `#c6c6c6`   | Filter chip text                     |

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
| `mono-sm`      | 12   | 400    | JetBrains Mono |
| `mono-sm-bold` | 12   | 700    | JetBrains Mono |

Sizes in the table are Figma px for reference; the utilities implement them in **rem** (px ÷ 16) so user browser font-size preferences are respected — same basis as Tailwind's built-in `text-*` scale. Line heights are **not** copied from Figma: each band ships one unitless ratio (`heading` 1.3, `label` 1.2, `body` 1.5, `mono` 1.35) and that's the end of it — no `leading-[…]`, no `tracking-[…]` one-offs, no pixel leading. Vertical rhythm belongs to containers (`gap`, `padding`, `min-h`), not to text metrics. (1px hairline borders and canvas chart fonts stay px on purpose.)

`label-*` (medium) carries single-line scannable text: table headers, nav, form labels, metadata. `body-*` (regular) is multi-line copy. `mono-*` sets numbers, addresses, and code — prefer it wherever figures must align. `label-md` and `body-sm` cover most UI text. Do not set arbitrary font sizes (`text-[10px]`) — the ramp includes 10px and 12px steps for exactly that use.

## Spacing, radius, borders

- **Spacing** is a 4px-based scale: 0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 56, 64, 80, 96 — i.e. the standard Tailwind scale; no arbitrary `p-[10px]` values.
- **Rhythm:** 8px inside a group, 16px between groups, 32–40px between sections. Default card padding 16px; 8–12px for dense/compact cards.
- **Border width** is 1px in almost all cases.
- **Layout is gap/padding/min-h driven.** Figma values for margins, absolute offsets, and per-element line heights are rendering artifacts of the design tool — do not transcribe them. Space siblings with flex/grid `gap`, size boxes with `padding` and `min-h`, and let text wrap naturally. Margins are reserved for opting out of a parent's rhythm (`mt-auto`, negative bleed), not for building it.

| Radius | Tailwind       | Use                               |
| ------ | -------------- | --------------------------------- |
| 6px    | `rounded-md`   | Small controls, inputs, buttons   |
| 8px    | `rounded-lg`   | Cards, panels, dialogs            |
| 12px   | `rounded-xl`   | Menus, popovers, large modals     |
| 9999px | `rounded-full` | Pills, avatars, circular controls |

One radius family per component type — don't mix radii within a view.

## Charts

Chart **series** colors come from `CHART_COLORS` + `getNDistinctColors` (golden-angle generator) in code — they are intentionally _not_ design tokens and must not be bulk-changed; the Figma library has no N-series concept.

Chart **chrome** (axis labels, gridlines, legend, dataZoom, PNG-export framing) uses the `--ld-chart-*` tokens in `semantics.css`. These are seeded with the exact pre-refresh literals and are deliberately decoupled from the text/border semantics so refactoring can never change chart rendering. The accent tokens (`--ld-chart-up/down/-alt`) are consumed only when a Figma frame explicitly restyles a specific chart, as part of that page's redesign PR.

**Chart consistency debt** (visual changes, scheduled for page sweeps — never as refactoring side effects): axis label color varies per chart (`ink(1)` in shared defaults, `ink(0.8)` in HBar/Scatter/Netflow, `ink(0.6)` on Candlestick's secondary axis) and should converge on one token — per the Figma frames, likely tertiary gray rather than full black/white; gridline alpha varies (0.02/0.03 vs 0.05 in Candlestick); Candlestick's light-mode candles use `#018a13`/`#e60d02` instead of the Figma `data-up/down` values its dark mode already matches; tooltip backgrounds vary (ECharts default, `#1e1e1e`-based in UnlocksTreemap, ink-based in Sankey) and should become surface tokens. The `--ld-chart-up/down/-alt` accents exist for exactly these fixes.

ECharts renders to canvas and cannot read `var()`: resolve tokens through [`src/components/ECharts/chartTheme.ts`](src/components/ECharts/chartTheme.ts) — `useChartTheme(isThemeDark)` in components, `getChartTheme(isDark)` in plain functions. Never read `--ld-chart-*` by hand and never reintroduce `isDark ? literal : literal` color forks; the per-chart-type configs still carrying them (Treemap, Candlestick, …) migrate to the hook during their page sweeps.

## Utility & reuse policy

- **Reuse lives in React components** (Card, Button, …), not in `@apply` composites. A component owns its class string in one place. [`src/components/Card.tsx`](src/components/Card.tsx) is the card surface — constrained `padding` variants, `className` for layout placement only; all new cards use it, existing cards migrate during page sweeps.
- `@utility` is allowed only for **small, flat, variant-free** declaration sets (a border color, a type style). No `@apply` chains with embedded `hover:`/`dark:` variants — that pattern re-emits its full body per variant and is why the legacy `dialog`/`pro-btn-*` utilities are quarantined, not multiplied.
- Prefer registered utilities (`bg-surface`) over arbitrary-value syntax (`bg-(--ld-bg-surface)`) in all new code.

## Do's and Don'ts

- Do rank text with the tier tokens; don't hardcode grays (`#666`, `#919296`).
- Do use `text-data-up/down` for movement; don't signal direction with color alone where it matters — pair with sign or arrow.
- Do flip modes via tokens; never write `dark:text-[#hex]`.
- Don't introduce a new token for a one-off value — either it maps to an existing semantic or it goes to design for a library decision first.
- Don't use `bg-surface-elevated-*` as page-level fills; they are for nested emphasis.
- Don't restate brand blue, premium gold, or any palette hex inline; if a needed token is missing, that's a design.md/library gap to raise, not a literal to paste.
- `bun run lint:tokens` enforces the above as a ratchet: existing debt is baselined in `scripts/design-token-baseline.json`, and the check fails only if hex-in-className, `dark:*-[#hex]`, or arbitrary-font-size counts increase. After removing debt, run with `--update` to lock in the improvement.

## Migration status

| Phase | Scope                                                                                 | Status  |
| ----- | ------------------------------------------------------------------------------------- | ------- |
| PR 1  | Token foundation, legacy quarantine, chart tokens, this doc                           | open    |
| PR 2  | Legacy vars re-pointed at semantics (global re-skin) — gated on font + success/error  | pending |
| PR 3  | Card primitive, type-ramp utilities, `useChartTheme`, lint guardrails                 | this PR |
| PR 4+ | Page sweeps vs Figma frames: home/chain → metrics → protocol → tvl → unlocks → rights | pending |

Legacy namespaces (`--sub-*`, `--pro-*`, `--sl-*`, `--signin-*`, and the pre-refresh `--text-*`/`--bg-*`/`--cards-*` globals) are quarantined in `src/styles/legacy-*.css` / `tailwind.css`. Do not add new consumers; they are deleted as surfaces migrate.

### Open items with design

- Light-mode `Text/Warning` value; dark `bg-brand-transparent-subtle`; light `hover-neutral-subtle`.
- Rename `hover-neutral-normal` (it is brand-tinted, not neutral).
- Collapse `Text/branded` + `Text/links`; drop `Text/branded-2`.
- Fix `Brand/priamry-main` typo; remove stray SDS-library variables from page frames.
- Publish full primitive ramps (the old in-file palette diverged from the library).
- Inter Display vs Inter var.
