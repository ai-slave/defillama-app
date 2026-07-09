# Design Sweep Post-Merge Plan

This is the post-merge execution plan for follow-up design-system work after the
large design sweep, shared popover pass, and DialogShell pass landed on `main`.

Canonical references:

- `design.md` is the compact rulebook for tokens, spacing, typography, and recipes.
- `design-sweep-todo.md` is the living implementation backlog.
- `design-decision-audit.md` is the decision/audit ledger.
- This file is only the current sequencing plan. If it disagrees with the three files
  above, reconcile the source docs before touching code.

## Current Status

The broad design sweep, shared popover/mobile-drawer pass, DialogShell pass,
ProtocolOverview cleanup, text-tier/icon consistency sweep, dense pages/Card-Panel
cleanup, and shared-control API tightening have merged to `main`. Recent follow-ups have
completed the broad chart-panel shell migration pass, the focused status-shell/helper and
prop-trim follow-up, and the table heading/toolbar consistency pass for the audited routes.
Main is no longer blocked by the old unlocks, popover, divider, DialogShell, or
merge-readiness gates. `design-sweep-todo.md` still has many unchecked items because it
is now a backlog ledger, not a merge-blocking checklist.

Completed foundation:

- Design tokens, typography utilities, `Button`, `Card`, `Panel`, `Status`, `Input`,
  toolbar recipes, and key chart/panel primitives are in place.
- `Card` and `Panel` now share fixed `bg-surface border-subtle rounded-[8px]` chrome.
  `Card` no longer has a border-strength variant, and both primitives require callers to
  choose padding explicitly.
- Dense page and panel/card shell cleanup has shipped for `DeFiWatchlist`, `TokenPnl`,
  agreed small/static pages, standalone analytics/list shells, Chains/NFT route-family
  shells, Unlocks outer-shell fixes, and focused Correlations token cleanup.
- Shared-control API tightening has shipped for `FilterBetweenRange`, `PanelStatus`,
  `Checkbox`, `EntityTitleStrip`, `IconHitTarget`, `Button`, direct
  `selectTriggerStyles` calls, and `TagGroup`; in-scope `Select` /
  `SelectWithCombobox` callers are explicit while excluded products stay deferred.
- Body-level status helpers now exist for embedded panel/card bodies, so callers should
  choose between `PanelStatus`/`PanelLoadingStatus`, `SurfaceBodyStatus`/
  `SurfaceBodyLoadingStatus`, and chart-specific `ChartPanelBodyFallback` based on the
  shell they are already inside.
- Table heading hierarchy is explicit: page-primary tables use `PanelHeader` +
  `PanelTitle as="h1"` or `TableWithSearch headingAs="h1"`; pages that already have a
  real h1/hero use compact `TableToolbar` with no duplicate title; secondary/embedded
  tables use compact `TableToolbar` with an existing `label-md` title or no visible title.
  All table/chart toolbar controls stay md/32px.
- Shared `Select`, `SelectWithCombobox`, `MultiSelectCombobox`, `Menu`, `NestedMenu`,
  and in-scope direct popovers use the paddingless popover surface contract.
- Shared menu/select popovers portal by default; below `sm` they use fixed-bottom
  drawer behavior, and `sm+` stays anchored to the trigger.
- Shared dialog adopters use `dialogSurfaceStyles`, `DialogHeading`, and
  `DialogCloseButton`; below `sm` dialogs render as bottom sheets, and `sm+` remains
  centered.
- ProtocolOverview `KeyMetrics`, `Flag`, `IncomeStatement`, and overview card/dialog
  cleanup have shipped.
- Text-tier and utility-icon rules are codified in `design.md` and applied through the
  shared controls touched by that sweep.
- `lint:tokens` has a locked baseline in `scripts/design-token-baseline.json`.
- Manual owner visual checks were accepted for the merged sweep, popover, and DialogShell
  branches.

Current owner decisions:

- Mobile dialogs below `sm` should be bottom sheets, not centered modals.
- `sm+` dialogs stay centered modal surfaces unless a route-specific dialog already has
  a proven different pattern.
- `ChartPanel` owns only chart shell, toolbar/body placement, and fallback reservation
  chrome; route code still owns chart state, export metadata, failed-data behavior, and
  metric selection.
- Suspense reservation is explicit at the call site: use the 400px full-shell fallback
  only when the lazy chart renders its own title/export toolbar; use the 360px body
  fallback when the toolbar is already mounted outside Suspense.
- `design-sweep-todo.md` and this execution plan stay for now; deleting either is a
  later cleanup task.

## Current Focus

This file is now a sequencing guide, not a branch checklist. The immediate docs task is
to keep the backlog aligned with what has already merged, then use focused code branches
for the remaining work.

