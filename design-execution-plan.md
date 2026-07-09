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
ProtocolOverview cleanup, text-tier/icon consistency sweep, and dense pages/Card-Panel
cleanup have merged to `main`.
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
- Raises chart layout shift is a chart-shell/fallback reservation follow-up, not part
  of dense token cleanup.
- `design-sweep-todo.md` and this execution plan stay for now; deleting either is a
  later cleanup task.

## Current Focus

This file is now a sequencing guide, not a branch checklist. The immediate docs task is
to keep the backlog aligned with what has already merged, then use focused code branches
for the remaining work.

Next code scope:

- Work on the shared-control API tightening branch. Keep it behavior-neutral: add explicit
  props that preserve current visuals, then remove hidden defaults/dead props from the
  shared contracts.
- If tightening a shared prop would type-break an excluded/quarantined product, pin that
  caller explicitly instead of sweeping its styling.
- Keep Raises chart layout shift as a chart-shell/fallback reservation follow-up.
- Keep `ChartPanel` extraction blocked until after the Raises/chart-shell pass.

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

1. **Shared control API tightening**
   - Use a focused branch, suggested name: `mintdart/shared-control-api-tightening`.
   - `FilterBetweenRange`: remove dead `name`, make `variant` and `size` explicit, and
     consider reusing `selectTriggerStyles` for trigger chrome.
   - `PanelStatus`: require `variant` so empty/error/loading semantics are explicit.
   - `Checkbox`: require `variant` and collapse duplicate indicator style maps.
   - `EntityTitleStrip`: remove unused `titleClassName` unless a scoped title exception is
     approved.
   - `IconHitTarget`: remove the unused component or migrate the one style-string caller.
   - `Button`: make `size` explicit first; defer making `variant` required unless the
     branch is intentionally broader.
   - `selectTriggerStyles`: require `variant` and `size` at direct helper calls.
   - `TagGroup`: require `variant` and `size`; remove the redundant local `style` type.
   - `Select` / `SelectWithCombobox`: make in-scope callers explicit first, then tighten
     the shared prop types only after excluded surfaces are pinned.

2. **Raises/chart-shell layout pass**
   - Fix the `/raises` Suspense/fallback reservation that can cause a chart-panel layout
     shift.
   - Keep actual ECharts plot height at 360px unless the route explicitly supplies
     another chart height.
   - Include one investor raises page because it shares the same chart reservation shape.

3. **ChartPanel extraction**
   - Do this only after the chart-shell pass.
   - Extract shell/toolbar/chrome only.
   - Keep URL query state, exports, Add to Dashboard config, failed-data behavior,
     metric selection, and route-specific chart logic local.

4. **Remaining route-family migrations**
   - Stablecoins, bridges, RWA, token, LST, liquidations, DAT, adapter/markets, MCP,
     borrow, and remaining CEX markets/date-filter surfaces.
   - Keep these route-sized. Each branch should state which family was visually checked
     and which excluded/quarantined surfaces were intentionally left alone.

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
