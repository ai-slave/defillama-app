# Design system

DefiLlama is a data-dense analytics UI: near-neutral surfaces, restrained color, tight radii, small type. Color signals **state and data direction** (up/down, brand, warning), never decoration. Hierarchy comes from surface elevation and text tiers, not shadows.

The design system is the code: the tokens in [`src/styles/primitives.css`](src/styles/primitives.css) and [`src/styles/semantics.css`](src/styles/semantics.css), the components in `src/ui`, and the rules in this file. If this file and those files disagree, the files win; fix this file.

The system is not frozen. When a new pattern, a new requirement or a clearly better experience shows up, change it: update the token or component and its rule here in the same PR, so the next page builds on the new version. No outside design file is a source of intent; decide from hierarchy, legibility and how the live product reads.

> **Note:** this file is excluded from Tailwind's source scanning (`@source not` in `src/tailwind.css`) so the class names mentioned here never generate CSS. Keep it that way.

## Where code and classes live

Tokens come in three tiers, and components use only tier 2 and tier 3:

1. **Primitives** (`src/styles/primitives.css`): the generated color ramps (`--blue-1` … `--blue-12`, see [Color ramps](#color-ramps)) and `--neutral-500`, the scrollbar thumb, fixed in both modes. Components never use them. They are not registered as Tailwind colors, because names like `blue` and `neutral` would override Tailwind's own palettes.
2. **Semantics** (`src/styles/semantics.css`): role tokens such as `--bg-surface` and `--text-data-up`, light values on `:root` and dark values under `html.dark`, registered as utilities (`bg-surface`, `text-primary`, `border-subtle`).
3. **Domain tokens**: only when a value differs from every semantic, such as the Yields text accents in `src/tailwind.css`. A token that would alias a semantic binds the semantic instead.

The mode lives in the selector, never in the token name: no `*-light`/`*-dark` pairs and no `dark:*-[#hex]` utilities.

`src/tailwind.css` sets `color-scheme` from the mode on `html` and `.theme-dark`, so everything the browser draws itself (the page scrollbar, date pickers, select lists, checkboxes, autofill) follows it. Never add `scheme-dark` or a filter to a single field (`per-field-color-scheme`).

Component code has three homes, chosen by ownership:

- **`src/ui/`**: design-system parts. Token-bound, no data fetching, no product knowledge.
- **`src/components/`**: shared application components used by two or more products. Folders are named for their domain (`ChartExport/`, `Search/`), never for a technique or an era.
- **`src/containers/<Product>/`**: product-owned code. A component one product uses lives with that product, even when it looks generic.
- When a shared component loses its second consumer, move it to the remaining product. Leave no re-export shim at the old path.

Class composition:

- Visual contracts live in recipe components and house variant maps (Button's const maps by `variant` and `size`). Do not add cva. A recipe's class builder stays private to `src/ui`: a host that needs the look renders the component (`as`, or Ariakit's `render`), so it also gets the recipe's disabled, pending and focus behavior.
- Tag an exported class-string recipe with [`tw`](src/ui/tw.ts) so the formatter sorts it; interpolation inside `tw` is a type error on purpose.
- Compose conditional classes with `clsx`. Once a template literal holds two ternaries, hoist the branches into a const map.
- Never add `tailwind-merge` or `cnfast`. A merge utility lets an override win silently, which turns a recipe violation into a working fork.
- `className` on a recipe component is placement only (margin, width, flex and grid placement), never color, padding, radius or type.
- A layout default that callers are meant to change (Skeleton's radius, a status shell's minimum height) takes the `initial:` variant from `src/tailwind.css`, so the caller's class wins whatever order Tailwind emits them in. Never test a caller's `className` with a regex to drop a default. Colors, type and padding never go behind `initial:`: a different look is a new variant.
- Reuse lives in React components, not `@apply` composites.
- `@utility` holds only small, flat, variant-free declaration sets, such as a border color or a type style. No `@apply` chains with `hover:` or `dark:` inside: each variant re-emits the whole body.
- Prefer a registered utility (`bg-surface`) over an arbitrary value (`bg-(--bg-surface)`).

## Tokens

`semantics.css` owns every value; these tables say when to use each utility.

| Background                                                     | Use                                                                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-page`                                                      | Page background                                                                                                                                                                                |
| `bg-surface`                                                   | Cards and panels                                                                                                                                                                               |
| `bg-surface-elevated-1`                                        | Nested emphasis inside a surface; canvas dialogs and sheets whose body is `bg-surface` cards                                                                                                   |
| `bg-surface-elevated-2`                                        | Second elevation step                                                                                                                                                                          |
| `bg-overlay`                                                   | Popovers, menus, tooltips, content dialogs, toasts                                                                                                                                             |
| `bg-brand`                                                     | Primary actions and brand fills                                                                                                                                                                |
| `bg-brand-muted`                                               | Selected states (blue step 4); takes no hover wash                                                                                                                                             |
| `bg-brand-faint`                                               | Lightest brand wash (blue step 2)                                                                                                                                                              |
| `bg-{role}-faint` / `bg-{role}-tint` / `bg-{role}-tint-strong` | Tints on ramp steps 2, 3 and 4 for `brand`, `error`, `warning`, `success`, `data-up`, `data-down`: banners, badges, soft buttons; a tinted control rests on `tint` and hovers to `tint-strong` |
| `bg-disabled`                                                  | A disabled filled control or field                                                                                                                                                             |
| `bg-skeleton`                                                  | A loading placeholder (`Skeleton`); 1.35:1 against a card in both modes                                                                                                                        |
| `bg-knob`                                                      | A switch knob, white on either track in both modes                                                                                                                                             |
| `bg-status-dot` / `-muted`                                     | A neutral status dot and its quieter twin; never a text tier as a fill                                                                                                                         |
| `bg-page-glass` / `bg-surface-glass`                           | A frosted sticky bar over scrolling content, with `backdrop-blur`                                                                                                                              |
| `bg-veil`                                                      | A veil over content that is loading                                                                                                                                                            |
| `bg-on-brand-control` / `-hover`                               | A control sitting on the brand-blue header                                                                                                                                                     |
| `bg-screen-dim`                                                | Dialog and drawer backdrops                                                                                                                                                                    |
| `bg-equity-logo`                                               | Fixed light canvas behind company logos, in both modes                                                                                                                                         |

| Text                              | Use                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `text-primary`                    | Main text                                                                                     |
| `text-secondary`                  | Supporting text and resting interactive text                                                  |
| `text-tertiary`                   | Qualifiers: units, suffixes, timestamps, counts, placeholders, empty and missing values       |
| `text-disabled`                   | Disabled controls only                                                                        |
| `text-link`                       | Links, selected labels on `bg-brand-muted`, active sort carets                                |
| `text-on-brand`                   | Text on `bg-brand`                                                                            |
| `text-data-up` / `text-data-down` | Positive and negative movement                                                                |
| `text-warning`                    | Warnings                                                                                      |
| `text-error` / `text-success`     | Errors and successes: failed requests and actions, validation, destructive rows, done actions |
| `text-verified`                   | The verified mark on yields                                                                   |

| Border                                         | Use                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `border-very-subtle`                           | Faint separation wider than a hairline; never a 1px divider                                 |
| `border-subtle`                                | Card and panel outlines, row and section dividers                                           |
| `border-medium`                                | Controls, inputs, overlays, chips and badges; never page cards or dividers                  |
| `border-strong`                                | High-emphasis outlines, unchecked checkboxes and a hovered field                            |
| `border-brand`                                 | Focus, active and brand outlines                                                            |
| `border-{role}-muted` / `border-{role}-strong` | Hued borders on ramp steps 7 and 8; a destructive control's outline is `border-error-muted` |
| `border-disabled`                              | A disabled outlined control or field                                                        |

| State                                | Use                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `hover:bg-hover-row`                 | Hover on a transparent element: popover, menu and table rows, ghost buttons        |
| `hover-wash`                         | Hover and focus wash over a tinted or opaque resting background                    |
| `hover-wash-card`                    | The fainter wash for interactive cards                                             |
| `group-hover-wash`                   | Row hover on a cell that keeps an opaque background, such as a sticky table column |
| `focus-ring` / `focus-ring-on-brand` | Focus for Ariakit virtual focus and for solid brand fills                          |

Elevation is picked by how far a surface sits from the page, not by how much shadow looks right. If two surfaces overlap, the one on top takes the higher level; a surface that overlaps nothing is never `overlay` or `dialog`.

| Level   | Shadow           | Use                                                                                                |
| ------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| none    | —                | Cards, panels, buttons and everything in the page flow; hover uses `hover-wash-card`, never a lift |
| raised  | `shadow-raised`  | In the flow but distinct: a switch knob, a sticky table header, a hero card on a marketing landing |
| overlay | `shadow-overlay` | Floats over nearby content: menus, popovers, tooltips, hovercards, floating toolbars and buttons   |
| dialog  | `shadow-dialog`  | Over the whole UI: dialogs, sheets, modals, full-screen overlays                                   |

- Each token carries its own dark value, so never add a `dark:` shadow fork. Stock Tailwind shadows (`shadow`, `shadow-sm` … `shadow-2xl`, `shadow-inner`) are not used (`stock-shadow`).
- A floating surface takes `bg-overlay` with `shadow-overlay`. In dark mode its lighter fill and border carry the lift, and the shadow deepens so a menu still separates from a busy chart under it. Dark mode never gets more shadowed surfaces than light.
- Shadow is depth, never a border substitute: an in-flow card keeps its translucent border and no shadow, because a shadow on every card in a dense grid reads as grey haze. A control laid over an image, a gradient or a coloured bar takes a translucent border token (or none) with `shadow-raised`, never a solid grey border, which turns muddy on colour.
- Product glows (Research, LlamaAI gold, Subscription, investor accents) are accents in their theme files, not elevation.

Usage rules:

- Surfaces step `page → surface → elevated-1 → elevated-2`. Cards sit on `bg-surface`; elevation steps are for nested emphasis, never page-level fills.
- Floating overlays use `bg-overlay`, not a ladder step: light mode carries their elevation with shadow, dark mode mainly with surface lift.
- Text tiers are text-only: never `bg-primary`.
- Use solid colors for text, fills and tints, translucent ones for neutral borders, dividers, hover washes, glass, veils and seams. Translucency lives in a token; never put a `/NN` opacity modifier on a color utility (`opacity-color-modifier`): use the ramp step for that role.
- The `opacity` utility is for imagery, decoration and show/hide motion, never for text or a control's state. Dimmed text takes the next text tier. A disabled control takes `text-disabled`, plus `bg-disabled` when filled and `border-disabled` when outlined, in every variant (`disabled-opacity`). Only a disabled composite whose children carry their own colors or imagery (an avatar picker, a logo row, a dataset card) keeps `opacity-60` on the whole.
- Movement uses `text-data-up`/`text-data-down` through `Change` (`src/ui/Change.tsx`), which also owns the sign and the format; zero is neutral. Never colour a movement by hand (`hand-coloured-change`). A price drop is never `text-error`, and an error is never `text-data-down`: the two share a hue, not a meaning.
- Brand blue and every other palette value come only from tokens, never from a literal.
- `bg-brand` is a fill. Blue text is `text-link`, never `text-brand`, which fails AA in dark mode (`brand-fill-as-text`).
- Do not add a token for a one-off value. When a role is missing, add it to `semantics.css` with its rule here.

Text tiers: if removing the text would change what the reader knows or can do, it is `text-secondary` or above; if it only qualifies something beside it, it is `text-tertiary`.

- Enabled interactive text never rests on tertiary: rest `text-secondary`, hover and focus `text-primary`, active branded.
- In a metric line the value sits one tier above its qualifier: `$311.138b` secondary, `7d` tertiary. Qualifiers are bare spans, never parenthesized text inside the value string.
- `text-disabled` is for disabled controls only, never metadata, symbols, empty values or helper copy.

Hover has two mechanisms, picked by the resting background:

- `hover:bg-hover-row` replaces the background, so it goes only on elements that rest transparent.
- `hover-wash` stacks the wash over the resting color and skips disabled and selected elements (`data-active`, `aria-selected`, `aria-pressed`), so it goes on anything opaque. Never put `hover:bg-hover-row` on `bg-brand-muted`: it replaces the tint.
- A control's hover, focus and pressed states come from its own hue. Neutral controls take the neutral wash; a tinted control rests on `bg-{role}-tint` and hovers to `bg-{role}-tint-strong`; destructive buttons and menu rows hover with `bg-error-tint`; a brand-outlined control (`outline`, `filter`) hovers to `bg-brand-tint`; a selected control sits on `bg-brand-muted` and takes no wash. Brand blue never hovers a neutral control.
- Pressed (`active:`) is one step past hover, with no transition so a quick tap still shows it: the neutral wash deepens to `bg-pressed-row` (`hover-wash` does this itself), a hued control goes to its step-5 `bg-{role}-tint-pressed`, and a solid fill darkens. Touch screens have no hover, so pressed is the only feedback a tap gets. Never scale or move a control on press: one shared look beats per-page motion. Every control that looks like a button has it: Button, select triggers, nav links, segments and toggles. A control that hovers by swapping its fill to the last step takes `press-wash`, the pressed wash stacked over that fill. Menu, picker and list rows take none: the press closes the menu or flips the row's check, and that is the feedback.
- A trigger resting on `bg-surface-elevated-1` may hover to `bg-surface-elevated-2` instead. Never combine that step with a wash.
- Tailwind's `hover:` only applies under `@media (hover: hover)`, so a tap never leaves a hover state behind. A hand-written `:hover` rule in CSS goes inside the same media query, as `hover-wash` does; its `:focus-visible` and `:active` rules stay outside it (`ungated-hover`).

Focus and selection:

- One global `:focus-visible` rule in `src/tailwind.css` draws a 2px inset `border-brand` ring on everything, inset so it survives full-bleed rows and dense toolbars. Never add a ring per call site.
- Ariakit composite rows (selects, comboboxes) bind `data-focus-visible:focus-ring`, because DOM focus stays on the input. Never bind it to `data-active-item`, which follows the mouse.
- Solid brand fills, and controls resting on one (an unpin ✕ in the active nav row), use `focus-visible:focus-ring-on-brand`, because a brand ring is invisible there.
- Remove the ring with `outline-hidden` only on an element with its own focus indicator, such as `Input` (`focus:border-brand`).
- Active is branded: selection shows with brand tint, solid or border plus link-blue text, never with grays.

Partner and border colors:

- A partner's brand color travels with its data. Set it as a CSS variable on the element (`style={{ '--card-accent': brandColor }}`) and derive its translucent variants once with `color-mix` in one shared class (`.ir-card-accent` in `src/styles/themes/pro.css`), read as `hover:border-(--card-accent-border)`, as `src/pages/investors.tsx` does. Never a `/NN` modifier on the variable. It becomes a product-theme token only when it must change between modes, like `--sl-kpk-mint` in `src/styles/themes/pro.css`.
- Every width-only border or divide utility (`border`, `border-t`, `divide-y`) needs a color source, or it renders `currentColor`, near-white in dark mode (`implicit-border-color`).

## Color ramps

Every color role comes from a 12-step ramp per hue: neutral, blue (brand), emerald (up, success), crimson (down, error), amber (warning) and violet. [`scripts/generate-color-ramps.mjs`](scripts/generate-color-ramps.mjs) solves each step in OKLCH so it has the same WCAG contrast against the canvas in every hue, then writes hex into `primitives.css`, light on `:root` and dark under `html.dark`. Edit the generator's inputs and rerun it; never hand-edit the generated hex. The neutral surfaces and the brand fill are pinned to their shipped values.

| Step | Role                                   | Step | Role                         |
| ---- | -------------------------------------- | ---- | ---------------------------- |
| 1–2  | Page, surface and elevated panel       | 7–8  | Border and strong border     |
| 3    | Hover and tint (banners, soft buttons) | 9    | Solid fill (white text)      |
| 4    | Selected tint, hover on a tint         | 10   | Solid fill hover             |
| 5    | Pressed                                | 11   | Colored text                 |
| 6    | Divider                                | 12   | High-contrast text on a tint |

- Because steps line up across hues, the pairs are guaranteed: step 11 text passes AA on steps 1–4 of any hue, and white text passes on every step 9.
- A semantic token maps to a step once (`--text-link: var(--blue-11)`) and needs no dark override: the ramp flips with the mode.
- A tinted control uses its hue's steps: rest on 3, hover on 4, text on 11, border on 7. That is how `ProButton`, the row-link pills and the destructive states are built.
- Disabled controls sit on the neutral ramp: `bg-disabled` is step 3, `border-disabled` step 5 and `text-disabled` step 8. Disabled text is exempt from AA; it has to read as unavailable, not pass.
- Colors ship as hex, so browsers, chart canvases and exports render the same value.

### Always-dark surfaces

A surface that keeps its dark look in light mode (the Sheets landing) sets `theme-dark` on its root. Its subtree then resolves every ramp step, semantic token and `dark:` variant to its dark value in either mode, so `text-link`, the text tiers, borders and controls inside it keep their contrast.

- Never paint a fixed dark fill (a `sub-dark-*` token, LlamaAI ink, `bg-black`, a dark hex) under theme-aware tokens without the scope: in light mode the text takes its light value on the dark fill. `fixed-dark-fill` counts these fills, so a new one fails until the root is scoped and the baseline updated.
- Inside the scope, use the core tokens (`text-tertiary`, `text-link`, `Button`), not a product's fixed grays.
- LlamaAI's image lightbox stays on its own mode-invariant ink tokens with `ai-white` text (`src/styles/themes/llamaai.css`); it needs no scope.

## Typography

Named styles live in [`src/styles/typography.css`](src/styles/typography.css). Each one owns its size, weight, line height and family. Sizes are rem, so the reader's browser font size applies.

| Style                                                      | Size (px)          | Weight | Use                                                                |
| ---------------------------------------------------------- | ------------------ | ------ | ------------------------------------------------------------------ |
| `heading-lg`, `heading-sm`, `heading-xs`                   | 32, 20, 18         | 600    | Page and section headings                                          |
| `title-lg`, `title-md`, `title-sm`                         | 16, 14, 12         | 600    | The lead of a block: a card name, a hovercard header, a total      |
| `table-header`                                             | 14                 | 500    | Table headers                                                      |
| `label-xl`, `label-lg`, `label-md`, `label-sm`, `label-xs` | 18, 16, 14, 12, 10 | 500    | Single-line scannable text: controls, nav, form labels, metadata   |
| `body-xl`, `body-lg`, `body-md`, `body-sm`, `body-xs`      | 18, 16, 14, 12, 10 | 400    | Multi-line copy                                                    |
| `mono-xl`, `mono-lg`                                       | 24, 20             | 700    | Headline values                                                    |
| `mono-md-bold`, `mono-sm-bold`                             | 14, 12             | 700    | The number a block exists to show, such as a Key Metrics row value |
| `mono-md`, `mono-sm`                                       | 14, 12             | 400    | Other summary values, code, addresses, hashes                      |

`mono-*` is JetBrains Mono; every other style is Inter. The families are Tailwind's `--font-mono` and `--font-sans`, so the app has one name for each.

- Use sentence case for UI text: titles, headings, tabs, buttons, menu items, labels and tooltips capitalize only the first word and proper nouns ("Delete project"). Brands, products and named features keep their capitals (LlamaAI, Pro, External Data Balance), and so do third-party button names ("Add to Slack").
- Metric and column names keep their spelling ("Total Value Locked", "DEX Volume (24h)"), because the same names head CSV exports and feed search; the sentence around one still follows sentence case. Names from data show as the data spells them.
- Interactive text (buttons, pills, selects, menu rows) is 12px minimum. Card body and data rows are 14px. 10px (`label-xs`, `body-xs`) is only for non-interactive metadata, such as eyebrow headers and count badges.
- Mono is never used in table cells. It sets only headline and summary values (Key Metrics, summary cards, stat strips, `HeroMetric`) and code, addresses and hashes.
- Words are always Inter, even inside a mono value: a unit or an annotation beside a mono number takes a named Inter style, and a number inside a sentence follows the sentence.
- Mono has two weights: 400 for figures and 700 for the number a block exists to show; never 500, 600 or 800 (`off-scale-mono-weight`).
- Mono text takes a `mono-*` style, never a bare `font-mono`: the family alone inherits whatever size, weight and line height surrounds it, which is how a value drifts from the row beside it (`raw-mono-family`). Code, a path or a handle inside a sentence takes the mono style at the sentence's size (`mono-sm` in `body-sm`).
- `title-*` never goes on a button; buttons use the Button recipe's `label-*`.
- Table headers use `table-header`, and cells inherit 14px Inter. An entity name in a cell is `label-md`, plus `text-link hover:underline` when it has a page.
- Text takes a named style, never a raw size (`text-sm`, `text-[11px]`) alone or with a weight (`raw-type-size`, `raw-type-pair`). Pick the style by role, not by nearest pixel:
  - One-line text on a button, tab, disclosure or form label is `label-*`; a hint or description inside the control stays `body-*`.
  - A number a block exists to show (a KPI, a balance, a headline price on a product page) is `mono-*`.
  - A heading stays clearly larger or heavier than the text it introduces. When the nearest step would flatten that, take the step that keeps it, even two steps away.
- Product pages use the ramp strictly. Marketing landings and editorial pages keep display type: a class set with text 18px or larger at any breakpoint keeps its own sizes at every breakpoint, since they are one headline, on `/ai`, `/investors`, `/mcp`, `/verified`, `/newsletters`, `/sheets`, the research landing, author pages, and an article's title and dek. Their smaller text follows the ramp, and the type rules skip only those display class sets. The list lives in `LANDING_DISPLAY` in the token check.
- Article bodies are styled by the typography plugin's `prose-*` variants, and a field recipe sizes its own placeholder; the check skips both.
- The ramp grows by need, not by page: when three or more product places need a size no step fits, add a named style to `typography.css` and the table above in the same PR. Never add a one-off size, and never move one into an inline `style`, which the check cannot see and which cannot change at a breakpoint.
- Never combine a named style with another named style, or with a conflicting `text-*`, `font-*` or `leading-*` utility, in the same variant scope (`conflicting-named-typography`).
- Only the styles in the table exist; any other `heading-*`, `title-*`, `label-*`, `body-*` or `mono-*` class renders unstyled (`unknown-named-typography`).
- Never set an arbitrary font size, `leading-[…]` or `tracking-[…]` (`arbitrary-font-size`); vertical rhythm belongs to containers.
- `tabular-nums` is for numbers that change on screen (timers, countdowns, live counters) and for end-aligned table columns, where the shared table renderers add it so sorted digits line up. Other static numbers stay proportional.
- End UI copy with the ellipsis character "…", never three dots (`ascii-ellipsis`).

## Spacing and radius

Spacing is Tailwind's 4px-based scale; never an arbitrary value such as `p-[10px]` (`arbitrary-spacing`).

| Role                                    | Tailwind                  |
| --------------------------------------- | ------------------------- |
| Icon to text inside a control           | `gap-1` (tight `gap-0.5`) |
| Dense control cluster                   | `gap-1.5`                 |
| Between toolbar groups                  | `gap-2`                   |
| Between cards, panels and tables        | `gap-2`                   |
| Dense card padding                      | `p-2`                     |
| Directory card padding, prose internals | `p-3`, `gap-3`            |
| Roomy card or panel padding             | `p-4`                     |
| Panel header                            | `px-4 py-3`               |
| Toolbar above a chart / a table         | `px-2 pt-2 pb-0` / `p-2`  |
| Popover and menu row                    | `px-3 py-2`               |
| Card sections                           | `gap-6`                   |

- Layout is gap, padding and `min-h` driven. Space siblings with flex or grid `gap`, size boxes with padding and `min-h`, and let text wrap. Margins only opt out of a parent's rhythm (`mt-auto`, a negative bleed).
- Responsive spacing picks both ends from the palette (`gap-2 lg:gap-4`), never a fluid in-between value: this is a density-first app, so big screens get more data, not bigger chrome.
- Dividers are 1px with `border-subtle` as the minimum; `border-very-subtle` is invisible at 1px.
- Nested scroll containers get the compact scrollbar globally from `src/tailwind.css`. Never add a local thin-scrollbar class (`explicit-thin-scrollbar`); use `scrollbar-none` only for a track that must hide its scrollbar, such as a swipeable chip row.

| Radius | Tailwind       | Use                                          |
| ------ | -------------- | -------------------------------------------- |
| 4px    | `rounded-sm`   | Chain pills, small chips                     |
| 6px    | `rounded-md`   | `sm` buttons, joined toggle groups, tooltips |
| 8px    | `rounded-lg`   | Cards, panels, inputs, `md` buttons          |
| 12px   | `rounded-xl`   | Popovers, menus, dialogs, hovercards         |
| full   | `rounded-full` | Filter pills, avatars, round icon buttons    |

- Use one radius per component type and never mix radii within a view.
- 8px and 12px are `rounded-lg` and `rounded-xl`, never an arbitrary value (`arbitrary-standard-radius`).
- A component that needs another radius exposes it as a variant (`Card radius="large"`), never a page-local `rounded-*`.
- A rounded box nested in a rounded box takes the outer radius minus the padding between them, so the two curves stay parallel: `SegmentedControl`'s 8px track with 2px padding holds 6px items. When the result falls off the scale, round the inner box down, never the outer one up.

Control heights come from one scale: 24px small (`sm`), 32px default (`md`), 44px inside a phone sheet's rows, 56px dialog headers.

- Sheet rows (`DialogBody`, `DialogToolbar`, `DialogFooter`, a drawer's search) carry `data-sheet`, and the shared recipes take their 44px floor there through the `sheet:` variant, which applies only below `sm`.
- Page and toolbar controls stay 32px on phones, so a toolbar row never mixes heights.
- On touch screens every Button, select trigger and segment carries `touch-target`, an invisible 44px hit area that leaves the look unchanged.
- Never pin `h-*` or `size-*` on a control (`dialog-button-pinned-height`), and never put an `sm` control beside `md` ones.

## Which component for which job

Each component's header comment holds its own rules. Read it before using the component.

| Job                                                                         | Use                                                                                                                                                                                                                                                                                                      | File                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Any action button                                                           | `Button` (`variant`; `size` is required)                                                                                                                                                                                                                                                                 | `src/ui/Button.tsx`                                                  |
| An internal link, menu trigger or tooltip anchor styled as a button         | `<Button as={BasicLink}>`; on an Ariakit host or `Tooltip`, `render={<Button size="md" />}`                                                                                                                                                                                                              | `src/ui/Button.tsx`                                                  |
| A command plus a menu that changes it                                       | `ButtonGroup`                                                                                                                                                                                                                                                                                            | `src/ui/Button.tsx`                                                  |
| An external link styled as a button                                         | `ExternalLinkButton`; several URLs: `Menu isExternal`                                                                                                                                                                                                                                                    | `src/components/ExternalLinkButton.tsx`, `src/components/Menu.tsx`   |
| Pick a value that reconfigures one region                                   | `SegmentedControl`; a longer pick on its own row: `variant="chips"`                                                                                                                                                                                                                                      | `src/ui/SegmentedControl.tsx`                                        |
| Pick which pane fills a phone screen                                        | `SegmentedControl` (a radio: on desktop both panes show)                                                                                                                                                                                                                                                 | `src/ui/SegmentedControl.tsx`                                        |
| Switch panels in a card, panel, dialog or toolbar header                    | `SegmentedControl semantics="tabs"` inside `Tabs` / `TabPanel`                                                                                                                                                                                                                                           | `src/ui/SegmentedControl.tsx`, `src/ui/Tabs.tsx`                     |
| Switch panels that head a page section                                      | `ViewTabs` (underline) inside `Tabs` / `TabPanel`                                                                                                                                                                                                                                                        | `src/components/ViewTabs.tsx`, `src/ui/Tab.tsx`                      |
| Navigate between pages with tabs                                            | `TabLink` + `tabTrackStyles` in a `<nav aria-label>`, `aria-current="page"`                                                                                                                                                                                                                              | `src/ui/Tab.tsx`                                                     |
| A row in a side nav, table of contents or criteria rail                     | `RailItem` (`active`); the caller keeps `aria-current`                                                                                                                                                                                                                                                   | `src/ui/RailItem.tsx`                                                |
| A row in a dialog or panel list that picks or opens one item                | `ListRow` (`selected`); popover and menu rows use `src/ui/Popover.ts`                                                                                                                                                                                                                                    | `src/ui/ListRow.tsx`                                                 |
| An explicit scope switch                                                    | `SegmentedControl` / `TagGroup` `variant="solid"`                                                                                                                                                                                                                                                        | `src/ui/SegmentedControl.tsx`                                        |
| Switch workspaces beside a primary action (Chat \| Terminal)                | `SegmentedControl variant="mode"` (neutral selection)                                                                                                                                                                                                                                                    | `src/ui/SegmentedControl.tsx`                                        |
| A filter pill or a removable active filter                                  | `Button variant="filter" size="sm"` with `data-active`                                                                                                                                                                                                                                                   | `src/ui/Button.tsx`                                                  |
| A pill that runs or inserts something (a suggestion, a search topic)        | `Button variant="secondary" size="sm"`, no active state                                                                                                                                                                                                                                                  | `src/ui/Button.tsx`                                                  |
| A control floating over scrolling content (rail scroll arrows)              | `Button variant="overlay"`, an icon-only square with a Tooltip                                                                                                                                                                                                                                           | `src/ui/Button.tsx`                                                  |
| A control pinned over page content, always visible                          | `Button variant="floating"` (opaque, bordered, menu shadow)                                                                                                                                                                                                                                              | `src/ui/Button.tsx`                                                  |
| A control laid over an image, a video or a dark scrim                       | `Button variant="onMedia"` (round when square); a frosted toolbar over the picture holds plain round buttons                                                                                                                                                                                             | `src/ui/Button.tsx`                                                  |
| A control on the brand-blue mobile header                                   | `Button variant="onBrand" size="lg" square` plus Tooltip                                                                                                                                                                                                                                                 | `src/ui/Button.tsx`                                                  |
| A pill that turns a list filter on or off                                   | `Button variant="toggle"` with `data-active`, sized to its row (sm among chips, md among md controls)                                                                                                                                                                                                    | `src/ui/Button.tsx`                                                  |
| A toggle pill that shows its state with an icon                             | `Button variant="toggle" stateIcon` with `data-active`: Button draws plus or check in one slot, so picking never changes the width                                                                                                                                                                       | `src/ui/Button.tsx`                                                  |
| A button that confirms its action in its label (Copy → Copied)              | `Button doneLabel="Copied" done={copied}`: both labels share one grid cell, so the width never changes                                                                                                                                                                                                   | `src/ui/Button.tsx`                                                  |
| A button whose label switches with a mode (Edit ↔ Done, Show ↔ Hide)        | `<StableLabel labels={…} current={…} />` as its children: every label keeps its place, so the width never changes                                                                                                                                                                                        | `src/ui/Button.tsx`                                                  |
| A text action inside a sentence or aligned to a text edge                   | `Button variant="link"` (no size; never a padded button with a negative margin)                                                                                                                                                                                                                          | `src/ui/Button.tsx`                                                  |
| An icon-only delete in a dense row (data is lost)                           | `Button variant="ghostDestructive" square` plus Tooltip, sized to its row                                                                                                                                                                                                                                | `src/ui/Button.tsx`                                                  |
| A standalone full-width conversion CTA                                      | `Button size="lg"`; beside an input it stays md                                                                                                                                                                                                                                                          | `src/ui/Button.tsx`                                                  |
| A product palette on a control                                              | A token scope that re-points the brand tokens (`.sub-api-accent`), never a Button variant                                                                                                                                                                                                                | `src/styles/themes/`                                                 |
| Chart metric or series chips                                                | `metricChipStyles`, `metricOptionChipStyles`, `metricSeriesToggleStyles`                                                                                                                                                                                                                                 | `src/ui/MetricChip.tsx`                                              |
| A promo pill: New, Try free, Free, Pro                                      | `PromoBadge` (`promoBadgeStyles` on a link or an A/B-gated pill)                                                                                                                                                                                                                                         | `src/ui/PromoBadge.tsx`                                              |
| A state: Live, Paused, Available, Partial, Failed                           | `StatusBadge` with `status` good, caution, bad or neutral; the product maps its value to a status, never to classes (`statusBadgeStyles` on a button or link)                                                                                                                                            | `src/ui/StatusBadge.tsx`                                             |
| The count in a picker or dialog trigger                                     | `CountBadge`                                                                                                                                                                                                                                                                                             | `src/ui/CountBadge.tsx`                                              |
| A row of link pills with overflow                                           | `LinksWithDropdown`                                                                                                                                                                                                                                                                                      | `src/components/RowLinksWithDropdown/LinksWithDropdown.tsx`          |
| Pick from a short list                                                      | `Select`                                                                                                                                                                                                                                                                                                 | `src/components/Select/Select.tsx`                                   |
| Searchable or multi pick                                                    | `SelectWithCombobox` (`isSearchable` decides the search field)                                                                                                                                                                                                                                           | `src/components/Select/SelectWithCombobox.tsx`                       |
| A long list or a server search                                              | `VirtualizedSelect` / `VirtualizedMultiSelect`                                                                                                                                                                                                                                                           | `src/components/Select/VirtualizedSelect.tsx`                        |
| Any picker's rules                                                          | The Select README                                                                                                                                                                                                                                                                                        | `src/components/Select/README.md`                                    |
| A selection that filters page data                                          | URL keys + `readSelectionFromQuery`                                                                                                                                                                                                                                                                      | `src/components/Select/query.ts`                                     |
| A menu of actions                                                           | `MenuSurface` + `MenuItem` (`destructive` for a delete row)                                                                                                                                                                                                                                              | `src/ui/MenuSurface.tsx`                                             |
| An anchored form, panel or list                                             | `PopoverSurface` (`variant`: `actions`, `panel`, `list`, `nested`)                                                                                                                                                                                                                                       | `src/ui/PopoverSurface.tsx`                                          |
| Results under an on-page input                                              | `ComboboxSurface variant="search-results"`                                                                                                                                                                                                                                                               | `src/ui/PopoverSurface.tsx`                                          |
| The search block above a popover list                                       | `PopoverHeader`                                                                                                                                                                                                                                                                                          | `src/ui/PopoverHeader.tsx`                                           |
| Nothing here yet, nothing matched, a choice to make first, a locked feature | `EmptyState` `size` md (in a panel, card or dialog) or lg (fills a page or tab), `framed` when no surface holds it; never an error or loading                                                                                                                                                            | `src/ui/Status.tsx`                                                  |
| An empty result in a list, popover or table                                 | `NoResults`; the shared table renderers add it as a row themselves                                                                                                                                                                                                                                       | `src/ui/NoResults.tsx`                                               |
| Short hover text, an icon-only control's label                              | `Tooltip`                                                                                                                                                                                                                                                                                                | `src/ui/Tooltip.tsx`                                                 |
| Structured hover content                                                    | `Hovercard`; a chain list: `ProtocolChainsHovercard`                                                                                                                                                                                                                                                     | `src/ui/Hovercard.tsx`, `src/components/ProtocolChainsHovercard.tsx` |
| A definition beside a label                                                 | `QuestionHelper`                                                                                                                                                                                                                                                                                         | `src/ui/QuestionHelper.tsx`                                          |
| A modal task, form or picker                                                | `Dialog` `size` `sm`/`md`/`lg`/`xl` (`workspace`, `fullSheet`, `canvas`)                                                                                                                                                                                                                                 | `src/ui/Dialog.tsx`                                                  |
| An edge detail viewer, filters or history                                   | `SideSheet`                                                                                                                                                                                                                                                                                              | `src/ui/Dialog.tsx`                                                  |
| Confirm a choice / confirm and run a mutation                               | `ConfirmDialog` / `ConfirmActionDialog`                                                                                                                                                                                                                                                                  | `src/ui/ConfirmDialog.tsx`, `src/ui/ConfirmActionDialog.tsx`         |
| Guard a draft on close                                                      | `DialogDiscardGuard`, `DialogCancelButton`, `useDialogLeave`                                                                                                                                                                                                                                             | `src/ui/Dialog.tsx`, `docs/focus-and-errors.md`                      |
| Add chart metrics                                                           | `ChartMetricsDialog`                                                                                                                                                                                                                                                                                     | `src/components/ChartMetricsDialog.tsx`                              |
| Build table filters                                                         | `FilterBuilderDialog`                                                                                                                                                                                                                                                                                    | `src/components/FilterBuilderDialog.tsx`                             |
| A responsive filter toolbar and its phone menu                              | `ResponsiveFilterLayout`, `ResetFiltersButton`, `NestedMenu`                                                                                                                                                                                                                                             | `src/components/Filters/`, `src/components/NestedMenu.tsx`           |
| A text field / a multiline field                                            | `Input` / `Textarea` (`variant="code"` for code; `variant="inline"` for a rename in place in a tab or dense row; `prefix` / `suffix` for fixed text)                                                                                                                                                     | `src/ui/Input.tsx`                                                   |
| Pick files from the device                                                  | `FileButton`, a Button over a hidden input; never style the browser's file box                                                                                                                                                                                                                           | `src/ui/FileButton.tsx`                                              |
| A dashed upload or drop target / the current image with Replace             | `UploadTile` / `ImageReplaceTile` (`shape`, `pendingLabel` with `pending`)                                                                                                                                                                                                                               | `src/ui/UploadTile.tsx`                                              |
| A selectable tile with a title and a description or icon                    | `OptionTile` (`selected`, `layout`); a one-line choice is a toggle Button                                                                                                                                                                                                                                | `src/ui/OptionTile.tsx`                                              |
| A labelled control with its hint and error / a labelled set of choices      | `Field` / `FieldGroup`; a submit that finds errors calls `showFieldErrors`                                                                                                                                                                                                                               | `src/ui/Field.tsx`, `docs/focus-and-errors.md`                       |
| A search field with clear                                                   | `SearchField`; a dense side-rail filter may use an underline field with the same clear behaviour                                                                                                                                                                                                         | `src/ui/SearchField.tsx`                                             |
| A checkbox / an on-off setting                                              | `Checkbox` / `Switch`                                                                                                                                                                                                                                                                                    | `src/ui/Checkbox.tsx`, `src/ui/Switch.tsx`                           |
| A one-line toggle inside a 12px panel (chart builder options)               | `Checkbox variant="inline-sm"`                                                                                                                                                                                                                                                                           | `src/ui/Checkbox.tsx`                                                |
| A multi-choice option pill in a form                                        | `Ariakit.Checkbox render={<Button variant="toggle" />}`, sized to its row                                                                                                                                                                                                                                | `src/ui/Button.tsx`                                                  |
| A repeated content tile                                                     | `Card` (`padding` is required); a featured card beside data cards (a builder, an upsell) takes `tone` (brand, warning; a product colour comes from a scope such as `.ai-violet-accent`)                                                                                                                  | `src/ui/Card.tsx`                                                    |
| A card that links somewhere or opens a flow (article, report, launcher)     | `Card as={…}` with `hover-wash-card`, 8px; never a blue hover border, a lift or a 12px radius                                                                                                                                                                                                            | `src/ui/Card.tsx`                                                    |
| A titled chart or table shell                                               | `Panel`, `PanelHeader`, `PanelTitle`                                                                                                                                                                                                                                                                     | `src/ui/Panel.tsx`                                                   |
| A chart shell and its toolbar                                               | `ChartPanel`, `ChartPanelToolbar`, `ChartPanelBody`                                                                                                                                                                                                                                                      | `src/ui/ChartPanel.tsx`                                              |
| A table toolbar                                                             | `TableToolbar`, `TableToolbarControlGroup`                                                                                                                                                                                                                                                               | `src/ui/Toolbar.tsx`                                                 |
| A data table                                                                | `SearchTableProvider` + `Table` / `VirtualTable` / `PaginatedTable`                                                                                                                                                                                                                                      | `src/components/Table/README.md`                                     |
| A columns picker                                                            | `TableColumnSelect`, or `getHideableColumns`                                                                                                                                                                                                                                                             | `src/components/Table/search/columnSelect.ts`                        |
| A standalone page or entity title card                                      | `EntityTitleStrip`                                                                                                                                                                                                                                                                                       | `src/ui/EntityTitleStrip.tsx`                                        |
| The name row at the top of an entity's stats card                           | `EntityTitleRow` (logo, heading-sm name, actions right)                                                                                                                                                                                                                                                  | `src/ui/EntityTitleRow.tsx`                                          |
| The headline value at the top of an entity page                             | `HeroMetric`                                                                                                                                                                                                                                                                                             | `src/ui/HeroMetric.tsx`                                              |
| A summary card, its headline stat and change                                | `SummaryCardGrid`, `SummaryStatsCard`, `StatItem`, `SummaryChange`                                                                                                                                                                                                                                       | `src/ui/SummaryStats.tsx`                                            |
| A Key Metrics block                                                         | `KeyMetricsPanel` + `MetricRow` / `MetricSection`                                                                                                                                                                                                                                                        | `src/ui/KeyMetricsCard.tsx`, `src/ui/MetricPrimitives.tsx`           |
| An inline summary strip                                                     | `InlineStatStrip`                                                                                                                                                                                                                                                                                        | `src/ui/SummaryStats.tsx`                                            |
| A small chart-forward stat card                                             | `SmolStatCard`                                                                                                                                                                                                                                                                                           | `src/ui/SmolStatCard.tsx`                                            |
| A grid of stat tiles (KPI rows)                                             | `StatTile` (`loading` while it loads)                                                                                                                                                                                                                                                                    | `src/ui/SummaryStats.tsx`                                            |
| A signed change (percent, $, count or pp)                                   | `Change`; a headline, tile, strip or small card takes `change` data (`{ value, unit, comparison }`), never a tone                                                                                                                                                                                        | `src/ui/Change.tsx`                                                  |
| Panel loading, empty or error                                               | `PanelStatus`, `PanelLoadingStatus`, `SurfaceBodyStatus`, `ChartPanelBodyFallback`; a chart that failed to load: `ChartPanelBodyError` with its query as `retry`                                                                                                                                         | `src/ui/Status.tsx`, `src/ui/ChartPanel.tsx`                         |
| An inline warning or error in a dialog or form                              | `InlineStatus`                                                                                                                                                                                                                                                                                           | `src/ui/Status.tsx`                                                  |
| An error with no room for a box (a menu, a toolbar, a chip row, a footer)   | `ErrorLine` (`inset="menuRow"` inside a popover)                                                                                                                                                                                                                                                         | `src/ui/Status.tsx`                                                  |
| Work in progress in a control                                               | `Button pendingLabel="Saving…" pending={…}`: the label is passed always, so the button is as wide at rest as while busy; an upload tile or a whole-row control that cannot hold a label: `aria-busy`, a `LoadingSpinner` in its icon slot and the pending text, focus kept with `accessibleWhenDisabled` | `src/ui/Button.tsx`                                                  |
| A placeholder shape                                                         | `Skeleton`                                                                                                                                                                                                                                                                                               | `src/ui/Skeleton.tsx`                                                |
| A chart caveat / a partial failure                                          | `ScopeNote` / `FailedDataNote`                                                                                                                                                                                                                                                                           | `src/ui/ScopeNote.tsx`                                               |
| Freshness, relative time, clock text                                        | `DataFreshness`, `RelativeTime`, `StaleText`                                                                                                                                                                                                                                                             | `src/ui/`, `docs/date-formatting.md`                                 |
| Copy a value / list items in a field                                        | `CopyHelper` / `Tag`                                                                                                                                                                                                                                                                                     | `src/ui/Copy.tsx`, `src/ui/Tag.tsx`                                  |
| A tag that applies a filter on click                                        | `TagButton` (the `Tag` look plus a hover wash)                                                                                                                                                                                                                                                           | `src/ui/Tag.tsx`                                                     |
| An icon / an entity logo                                                    | `Icon` / `TokenLogo`                                                                                                                                                                                                                                                                                     | `src/ui/Icon.tsx`, `src/components/TokenLogo/index.tsx`              |

## Cross-cutting rules

Icons:

- Affordance indicators (chevrons, resting sort carets, help circles, drag handles) are `text-tertiary`; never ship an icon that inherits whatever tier surrounds it.
- An icon beside a label in the same control inherits `currentColor`, so it moves with its label on hover and active.
- An icon-only action (copy, close, download, settings, pagination) rests on `text-secondary` and turns `text-primary` on hover and focus, never dimmed with opacity.
- Status icons use the status tokens (`text-warning`, `text-error`); a good / caution / bad assessment (a flag, a rating, a compliance state) uses `success` / `warning` / `error`; empty-state illustrations are `text-tertiary` (EmptyState's neutral disc); the active sort caret is `text-link`.
- An icon beside a label is 14px (`size-3.5`); an icon-only control's icon is 16px (`size-4`). Never mix the two in one role.
- An icon leading text that can wrap (a notice, a list item, a status row, a feature bullet) sits in a `flex h-lh shrink-0 items-center` box in an `items-start` row, so it centres on the first line at any type size, as `InlineStatus` does. Never nudge it with `mt-0.5`, `mt-px` or a translate, and never `items-center` a row whose text wraps: the icon then floats to the middle of the paragraph.
- An icon-only control carries `aria-label` plus a `Tooltip` that renders as the control (`render={<Button … />}`), never one wrapped around it, so the tooltip describes the focusable control and a tap keeps the control's action. Exceptions, named by what sits beside them: a field's clear ✕ (the field's label names it), a row's expand chevron and a disclosure chevron beside its own label (`aria-expanded` says what it does), and a composer's send arrow. Never put data in a native `title=`: touch cannot reach it.

Images:

- An `<img>` reserves its box before the file loads: both sides, or one side and the aspect ratio, from classes, `style` or the `width`/`height` attributes. A logo with a fixed height takes the matching width (`h-5` with `width={58} height={20}`, or `h-7 w-[82px]`), never `w-auto`: Chrome and Lighthouse call a `w-auto` image unsized and blame it for layout shifts nearby (`check-image-size`). An uploaded image passes its stored dimensions as `aspectRatio`.

Values and windows:

- A measurement window says what span a value covers and sits bare after it: `$6.629b 24h`.
- A comparison window says what a change is measured against and is worded as one: `over 7d`, or `vs 24h ago` for a rolling value compared with its own earlier snapshot. Callers write the wording from the metric's definition; components never infer it.
- Show the comparison once: when the title names it, the value line carries it and the title drops it ("Change by Chain", not "Change by Chain, 30d").
- Calculation, coverage and snapshot details stay in tooltips.

Detail fields and notes:

- A detail field is a `label-sm text-secondary` term over a `body-md text-primary` value.
- A value is never a `"; "`-joined run: a list renders as `Tag` chips, several sentences stack one per line, and a fee schedule becomes one field per fee.
- A field the source does not disclose reads "Not disclosed" in `text-tertiary`. When every compared item withholds it, say so once in a single muted line.
- A footer note or attribution is a `label-md text-primary` heading over `body-sm text-tertiary` copy with underlined links, optionally in a `Card padding="sm"`.

Toolbars:

- `TableToolbar`, `TableToolbarControlGroup`, `PanelHeader` and `ChartPanelToolbar` own `justify-end`, so controls hug the right at every width. Callers never pass `justify-*` (`toolbar-justify-override`).
- The one left-side item (the search, a title, a leading view switch) takes `mr-auto` and sits first. In a chart toolbar it goes in the `leading` slot instead of an `ml-auto` group (`chart-toolbar-auto-margin`).
- Below `sm` the search fills its own row and every other control keeps its natural width, wrapping to the right.
- A labeled chip row is its own left-aligned `role="group"` row, never part of a toolbar.

Caveats, loading and errors:

- A caveat that changes how to read the numbers sits on top, under the toolbar and before the chart or table, through `ScopeNote` or `FailedDataNote` (`raw-scope-note`). Never hide a mismatch in a tooltip.
- Loading always shows on the surface that holds the content, through the `src/ui/Status.tsx` parts, never on the bare page background. A spinner in a control is `LoadingSpinner` (`hand-rolled-spinner`).
- A request's error renders where its data would be, never as a toast from an effect; see `docs/focus-and-errors.md`.
- Never toast over an open dialog, success included: toast from the caller once the dialog has closed.

Forms and controls:

- Every field has a visible label above it (`label-sm text-secondary`). A placeholder is an example, never the label, and a screen-reader-only label is not enough.
- Every text field is `Input` or `Textarea` (`variant="code"` for code and hex values), never a recipe string on a raw element; a field that draws its own border, fill, radius or focus drifts from it (`hand-built-field`). Its outline is `border-medium` like the controls beside it, so the field is identified by what it carries: a visible label, or a search icon with a placeholder. A field and the buttons in its row share one height: buttons beside an input are `md`.
- Every pick is `Select` or one of its siblings in `src/components/Select`, never a native `<select>` (`native-select`) or a button drawn with field classes. Inside a `Field`, the trigger takes the Field's control props and its visible label names it.
- A form validates when the reader submits it: the submit stays enabled, each error sits under its field through `Field`, and focus moves to the first invalid field. Never disable a submit until the input is valid, never show the browser's validation bubble (`check-form-validation`). See `docs/focus-and-errors.md`, "Validating a form".
- A button disabled for a reason other than invalid input (a request running, a security check loading, a cooldown, nothing to act on, a missing permission, a type-to-confirm on a destructive action) says why in visible text nearby, never only in a tooltip or `title=`.
- Controls revealed on hover also show on focus of their group (`group-hover/x:opacity-100 group-focus-within/x:opacity-100`), and the group takes `tabIndex={-1}` so a tap focuses it; or the control shows itself on focus and on touch (`focus-visible:opacity-100 pointer-coarse:opacity-100`). Never gate them by width: a tablet cannot hover and a narrow desktop window can.
- Anchor a floating control to the element it floats over (`absolute bottom-[calc(100%+8px)]` inside it), never at a fixed offset from the viewport or its scroller.
- Write each breakpoint's copy in full (`placeholder` and `shortPlaceholder`); never derive the short one by deleting words from the long one.

## Charts

Every chart draws through the renderer for its shape in [`src/components/ECharts`](src/components/ECharts):

| Shape                                   | Renderer                                               |
| --------------------------------------- | ------------------------------------------------------ |
| Lines, areas or vertical bars over time | `MultiSeriesChart` with `createTimeSeriesChartOptions` |
| Lines or vertical bars over categories  | `MultiSeriesChart` with `createCategoryChartOptions`   |
| Horizontal bars, ranked lists           | `HBarChart`                                            |
| Pie or donut                            | `PieChart`                                             |
| Scatter or bubble                       | `ScatterChart`                                         |
| Treemap                                 | `TreemapChart`                                         |
| OHLC                                    | `CandlestickChart`                                     |
| Flows between nodes                     | `SankeyChart`                                          |
| A trend line inside a row or card       | `SparklineChart`                                       |
| Signed bars inside a row or card        | `BarSparkline`                                         |
| Inflow against outflow per category     | `NetflowChart`                                         |
| Scores on several axes of one scale     | `RadarChart`                                           |

- Renderers own the instance, resize, theme, tooltip surface, grid geometry and export, so a page never calls `echarts.init` (`raw-echarts-init`). When no renderer fits, extend the closest one.
- Categorical series colors come from the one palette in [`src/constants/colors.ts`](src/constants/colors.ts): `chartColor(rank)` / `chartColors(n)`, brand blue first, each color at 3:1 or more on every chart background in both modes. Series take colors by rank in the chart; a Pro dashboard gives each entity one color across its cards, in order of first appearance. Never add a hex list, a color generator or a name hash.
- A chart that can draw more than `CHART_SERIES_LIMIT` (10) series folds the rest into one "Others" series in `OTHERS_COLOR`, unless a picker chooses the series (see `docs/charts.md`). A pie never draws more than 10 named slices. Treemap children are `childColors(parent, n)`.
- When a stack draws two series with one palette color (a picker set to show every series, or a pick from past rank 10), `MultiSeriesChart` keeps the first and gives the later one the palette color it overlaps least with: an unused color while the palette lasts, the same one a pie beside it picks. Series that fill the chart together never share a color while the palette lasts. Its tooltip leads with the band under the pointer, or the nearest of several lines, because a shared color cannot name it (`docs/charts.md`). Callers keep passing `chartColor(rank)`; never recolor a stack in a page.
- Rising and falling marks (candles, up/down bars, inflow/outflow, Sankey links, trade markers) are `chartTheme.up`/`down`, or the `CHART_UP`/`CHART_DOWN` variables in a chart payload, which the renderers resolve per theme; a bar drawn in the DOM uses `bg-chart-up`/`bg-chart-down`, never the solid text colours (`bg-data-up`). Light mode uses emerald-9 and a crimson matched to its lightness and saturation, so a red bar never outweighs a green one; dark mode uses the step-11 text colours, which match the labels beside them. Fills that text sits on (heat cells, the value scale) are the fixed `HEAT_UP`/`HEAT_DOWN`, because white text fails on the bright dark marks. Lines, labels and tooltip numbers that rise or fall use `chartTheme.dataUp`/`dataDown`, the `text-data-*` colors. A series with no direction (a total, a price) takes the palette, never green or red. The palette's deep green and crimson (its 8th and 10th colours) sit close to the up and down colours, so a chart that draws up/down beside palette series gives them to its least-paired metrics or skips them.
- A value scale (a treemap colored by change, a correlation matrix, a score) is `divergingColor(t)`: `HEAT_DOWN` through the Others grey to `HEAT_UP`, so gains and losses weigh the same. It colors fills, bars and borders (3:1), never text: a score number beside its bar stays in the text tiers. A heat cell behind text uses `HEAT_UP`, `HEAT_DOWN` or the brand color at an alpha (`color-mix(in srgb, ${HEAT_UP} 40%, transparent)`), so it follows the card in both modes.
- Colors that carry meaning stay with their meaning: supply/borrow on the data ramps (Yields included), risk on the status ramps, and brand colors that come with the data (stablecoins, exchange venues, ETF assets, partner dashboards). A brand color under 3:1 on either chart background gets a light/dark pair in the same hue, lightened or darkened just far enough; one that passes keeps its hex.
- Candlestick indicators take the palette from its second color, because brand blue is the volume bars.
- Chart chrome (axis labels, gridlines, legends, dataZoom, PNG export framing, candlestick colors) reads the `--chart-*` tokens through `useChartTheme(isThemeDark)` or `getChartTheme(isDark)` in [`chartTheme.ts`](src/components/ECharts/shared/chartTheme.ts), because canvas cannot read `var()`. Never read `--chart-*` by hand or fork chrome on `isDark`. Where canvas code must hold a token's hex (Monaco, event-rail dots, these fallbacks), write it as a checked copy, `cssVar: '--x', light, dark` or `light: ['--x', hex]`, so `check-color-contrast` fails when the token moves.
- HTML tooltips use the `.defillama-echarts-tooltip` recipe in `src/tailwind.css`.
- Cartesian geometry comes from [`chartSpacing.ts`](src/components/ECharts/shared/chartSpacing.ts) (`chartGrid()`). Never copy grid, legend or slider offsets, and never pad a chart body in the DOM.
- The 360px chart body is a floor: `ChartPanelBody` grows with a stretched panel, and the chart takes `CHART_FILL` from `src/ui/ChartPanel.tsx` as its `containerClassName` to fill it (`MultiSeriesChart`, `PieChart`, `HBarChart`, every treemap, `CandlestickChart`).
- A `MultiSeriesChart` that shows its export buttons takes its own `title`, `subtitle` and `titleTooltip`, so they share one row with .csv/.png. A `ChartPanelToolbar` title above a chart that draws its own export row stacks two rows; keep the toolbar only when it also holds a control or a value.

Exceptions and chart-specific rules: `src/components/ECharts/README.md`.

Chart data contracts: `docs/charts.md`.

## Product surfaces

- A product theme in `src/styles/themes/` holds only the product's accents: its brand hues, gradients, illustration and partner colors, and named translucent variants of those accents. Text tiers, surfaces, borders, hovers, tints and status colors come from the core tokens, so a product page has the same grays, card borders and contrast as every other page. Never add a product token for a core role (a product gray, card border or page background).
- An accent sits on a ramp when one fits (`pro-ai-*` on violet) and registers with `@theme inline`, so it resolves per element, inside `.theme-dark` too.
- Shared components on a product page keep their own variants, never page-local style forks or a product variant.
- Pro's controls are the app's `Button`, `SegmentedControl` and `Select`. `ProButton` exists only for Pro's create and generate CTAs: the soft blue `primary` tint (`bg-brand-tint`) and the soft violet `ai` tint (`bg-pro-ai-tint`), step 3 at rest, step 4 on hover, step 11 text, never solid purple.
- Research's internal pages (editor, admin, mine, profile) use the default colours and controls; the public research pages keep their editorial look (below).
- Product tokens and utilities stay inside their surfaces (`product-token-leak`, `product-utility-leak`). The surface map is `PRODUCT_SURFACE_PREFIXES` in `scripts/policies/check-design-tokens.mjs`, counted in its own `product` bucket: a separate baseline, not an exemption from any rule.
- LlamaAI's theme exceptions are listed in `src/styles/themes/llamaai.css`.
- A product color on a control is a token scope in the product's theme file that re-points the brand tokens (`.sub-api-accent`, `.sub-trial-accent`, `.ai-slack-accent`), so the control stays a plain `Button`.
- Articles' editorial research chrome keeps its own look on the landing, feed and article pages: uppercase tracked eyebrow links, the round share icon row, and the public pages' pill CTAs (the hero's links and the footer's 40px `bg-brand` "Get the media kit" pill).
- A control that is a whole table or matrix cell keeps the cell's box (a raw button with `hover:bg-hover-row`), not `Button`; so do the micro toggles inside a chart series chip.
- A rating pair whose options carry outcome colours (Good green, Bad red, as in LlamaAI's feedback dialog) keeps its own tinted button pair in a `fieldset` with a `legend` and `aria-pressed`, not a `SegmentedControl`, whose neutral selection would drop the outcome colour.

## Enforcement

The design system page at `/dev/design-system` (development only, [`src/containers/DesignSystem`](src/containers/DesignSystem/index.tsx)) shows the foundations (every colour token with its value in both modes, the ramps, the chart palette, type, radius, control heights, elevation and icons) and every `src/ui` control in every variant and state, in light, dark or side by side, with hover, focus and pressed forced. A new token, variant, size or state adds its example there in the same change, and a review of a shared control starts on that page.

Controls that share a row must share a height and a centre line, and only the rendered page shows whether they do: a grid row stretched by a neighbouring field, or a badge taller than the label line, breaks it with every control on the scale. `bun run audit:control-rows` (in [`scripts/controlRows.ts`](scripts/controlRows.ts)) loads pages from a running dev server and lists every such row; run it on the routes a layout change touches before the PR.

[`scripts/policies/check-design-tokens.mjs`](scripts/policies/check-design-tokens.mjs) is a ratchet: it counts each rule's matches against `scripts/policies/design-token-baseline.json`, in separate `core` and `product` buckets, and fails when a count rises or falls.

| Group             | Rules                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color             | `hex-in-classname`, `dark-hex-variant`, `arbitrary-color-function`, `builtin-palette-color`, `brand-fill-as-text`, `opacity-color-modifier`, `disabled-opacity`, `neutral-hover-on-hued-control`, `fixed-dark-fill`, `interim-token`, `prefixed-design-token`, `product-token-leak`, `product-utility-leak`, `implicit-border-color`, `per-field-color-scheme`, `hand-built-status-badge` |
| Type              | `arbitrary-font-size`, `raw-type-pair`, `raw-type-size`, `conflicting-named-typography`, `unknown-named-typography`, `off-scale-mono-weight`, `raw-mono-family`, `ascii-ellipsis`                                                                                                                                                                                                         |
| Spacing and shape | `arbitrary-spacing`, `arbitrary-standard-radius`, `arbitrary-shadow`, `explicit-thin-scrollbar`, `deprecated-tailwind-spelling`                                                                                                                                                                                                                                                           |
| Surfaces          | `raw-popover-surface`, `surface-chrome-override`, `menu-item-color-class`, `raw-dialog-surface`, `arbitrary-dialog-width`, `dialog-button-pinned-height`, `hand-rolled-spinner`, `raw-scope-note`, `raw-echarts-init`, `hand-built-empty-state`, `kept-mounted-surface`                                                                                                                   |
| Toolbars          | `toolbar-justify-override`, `chart-toolbar-auto-margin`                                                                                                                                                                                                                                                                                                                                   |
| Interaction       | `ungated-hover`                                                                                                                                                                                                                                                                                                                                                                           |

- After removing debt, run `bun scripts/policies/check-design-tokens.mjs --update` in the same change. Run it only when nothing fails and the counts dropped, because it rewrites rising counts too.
- [`scripts/policies/check-color-contrast.mjs`](scripts/policies/check-color-contrast.mjs) resolves the semantic tokens through the ramps in both modes and fails when a text token drops below 4.5:1 on any surface, hover wash or tint, or a ramp breaks its pair rules.
- [`scripts/policies/check-focus-handoff.ts`](scripts/policies/check-focus-handoff.ts) refuses the shapes that drop keyboard focus to the page when a control disables itself.
- [`scripts/policies/check-status-parts.ts`](scripts/policies/check-status-parts.ts) refuses hand-built loading, error and not-found states outside `src/ui`: "Loading…" text, `LoadingDots` or a lone `LoadingSpinner` as a region's loading state, an error box or `role="alert"` line drawn by hand, a retry gated on a query's `isError` or `error` instead of `queryReadFailed`, and next/error's page under `src/pages`.
- [`scripts/policies/check-form-validation.ts`](scripts/policies/check-form-validation.ts) refuses the browser's own validation: a form without `noValidate`, `setCustomValidity`/`reportValidity`, and `user-invalid` styles.
- [`scripts/policies/check-column-pickers.ts`](scripts/policies/check-column-pickers.ts) fails a Columns picker that does not keep the identity column out of its options.
- [`scripts/policies/check-image-size.ts`](scripts/policies/check-image-size.ts) fails an `<img>` whose box waits for the file, including a `w-auto` logo.