Current code scope:

- The merged route-family sweep is complete; do not retain it as upcoming work.
- Limit follow-up code to confirmed drift, shared primitive adoption, and owner visual
  verification rather than reopening already migrated route shells.
  Apply the table heading hierarchy without adding new visible titles: promote existing
  page-primary table text to h1, remove duplicate table titles only when the page already
  has a real h1/hero, and keep embedded table titles compact.
- Finish live verification and follow-up adoption for table toolbar/search alignment:
  md/32px controls, 6px dense control gaps, 8px group gaps, shared search wrappers, and no
  hand-rolled `sm` toolbar controls.
- Keep the status-shell and prop-trim decisions intact for future touches:
  `PanelStatus` for standalone panels, `SurfaceBodyStatus` inside existing surfaces, and
  `ChartPanelBodyFallback` inside `ChartPanelBody`.
- Keep the broad chart-panel decisions intact: actual ECharts plot height stays at 360px
  unless a route explicitly supplies another chart height, and residual custom chart cases
  stay separately scoped.

Carry-forward dialog/popover guardrails:

- Dialog bottom sheets stay limited to below `sm`; `sm+` dialogs stay centered unless a
  route-specific dialog already has a proven different pattern.
- Shared menu/select popover drawers stay limited to below `sm`; `sm+` popovers remain
  anchored to their trigger.
- Do not reuse popover drawer helpers for task dialogs.
- Do not broaden dialog or popover drawer behavior to `lg`.
- Do not touch global search, metrics browse, ProDashboard, LlamaAI, Yields,
  account/subscription, Articles, or Downloads dialogs unless that branch explicitly
  scopes them.
- Do not start token namespace renames, broad typography codemods, radius-scale codemods,
  or folder-hygiene moves inside dense-page or chart-shell branches.

## Next Branches

Recommended order for the next focused code branches:

0. **Overlay surface split — `mintdart/overlay-surfaces` (in review)**
   - New `bg-overlay` semantic (white light / dark = elevated-1): shared popover/menu/
     tooltip/search recipes, content dialogs (`dialogSurfaceStyles`), toasts, DOM chart
     tooltips, plus white-on-white repairs (sticky footers → `bg-overlay`, emphasis
     boxes → `elevated-1`, dashed wells → `bg-page`).
   - This branch explicitly scopes the global-search and metrics-browse dialogs (the
     carry-forward guardrail below is satisfied): the ⌘K palette moves to `bg-overlay`;
     Metrics stays a canvas dialog on `dialogCanvasSurfaceStyles` (`elevated-1`).
   - Also fixes drift found in the same audit: home product-link cards gain
     `hover-wash-card`; the RowLinksWithDropdown "Others" trigger moves to the
     documented elevated-1 → elevated-2 trigger pattern.
   - See the 2026-07-09 entry in `design-decision-audit.md` for the full decision.

1. **Owner visual verification and confirmed exceptions**
   - Verify the shared Search and Metrics dialogs, representative segmented controls,
     and DOM chart-tooltip positioning at desktop/mobile widths in both modes.
   - Revisit RWA/table, protocol income-statement, and protocol link findings only when
     a current implementation demonstrably differs from the documented recipe.

2. **Residual chart exceptions only when explicitly scoped**
   - Mixed chart/table panels, custom-height chart compositions, market mini charts,
     table-height placeholders, and excluded products should not be swept as a side
     effect of non-chart route-family work.
   - If a residual chart shell is migrated later, first decide whether it is truly a
     `ChartPanel` or a broader data/table surface with chart content inside it.
   - Chart-theme debt such as axis/grid/tooltip/candlestick colors belongs in a separate
     visual branch, not in chart-shell or status-shell cleanup.

## Deferred Until Later

These remain useful, but should stay out of near-term stabilization branches:

- Rename legacy tokens to `--legacy-*`.
- Drop the `--ld-` prefix from new design tokens.
- Global radius scale codemod from `rounded-[8px]` / `rounded-[12px]` to named Tailwind
  radius utilities.
- Broad typography codemods such as `text-sm font-medium` to `label-md`.
- Moving large high-fanout files such as `MetricPrimitives`, `Tooltip`, or loaders into
  `src/ui` purely for folder hygiene.
- Sheets scope decision.
- Deleting `design-sweep-todo.md` or this execution plan.

## Verification Policy

Follow `AGENTS.md`.

For source-code changes, run:

1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test:typecheck`

Run `bun run lint:tokens` whenever a branch touches style tokens, class strings,
primitives, route styling, or token baselines.

Do not run `bun run build`.

Manual browser verification by the owner is enough for visual checks unless the owner
explicitly asks for Playwright/Chromium screenshots.
