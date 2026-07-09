# Design Sweep Post-Merge Plan

This is the post-merge execution plan for follow-up design-system work after the
large design sweep and shared popover pass landed on `main`.

Canonical references:

- `design.md` is the compact rulebook for tokens, spacing, typography, and recipes.
- `design-sweep-todo.md` is the living implementation backlog.
- `design-decision-audit.md` is the decision/audit ledger.
- This file is only the current sequencing plan. If it disagrees with the three files
  above, reconcile the source docs before touching code.

## Current Status

The broad design sweep, shared popover/mobile-drawer pass, ProtocolOverview cleanup,
and text-tier/icon consistency sweep have merged to `main`.
The branch is no longer blocked by the old unlocks, popover, divider, or merge-readiness
gates. `design-sweep-todo.md` still has many unchecked items because it is now a backlog
ledger, not a merge-blocking checklist.

Completed foundation:

- Design tokens, typography utilities, `Button`, `Card`, `Panel`, `Status`, `Input`,
  toolbar recipes, and key chart/panel primitives are in place.
- Shared `Select`, `SelectWithCombobox`, `MultiSelectCombobox`, `Menu`, `NestedMenu`,
  and in-scope direct popovers use the paddingless popover surface contract.
- Shared menu/select popovers portal by default; below `sm` they use fixed-bottom
  drawer behavior, and `sm+` stays anchored to the trigger.
- ProtocolOverview `KeyMetrics`, `Flag`, `IncomeStatement`, and overview card/dialog
  cleanup have shipped.
- Text-tier and utility-icon rules are codified in `design.md` and applied through the
  shared controls touched by that sweep.
- `lint:tokens` has a locked baseline in `scripts/design-token-baseline.json`.
- Manual owner visual checks were accepted for the merged sweep and popover branches.

Current owner decisions:

- Mobile dialogs below `sm` should be bottom sheets, not centered modals.
- `sm+` dialogs stay centered modal surfaces unless a route-specific dialog already has
  a proven different pattern.
- Raises chart layout shift is a chart-shell/fallback reservation follow-up, not part
  of dense token cleanup.
- `design-sweep-todo.md` and this execution plan stay for now; deleting either is a
  later cleanup task.

## Current Branch Scope

This branch combines two related follow-up tasks:

1. Clean up stale docs so they describe the current post-merge order.
2. Start the focused DialogShell pass.

DialogShell scope:

- Keep the shared dialog surface bottom-sheet behavior limited to `max-sm`; `sm+`
  dialogs remain centered.
- Keep shared menu/select popover drawer behavior limited to `max-sm`; `sm+` popovers
  remain anchored to their trigger.
- Explicitly portal shared-dialog adopters so fixed positioning is viewport-based.
- Align close-button chrome through `DialogCloseButton`.
- Migrate small, clear in-scope legacy app dialogs from `className="dialog"` to the
  shared dialog recipe.

DialogShell guardrails:

- Do not reuse popover drawer helpers for task dialogs.
- Do not broaden dialog bottom-sheet behavior to `lg`.
- Do not touch global search, metrics browse, ProDashboard, LlamaAI, Yields,
  account/subscription, Articles, or Downloads dialogs in this branch unless explicitly
  scoped.
- Do not start dense pages, ChartPanel extraction, token namespace renames, broad
  typography codemods, or radius-scale codemods in this branch.

## Next Branches

Recommended order after this branch:

1. **Dense pages token cleanup**
   - Start with `DeFiWatchlist` and `TokenPnl`.
   - Reduce `--cards-*`, legacy `--text-*`, `--link-hover-bg`, old shell classes, and
     default-sm select drift.
   - Revisit Unlocks only if `lint:tokens` points to remaining high-value debt there.

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
