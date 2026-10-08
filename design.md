# Design system

DefiLlama is a data-dense analytics UI: near-neutral surfaces, restrained color, tight radii, small type. Color signals **state and data direction** (up/down, brand, warning), never decoration. Hierarchy comes from surface elevation and text tiers, not shadows.

The design system is the code: the tokens in [`src/styles/primitives.css`](src/styles/primitives.css) and [`src/styles/semantics.css`](src/styles/semantics.css), the components in `src/ui`, and the rules in this file. If this file and those files disagree, the files win; fix this file.

The system is not frozen. When a new pattern, a new requirement or a clearly better experience shows up, change it: update the token or component and its rule here in the same PR, so the next page builds on the new version. No outside design file is a source of intent; decide from hierarchy, legibility and how the live product reads.

> **Note:** this file is excluded from Tailwind's source scanning (`@source not` in `src/tailwind.css`) so the class names mentioned here never generate CSS. Keep it that way.

## Where code and classes live

Tokens come in three tiers, and components use only tier 2 and tier 3:

1. **Primitives** (`src/styles/primitives.css`): raw ramp values such as `--blue-500`. Components never use them. They are not registered as Tailwind colors, because names like `blue` and `neutral` would override Tailwind's own palettes.
2. **Semantics** (`src/styles/semantics.css`): role tokens such as `--bg-surface` and `--text-data-up`, light values on `:root` and dark values under `html.dark`, registered as utilities (`bg-surface`, `text-primary`, `border-subtle`).
3. **Domain tokens**: only when a value differs from every semantic, such as the Yields text accents in `src/tailwind.css`. A token that would alias a semantic binds the semantic instead.

The mode lives in the selector, never in the token name: no `*-light`/`*-dark` pairs and no `dark:*-[#hex]` utilities.

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
- Reuse lives in React components, not `@apply` composites.
- `@utility` holds only small, flat, variant-free declaration sets, such as a border color or a type style. No `@apply` chains with `hover:` or `dark:` inside: each variant re-emits the whole body.
- Prefer a registered utility (`bg-surface`) over an arbitrary value (`bg-(--bg-surface)`).

## Tokens

`semantics.css` owns every value; these tables say when to use each utility.

| Background              | Use                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `bg-page`               | Page background                                                                              |
| `bg-surface`            | Cards and panels                                                                             |
| `bg-surface-elevated-1` | Nested emphasis inside a surface; canvas dialogs and sheets whose body is `bg-surface` cards |
| `bg-surface-elevated-2` | Second elevation step                                                                        |
| `bg-overlay`            | Popovers, menus, tooltips, content dialogs, toasts                                           |
| `bg-brand`              | Primary actions and brand fills                                                              |
| `bg-brand-muted`        | Brand tint for selected states                                                               |
| `bg-brand-faint`        | Lightest brand wash                                                                          |
| `bg-screen-dim`         | Dialog and drawer backdrops                                                                  |
| `bg-equity-logo`        | Fixed light canvas behind company logos, in both modes                                       |

| Text                                      | Use                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text-primary`                            | Main text                                                                                  |
| `text-secondary`                          | Supporting text and resting interactive text                                               |
| `text-tertiary`                           | Qualifiers: units, suffixes, timestamps, counts, placeholders, empty and missing values    |
| `text-disabled`                           | Disabled controls only                                                                     |
| `text-link`                               | Links                                                                                      |
| `text-link-on-tint`                       | Link-colored text on `bg-brand-muted` (selected pills and segments)                        |
| `text-on-brand`                           | Text on `bg-brand`                                                                         |
| `text-data-up` / `text-data-down`         | Positive and negative movement                                                             |
| `text-data-up-alt` / `text-data-down-alt` | A second axis of meaning in chart contexts                                                 |
| `text-warning`                            | Warnings                                                                                   |
| `text-error` / `text-success`             | Feedback on the reader's own action: validation, destructive rows, failed and done actions |
| `text-error-on-tint`                      | Error text on an error-tinted background                                                   |
| `text-verified`                           | The verified mark on yields                                                                |

| Border               | Use                                                                        |
| -------------------- | -------------------------------------------------------------------------- |
| `border-very-subtle` | Faint separation wider than a hairline; never a 1px divider                |
| `border-subtle`      | Card and panel outlines, row and section dividers                          |
| `border-medium`      | Controls, inputs, overlays, chips and badges; never page cards or dividers |
| `border-strong`      | High-emphasis outlines and unchecked checkboxes                            |
| `border-brand`       | Focus, active and brand outlines                                           |

| State                                | Use                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `hover:bg-hover-row`                 | Hover on a transparent element: popover, menu and table rows, ghost buttons        |
| `hover-wash`                         | Hover and focus wash over a tinted or opaque resting background                    |
| `hover-wash-card`                    | The fainter wash for interactive cards                                             |
| `group-hover-wash`                   | Row hover on a cell that keeps an opaque background, such as a sticky table column |
| `focus-ring` / `focus-ring-on-brand` | Focus for Ariakit virtual focus and for solid brand fills                          |

Shadows come from the `--shadow-*` tokens in `src/tailwind.css`, such as `shadow-overlay-sm` on popovers and menus and `shadow-dialog` / `dark:shadow-dialog-deep` on dialogs and sheets.

Usage rules:

- Surfaces step `page → surface → elevated-1 → elevated-2`. Cards sit on `bg-surface`; elevation steps are for nested emphasis, never page-level fills.
- Floating overlays use `bg-overlay`, not a ladder step: light mode carries their elevation with shadow, dark mode with surface lift.
- Text tiers are text-only: never `bg-primary`.
- Use solid colors for text and fills, translucent ones for borders, dividers and hover washes.
- Movement uses `text-data-up`/`text-data-down`, with a sign or arrow where the direction matters. A price drop is never `text-error`.
- Brand blue and every other palette value come only from tokens, never from a literal.
- Do not add a token for a one-off value. When a role is missing, add it to `semantics.css` with its rule here.

Text tiers: if removing the text would change what the reader knows or can do, it is `text-secondary` or above; if it only qualifies something beside it, it is `text-tertiary`.

- Enabled interactive text never rests on tertiary: rest `text-secondary`, hover and focus `text-primary`, active branded.
- In a metric line the value sits one tier above its qualifier: `$311.138b` secondary, `7d` tertiary. Qualifiers are bare spans, never parenthesized text inside the value string.
- `text-disabled` is for disabled controls only, never metadata, symbols, empty values or helper copy.

Hover has two mechanisms, picked by the resting background:

- `hover:bg-hover-row` replaces the background, so it goes only on elements that rest transparent.
- `hover-wash` stacks the wash over the resting color and skips disabled elements, so it goes on anything tinted or opaque. Never put `hover:bg-hover-row` on `bg-brand-muted`: in light mode they are the same value, and in dark mode it strips the tint.
- A trigger resting on `bg-surface-elevated-1` may hover to `bg-surface-elevated-2` instead. Never combine that step with a wash.

Focus and selection:

- One global `:focus-visible` rule in `src/tailwind.css` draws a 2px inset `border-brand` ring on everything, inset so it survives full-bleed rows and dense toolbars. Never add a ring per call site.
- Ariakit composite rows (selects, comboboxes) bind `data-focus-visible:focus-ring`, because DOM focus stays on the input. Never bind it to `data-active-item`, which follows the mouse.
- Solid brand fills, and controls resting on one (an unpin ✕ in the active nav row), use `focus-visible:focus-ring-on-brand`, because a brand ring is invisible there.
- Remove the ring with `outline-hidden` only on an element with its own focus indicator, such as `inputStyles` (`focus:border-brand`).
- Active is branded: selection shows with brand tint, solid or border plus link-blue text, never with grays.

Partner and border colors:

- A partner's brand color travels with its data. Set it as a CSS variable on the element (`style={{ '--card-accent': brandColor }}`) and read it from one shared class (`hover:border-(--card-accent)/20`, or `shadow-(color:--card-accent)` for a shadow), as `src/pages/investors.tsx` does. It becomes a product-theme token only when it must change between modes, like `--sl-kpk-mint` in `src/styles/themes/pro.css`.
- Every width-only border or divide utility (`border`, `border-t`, `divide-y`) needs a color source, or it renders `currentColor`, near-white in dark mode (`implicit-border-color`).

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

`mono-*` is JetBrains Mono; every other style is Inter. `font-mono` is JetBrains Mono too, so the app has one mono font.

- Use sentence case for UI text: titles, headings, tabs, buttons, menu items, labels and tooltips capitalize only the first word and proper nouns ("Delete project"). Brands, products and named features keep their capitals (LlamaAI, Pro, External Data Balance), and so do third-party button names ("Add to Slack").
- Metric and column names keep their spelling ("Total Value Locked", "DEX Volume (24h)"), because the same names head CSV exports and feed search; the sentence around one still follows sentence case. Names from data show as the data spells them.
- Interactive text (buttons, pills, selects, menu rows) is 12px minimum. Card body and data rows are 14px. 10px (`label-xs`, `body-xs`) is only for non-interactive metadata, such as eyebrow headers and count badges.
- Mono is never used in table cells. It sets only headline and summary values (Key Metrics, summary cards, stat strips, `HeroMetric`) and code, addresses and hashes.
- Words are always Inter, even inside a mono value: a unit or an annotation beside a mono number takes a named Inter style, and a number inside a sentence follows the sentence.
- Mono has two weights: 400 for figures and 700 for the number a block exists to show; never 500, 600 or 800 (`off-scale-mono-weight`).
- `title-*` never goes on a button; buttons use the Button recipe's `label-*`.
- Table headers use `table-header`, and cells inherit 14px Inter. An entity name in a cell is `label-md`, plus `text-link hover:underline` when it has a page.
- Never pair a raw size with a weight (`text-sm font-semibold`): pick the named style for the role (`raw-type-pair`). Six pairs render the same as a named style: `text-base`/`text-sm`/`text-xs` with `font-semibold` are `title-lg`/`title-md`/`title-sm`, `text-xs font-medium` is `label-sm`, and `text-xs`/`text-base` with `font-normal` are `body-sm`/`body-lg`. Any other pair changes the line height or weight when it moves onto the ramp; `text-sm font-medium` is 20px tall, `label-md` 17px.
- Display type on the `/mcp` and `/verified` landings sits above the ramp as designed: their hero and section headlines keep their sizes, and the type rules skip those files. The public research pages' editorial chrome (Product surfaces, below) is the other exception. Any other one-off size moves to the nearest named style, never to an inline `style`: the check cannot see one, and it cannot change at a breakpoint.
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

Control heights come from one scale: 24px small (`sm`), 32px default (`md`), 44px inside a phone sheet's rows, 56px dialog headers.

- Sheet rows (`DialogBody`, `DialogToolbar`, `DialogFooter`, a drawer's search) carry `data-sheet`, and the shared recipes take their 44px floor there through the `sheet:` variant, which applies only below `sm`.
- Page and toolbar controls stay 32px on phones, so a toolbar row never mixes heights.
- On touch screens every Button, select trigger and segment carries `touch-target`, an invisible 44px hit area that leaves the look unchanged.
- Never pin `h-*` or `size-*` on a control (`dialog-button-pinned-height`), and never put an `sm` control beside `md` ones.

## Which component for which job

Each component's header comment holds its own rules. Read it before using the component.

| Job                                                                  | Use                                                                                                                                                                                                    | File                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Any action button                                                    | `Button` (`variant`; `size` is required)                                                                                                                                                               | `src/ui/Button.tsx`                                                  |
| An internal link, menu trigger or tooltip anchor styled as a button  | `<Button as={BasicLink}>`; on an Ariakit host or `Tooltip`, `render={<Button size="md" />}`                                                                                                            | `src/ui/Button.tsx`                                                  |
| A command plus a menu that changes it                                | `ButtonGroup`                                                                                                                                                                                          | `src/ui/Button.tsx`                                                  |
| An external link styled as a button                                  | `ExternalLinkButton`; several URLs: `Menu isExternal`                                                                                                                                                  | `src/components/ExternalLinkButton.tsx`, `src/components/Menu.tsx`   |
| Pick a value that reconfigures one region                            | `SegmentedControl`; a longer pick on its own row: `variant="chips"`                                                                                                                                    | `src/ui/SegmentedControl.tsx`                                        |
| Pick which pane fills a phone screen                                 | `SegmentedControl` (a radio: on desktop both panes show)                                                                                                                                               | `src/ui/SegmentedControl.tsx`                                        |
| Switch panels in a card, panel, dialog or toolbar header             | `SegmentedControl semantics="tabs"` inside `Tabs` / `TabPanel`                                                                                                                                         | `src/ui/SegmentedControl.tsx`, `src/ui/Tabs.tsx`                     |
| Switch panels that head a page section                               | `ViewTabs` (underline) inside `Tabs` / `TabPanel`                                                                                                                                                      | `src/components/ViewTabs.tsx`, `src/ui/Tab.tsx`                      |
| Navigate between pages with tabs                                     | `TabLink` + `tabTrackStyles` in a `<nav aria-label>`, `aria-current="page"`                                                                                                                            | `src/ui/Tab.tsx`                                                     |
| An explicit scope switch                                             | `SegmentedControl` / `TagGroup` `variant="solid"`                                                                                                                                                      | `src/ui/SegmentedControl.tsx`                                        |
| Switch workspaces beside a primary action (Chat \| Terminal)         | `SegmentedControl variant="mode"` (neutral selection)                                                                                                                                                  | `src/ui/SegmentedControl.tsx`                                        |
| A filter pill or a removable active filter                           | `Button variant="filter" size="sm"` with `data-active`                                                                                                                                                 | `src/ui/Button.tsx`                                                  |
| A pill that runs or inserts something (a suggestion, a search topic) | `Button variant="secondary" size="sm"`, no active state                                                                                                                                                | `src/ui/Button.tsx`                                                  |
| A control floating over scrolling content (rail scroll arrows)       | `Button variant="overlay"`, an icon-only square with a Tooltip                                                                                                                                         | `src/ui/Button.tsx`                                                  |
| A pill that turns a list filter on or off                            | `Button variant="toggle"` with `data-active`, sized to its row (sm among chips, md among md controls)                                                                                                  | `src/ui/Button.tsx`                                                  |
| A text action inside a sentence or aligned to a text edge            | `Button variant="link"` (no size; never a padded button with a negative margin)                                                                                                                        | `src/ui/Button.tsx`                                                  |
| An icon-only delete in a dense row (data is lost)                    | `Button variant="ghostDestructive" square` plus Tooltip, sized to its row                                                                                                                              | `src/ui/Button.tsx`                                                  |
| A standalone full-width conversion CTA                               | `Button size="lg"`; beside an input it stays md                                                                                                                                                        | `src/ui/Button.tsx`                                                  |
| A product palette on a control                                       | A token scope that re-points the brand tokens (`.sub-api-accent`), never a Button variant                                                                                                              | `src/styles/themes/`                                                 |
| Chart metric or series chips                                         | `metricChipStyles`, `metricOptionChipStyles`, `metricSeriesToggleStyles`                                                                                                                               | `src/ui/MetricChip.tsx`                                              |
| A row of link pills with overflow                                    | `LinksWithDropdown`                                                                                                                                                                                    | `src/components/RowLinksWithDropdown/LinksWithDropdown.tsx`          |
| Pick from a short list                                               | `Select`                                                                                                                                                                                               | `src/components/Select/Select.tsx`                                   |
| Searchable or multi pick                                             | `SelectWithCombobox` (`isSearchable` decides the search field)                                                                                                                                         | `src/components/Select/SelectWithCombobox.tsx`                       |
| A long list or a server search                                       | `VirtualizedSelect` / `VirtualizedMultiSelect`                                                                                                                                                         | `src/components/Select/VirtualizedSelect.tsx`                        |
| Any picker's rules                                                   | The Select README                                                                                                                                                                                      | `src/components/Select/README.md`                                    |
| A selection that filters page data                                   | URL keys + `readSelectionFromQuery`                                                                                                                                                                    | `src/components/Select/query.ts`                                     |
| A menu of actions                                                    | `MenuSurface` + `MenuItem` (`destructive` for a delete row)                                                                                                                                            | `src/ui/MenuSurface.tsx`                                             |
| An anchored form, panel or list                                      | `PopoverSurface` (`variant`: `actions`, `panel`, `list`, `nested`)                                                                                                                                     | `src/ui/PopoverSurface.tsx`                                          |
| Results under an on-page input                                       | `ComboboxSurface variant="search-results"`                                                                                                                                                             | `src/ui/PopoverSurface.tsx`                                          |
| The search block above a popover list                                | `PopoverHeader`                                                                                                                                                                                        | `src/ui/PopoverHeader.tsx`                                           |
| An empty result in a list, popover or table                          | `NoResults`; the shared table renderers add it as a row themselves                                                                                                                                     | `src/ui/NoResults.tsx`                                               |
| Short hover text, an icon-only control's label                       | `Tooltip`                                                                                                                                                                                              | `src/ui/Tooltip.tsx`                                                 |
| Structured hover content                                             | `Hovercard`; a chain list: `ProtocolChainsHovercard`                                                                                                                                                   | `src/ui/Hovercard.tsx`, `src/components/ProtocolChainsHovercard.tsx` |
| A definition beside a label                                          | `QuestionHelper`                                                                                                                                                                                       | `src/ui/QuestionHelper.tsx`                                          |
| A modal task, form or picker                                         | `Dialog` `size` `sm`/`md`/`lg`/`xl` (`workspace`, `fullSheet`, `canvas`)                                                                                                                               | `src/ui/Dialog.tsx`                                                  |
| An edge detail viewer, filters or history                            | `SideSheet`                                                                                                                                                                                            | `src/ui/Dialog.tsx`                                                  |
| Confirm a choice / confirm and run a mutation                        | `ConfirmDialog` / `ConfirmActionDialog`                                                                                                                                                                | `src/ui/ConfirmDialog.tsx`, `src/ui/ConfirmActionDialog.tsx`         |
| Guard a draft on close                                               | `DialogDiscardGuard`, `DialogCancelButton`, `useDialogLeave`                                                                                                                                           | `src/ui/Dialog.tsx`, `docs/focus-and-errors.md`                      |
| Add chart metrics                                                    | `ChartMetricsDialog`                                                                                                                                                                                   | `src/components/ChartMetricsDialog.tsx`                              |
| Build table filters                                                  | `FilterBuilderDialog`                                                                                                                                                                                  | `src/components/FilterBuilderDialog.tsx`                             |
| A responsive filter toolbar and its phone menu                       | `ResponsiveFilterLayout`, `ResetFiltersButton`, `NestedMenu`                                                                                                                                           | `src/components/Filters/`, `src/components/NestedMenu.tsx`           |
| A text field / a multiline field                                     | `Input`, `inputStyles` / `textareaStyles`                                                                                                                                                              | `src/ui/Input.tsx`                                                   |
| A search field with clear                                            | `SearchField`; a dense side-rail filter may use an underline field with the same clear behaviour                                                                                                       | `src/ui/SearchField.tsx`                                             |
| A checkbox / an on-off setting                                       | `Checkbox` / `Switch`                                                                                                                                                                                  | `src/ui/Checkbox.tsx`, `src/ui/Switch.tsx`                           |
| A one-line toggle inside a 12px panel (chart builder options)        | `Checkbox variant="inline-sm"`                                                                                                                                                                         | `src/ui/Checkbox.tsx`                                                |
| A multi-choice option pill in a form                                 | `Ariakit.Checkbox render={<Button variant="toggle" />}`, sized to its row                                                                                                                              | `src/ui/Button.tsx`                                                  |
| A repeated content tile                                              | `Card` (`padding` is required)                                                                                                                                                                         | `src/ui/Card.tsx`                                                    |
| A titled chart or table shell                                        | `Panel`, `PanelHeader`, `PanelTitle`                                                                                                                                                                   | `src/ui/Panel.tsx`                                                   |
| A chart shell and its toolbar                                        | `ChartPanel`, `ChartPanelToolbar`, `ChartPanelBody`                                                                                                                                                    | `src/ui/ChartPanel.tsx`                                              |
| A table toolbar                                                      | `TableToolbar`, `TableToolbarControlGroup`                                                                                                                                                             | `src/ui/Toolbar.tsx`                                                 |
| A data table                                                         | `SearchTableProvider` + `Table` / `VirtualTable` / `PaginatedTable`                                                                                                                                    | `src/components/Table/README.md`                                     |
| A columns picker                                                     | `TableColumnSelect`, or `getHideableColumns`                                                                                                                                                           | `src/components/Table/search/columnSelect.ts`                        |
| A page or entity title                                               | `EntityTitleStrip`                                                                                                                                                                                     | `src/ui/EntityTitleStrip.tsx`                                        |
| The headline value at the top of an entity page                      | `HeroMetric`                                                                                                                                                                                           | `src/ui/HeroMetric.tsx`                                              |
| A summary card, its headline stat and change                         | `SummaryCardGrid`, `SummaryStatsCard`, `StatItem`, `SummaryChange`                                                                                                                                     | `src/ui/SummaryStats.tsx`                                            |
| A Key Metrics block                                                  | `KeyMetricsPanel` + `MetricRow` / `MetricSection`                                                                                                                                                      | `src/ui/KeyMetricsCard.tsx`, `src/ui/MetricPrimitives.tsx`           |
| An inline summary strip                                              | `InlineStatStrip`                                                                                                                                                                                      | `src/ui/SummaryStats.tsx`                                            |
| A small chart-forward stat card                                      | `SmolStatCard`                                                                                                                                                                                         | `src/ui/SmolStatCard.tsx`                                            |
| A signed percent change                                              | `PercentChange`                                                                                                                                                                                        | `src/ui/PercentChange.tsx`                                           |
| Panel loading, empty or error                                        | `PanelStatus`, `PanelLoadingStatus`, `SurfaceBodyStatus`, `ChartPanelBodyFallback`                                                                                                                     | `src/ui/Status.tsx`, `src/ui/ChartPanel.tsx`                         |
| An inline warning or error in a dialog or form                       | `InlineStatus`                                                                                                                                                                                         | `src/ui/Status.tsx`                                                  |
| Work in progress in a control                                        | `Button pendingLabel`; an upload tile or a whole-row control that cannot hold a label: `aria-busy`, a `LoadingSpinner` in its icon slot and the pending text, focus kept with `accessibleWhenDisabled` | `src/ui/Button.tsx`                                                  |
| A placeholder shape                                                  | `Skeleton`                                                                                                                                                                                             | `src/ui/Skeleton.tsx`                                                |
| A chart caveat / a partial failure                                   | `ScopeNote` / `FailedDataNote`                                                                                                                                                                         | `src/ui/ScopeNote.tsx`                                               |
| Freshness, relative time, clock text                                 | `DataFreshness`, `RelativeTime`, `StaleText`                                                                                                                                                           | `src/ui/`, `docs/date-formatting.md`                                 |
| Copy a value / list items in a field                                 | `CopyHelper` / `Tag`                                                                                                                                                                                   | `src/ui/Copy.tsx`, `src/ui/Tag.tsx`                                  |
| A tag that applies a filter on click                                 | `TagButton` (the `Tag` look plus a hover wash)                                                                                                                                                         | `src/ui/Tag.tsx`                                                     |
| An icon / an entity logo                                             | `Icon` / `TokenLogo`                                                                                                                                                                                   | `src/ui/Icon.tsx`, `src/components/TokenLogo/index.tsx`              |

## Cross-cutting rules

Icons:

- Affordance indicators (chevrons, resting sort carets, help circles, drag handles) are `text-tertiary`; never ship an icon that inherits whatever tier surrounds it.
- An icon beside a label in the same control inherits `currentColor`, so it moves with its label on hover and active.
- An icon-only action (copy, close, download, settings, pagination) rests on `text-secondary` and turns `text-primary` on hover and focus, never dimmed with opacity.
- Status icons use the status tokens (`text-warning`, `text-data-down`); empty-state illustrations are `text-tertiary`; the active sort caret is `text-brand`.
- An icon beside a label is 14px (`size-3.5`); an icon-only control's icon is 16px (`size-4`). Never mix the two in one role.
- An icon-only control carries `aria-label` plus a `Tooltip` that renders as the control (`render={<Button … />}`), never one wrapped around it, so the tooltip describes the focusable control and a tap keeps the control's action. Exceptions, named by what sits beside them: a field's clear ✕ (the field's label names it), a row's expand chevron and a disclosure chevron beside its own label (`aria-expanded` says what it does), and a composer's send arrow. Never put data in a native `title=`: touch cannot reach it.

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
- A disabled button says why in visible text nearby, never only in a tooltip or `title=`.
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

- Renderers own the instance, resize, theme, tooltip surface, grid geometry and export, so a page never calls `echarts.init` (`raw-echarts-init`). When no renderer fits, extend the closest one.
- Series colors come from `CHART_COLORS` (`src/constants/colors.ts`) and `getNDistinctColors` (`src/utils/index.tsx`). Series colors are data, not design tokens, and never change in bulk.
- Chart chrome (axis labels, gridlines, legends, dataZoom, PNG export framing, candlestick colors) reads the `--chart-*` tokens through `useChartTheme(isThemeDark)` or `getChartTheme(isDark)` in [`chartTheme.ts`](src/components/ECharts/shared/chartTheme.ts), because canvas cannot read `var()`. Never read `--chart-*` by hand or fork chrome on `isDark`.
- HTML tooltips use the `.defillama-echarts-tooltip` recipe in `src/tailwind.css`.
- Cartesian geometry comes from [`chartSpacing.ts`](src/components/ECharts/shared/chartSpacing.ts) (`chartGrid()`). Never copy grid, legend or slider offsets, and never pad a chart body in the DOM.
- The 360px chart body is a floor: `ChartPanelBody` grows with a stretched panel, and the chart takes `CHART_FILL` from `src/ui/ChartPanel.tsx` to fill it.

Exceptions and chart-specific rules: `src/components/ECharts/README.md`.

Chart data contracts: `docs/charts.md`.

## Product surfaces

- ProDashboard, Account and Subscription, Downloads, Articles, Investors, Sheets, LlamaAI and Yields follow the same rules as every page and keep their own look through their product themes in `src/styles/themes/`. They get audited and improved like any other page: UX, structure, component reuse and accessibility.
- Shared components they use keep their own variants, never page-local style forks or a product variant. Repointing a product's palette onto the core tokens is optional.
- Pro's controls are the app's `Button`, `SegmentedControl` and `Select`. `ProButton` exists only for Pro's create and generate CTAs: the soft blue `primary` tint and the soft purple `ai` tint, never solid purple. Pro keeps its card and panel surface tokens.
- Research's internal pages (editor, admin, mine, profile) use the default colours and controls; the public research pages keep their editorial look (below).
- Product tokens and utilities stay inside their surfaces (`product-token-leak`, `product-utility-leak`). The surface map is `PRODUCT_SURFACE_PREFIXES` in `scripts/policies/check-design-tokens.mjs`, counted in its own `product` bucket.
- LlamaAI's theme exceptions are listed in `src/styles/themes/llamaai.css`.
- A product color on a control is a token scope in the product's theme file that re-points the brand tokens (`.sub-api-accent`, `.sub-trial-accent`, `.ai-slack-accent`), so the control stays a plain `Button`.
- Articles' editorial research chrome keeps its own look on the landing, feed and article pages: mono uppercase eyebrow links, the round share icon row, and the public pages' pill CTAs (the hero's links and the footer's 40px `bg-link` "Get the media kit" pill).
- A control that is a whole table or matrix cell keeps the cell's box (a raw button with `hover:bg-hover-row`), not `Button`; so do the micro toggles inside a chart series chip.
- A rating pair whose options carry outcome colours (Good green, Bad red, as in LlamaAI's feedback dialog) keeps its own tinted button pair in a `fieldset` with a `legend` and `aria-pressed`, not a `SegmentedControl`, whose neutral selection would drop the outcome colour.

## Enforcement

[`scripts/policies/check-design-tokens.mjs`](scripts/policies/check-design-tokens.mjs) is a ratchet: it counts each rule's matches against `scripts/policies/design-token-baseline.json`, in separate `core` and `product` buckets, and fails when a count rises or falls.

| Group             | Rules                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color             | `hex-in-classname`, `dark-hex-variant`, `arbitrary-color-function`, `builtin-palette-color`, `interim-token`, `prefixed-design-token`, `product-token-leak`, `product-utility-leak`, `implicit-border-color`          |
| Type              | `arbitrary-font-size`, `raw-type-pair`, `conflicting-named-typography`, `unknown-named-typography`, `off-scale-mono-weight`, `ascii-ellipsis`                                                                         |
| Spacing and shape | `arbitrary-spacing`, `arbitrary-standard-radius`, `arbitrary-shadow`, `explicit-thin-scrollbar`, `deprecated-tailwind-spelling`                                                                                       |
| Surfaces          | `raw-popover-surface`, `surface-chrome-override`, `menu-item-color-class`, `raw-dialog-surface`, `arbitrary-dialog-width`, `dialog-button-pinned-height`, `hand-rolled-spinner`, `raw-scope-note`, `raw-echarts-init` |
| Toolbars          | `toolbar-justify-override`, `chart-toolbar-auto-margin`                                                                                                                                                               |

- After removing debt, run `bun scripts/policies/check-design-tokens.mjs --update` in the same change. Run it only when nothing fails and the counts dropped, because it rewrites rising counts too.
- [`scripts/policies/check-focus-handoff.ts`](scripts/policies/check-focus-handoff.ts) refuses the shapes that drop keyboard focus to the page when a control disables itself.
- [`scripts/policies/check-column-pickers.ts`](scripts/policies/check-column-pickers.ts) fails a Columns picker that does not keep the identity column out of its options.
