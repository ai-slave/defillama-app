# Design Sweep Merge Execution Plan

This is the merge-oriented plan for finishing the current design-system branch.
It intentionally replaces the old multi-PR roadmap. The goal is to make this
branch mergeable to main through focused commits, each reviewed before commit.

Canonical references:

- `design.md` is the compact rulebook for tokens, spacing, typography, and recipes.
- `design-sweep-todo.md` is the live implementation checklist.
- `design-decision-audit.md` is the decision/audit ledger.
- This file is only the execution plan. If it disagrees with the three files above,
  reconcile the source docs first before touching code.

## Current Merge Readiness Snapshot — 2026-07-08

Short answer: this branch is a merge candidate after the final unlocks density check,
final `main` sync, CI/review, and the final verification packet below.

Current branch snapshot:

- The owner completed the broad manual visual route pass and reported the checked
  pages look good.
- The remaining pre-merge visual change is the focused `/unlocks/celestia` density
  pass for allocation/events content. It must be visually accepted before merge.
- The required source checks have passed on the current source changes: `format`,
  `lint`, `typecheck`, `test:typecheck`, `lint:tokens`, and `git diff --check`.
- The `lint:tokens` baseline is locked in `scripts/design-token-baseline.json`.
- `design-sweep-todo.md` still has many unchecked items, but those are a living audit
  queue. They are not all merge blockers.

Merge blockers that still need a recorded answer:

1. Owner visual acceptance of the unlocks allocation/events density pass.
2. Final `main` sync and conflict check before merge.
3. Final review gates from `design-sweep-todo.md`: excluded-surface guard, chart visual
   guard, token/style guard, semantic/status guard, duplicate-shell guard, and live route
   guard.
4. High-level `git diff main...HEAD` review for accidental excluded-surface, chart-data,
   data-fetching, route behavior, or broad unrelated changes.
5. Run the final required checks once more immediately before merge if any source files
   changed after the last checked commit.

Not merge blockers by themselves:

- Clearing every unchecked item in `design-sweep-todo.md`.
- Extracting `SegmentedControl` into `src/ui`.
- Completing every remaining `DialogShell`, status-shell, Panel/Card, IconHitTarget, or
  tooltip-chrome migration.
- Renaming token namespaces, changing the global radius scale, or broad typography
  codemods.

Owner verification checklist:

Manual browser verification is enough for this packet. Do not block the branch on
setting up Playwright/Chromium unless the owner explicitly asks for automated screenshots.

- `/`: global search desktop panel is height-capped and scrolls internally; check empty
  search and a typed query. Also confirm sidebar divider has no horizontal scrollbar and
  home top controls keep their spacing.
- `/chain/ethereum`: chain stack spacing, top controls, chart controls, and table toolbar.
- `/metrics` and `/tools`: search input, category/card spacing, hover states, and dividers.
- `/protocol/uniswap`, `/protocol/tvl/uniswap`, `/protocol/stablecoins/tether`: title
  strips, chart toolbar, Add Metrics dialog, export buttons, status states, and no chart
  visual/color regression.
- `/token/hyperliquid` and `/token-rights`: token tables, token overview controls, and
  token-rights green/warning visuals unchanged.
- `/unlocks/celestia`: allocation/events density, notes/prose cards, countdown/calendar,
  and the documented event-card radius exception.
- `/cex/assets/binance`, `/stablecoins`, `/bridges`, `/rwa`, `/liquidations`, `/mcp`:
  table toolbar/search alignment, filter popovers, CSV/PNG buttons, and shell spacing.
- One mobile-width pass on `/`: nav/search drawer and global search behavior.
- Check dark mode first, then light mode for regressions.

Decisions to answer before merge or explicitly defer:

- Unlocks: accept the latest allocation/events density pass and 12px event-card radius
  exception after visual review, or request a final focused adjustment.
- The following are explicitly deferred to post-merge backlog unless a visible regression
  is found: remaining default-sm select sizing, legacy/direct dialog migration, status
  shells, remaining Panel/Card route-family cleanup, segmented-control extraction,
  IconHitTarget adoption, icon-button hover radius, and chart tooltip chrome.

## Merge Strategy

- Stay on this branch. Do not split into multiple PR branches for this cleanup.
- Use focused commits, not huge sweep commits. Each commit should have one coherent
  review surface: docs, dividers, popovers, table toolbars, one route family, etc.
- Prefer stabilization over new architecture. Do not start token-namespace renames,
  radius-scale codemods, or broad typography codemods before this branch merges.
- Commit only after the focused review gates for that commit pass.
- Never mix rename-only work with visual restyling.
- Never mix chart-data/config changes with shell/control cleanup.
- No behavior changes for metrics, filters, sorting, data fetching, or chart series.
  Visual work can change classes/components only.

## Current Scope Rules

In scope:

- Home/chain, metrics/tools, protocol/protocol-tvl/protocol subpages, CEX assets and
  stablecoins, token pages and token private-gate/markets sections, token-rights shell
  and typography, RWA/RWA perps, stablecoins, bridges, liquidations, DAT, adapters,
  borrow/MCP/watchlist-like public product surfaces.
- Token-rights green/warning pills and warning cards are visually guarded. Spacing,
  type, shell, and table chrome can migrate; those semantic pills/cards need live
  pixel checks before any intentional visual change.
- Raises/investor-like list pages are in scope unless they are investor-relations
  dashboard/product surfaces.

Excluded unless explicitly reopened:

- ProDashboard.
- LlamaAI.
- Yields.
- Account/subscription.
- Downloads, including SQL/notebook tooling.
- Articles/research/authors/newsletters/reports surfaces.
- Investor-relations dashboard surfaces and `containers/Investors` / `pages/investors`
  dashboard surfaces.

Shared components used by excluded surfaces can still migrate, but excluded callers
must be pinned through explicit compatibility props such as `popoverVariant="legacy"`
or `variant="pro"`. Do not fork shared styles into excluded page files.

## Verification Policy

Follow `AGENTS.md`.

For source-code changes, run:

1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test:typecheck`

Extra design-system checks:

- Run `bun run lint:tokens` whenever a commit touches style tokens, class strings,
  primitives, route styling, or token baselines.
- Do not run `bun run build`.
- Documentation-only edits do not require the full verification sequence.
- Live browser checks are required for visually observable changes before a commit
  is considered ready. Check dark mode first, then light mode where the route is
  meaningfully different.

For scripted or batch replacements:

- Print per-file match counts before changing files.
- Re-grep after the replacement. Tailwind class ordering can make remembered strings
  miss silently.
- Review the diff manually before formatting.

## Pre-Commit Review Gates

Before staging each focused commit, run read-only review passes for the relevant
scope. Reviewers should inspect and report; they should not edit files.

Minimum gates for every visual commit:

- **Scope guard:** no excluded surface was changed unless only a compatibility prop
  was threaded through a shared component.
- **Chart guard:** no `CHART_COLORS`, `getNDistinctColors`, chart series arrays, data
  transforms, or ECharts option objects changed as a side effect.
- **Token/style guard:** no new page-local color, arbitrary font size, arbitrary
  spacing, `--cards-*`, `--old-blue`, `--link-hover-bg`, or hex class was introduced
  where a primitive or recipe exists.
- **Layout guard:** controls are padding/min-height driven, not fixed-height wrappers;
  chart/table toolbar controls are 32px; dense toolbar gaps are 6px; group/page gaps
  are 8px; home top controls keep the 12px exception.
- **Semantic guard:** status/error/empty shells keep wrapper semantics separate from
  text semantics and do not reintroduce default paragraph margins.
- **Duplicate-shell guard:** repeated local `rounded/border/bg/p-*` shells are either
  migrated to a primitive/composite or explicitly documented as route-specific.
- **Opposite-edge guard:** if the commit fixes one route, inspect the closest sibling
  routes that share the same component so the fix does not create a new drift.

Suggested focused reviewers:

- Excluded-surface reviewer.
- Chart-visual reviewer.
- Token/style reviewer.
- Route-family visual reviewer.
- Duplicate-shell/component reviewer.

## Commit Sequence

### Commit 0 — Reconcile Docs And Merge Criteria

Purpose: make the docs non-stale before more code lands.

- Align `design.md`, `design-sweep-todo.md`, and `design-decision-audit.md` on current
  decisions: scope, toolbar rhythm, popover contract, divider usage, summary metric
  rules, and unlocks status.
- Remove stale PR language from execution docs.
- Record intentional Figma overrides where they are owner decisions, not extraction
  mistakes.
- Ensure open items are clearly marked as pending, not implied complete.

Ready when:

- The three source docs and this plan do not contradict each other.
- No implementation files changed in this commit.

### Commit 1 — Low-Risk Divider And Border Stabilization

Purpose: fix obvious divider drift without changing layout or typography.

- Add a tiny sidebar divider style/component: `w-full max-w-53 border-t border-subtle`
  (212px cap from the spacing scale), with sidebar overflow contained so the divider
  cannot create a horizontal scrollbar.
- Replace sidebar legacy black/white divider lines with the new divider style where
  appropriate. Do not touch sidebar link font size, weight, padding, or labels.
- Normalize detail-card internal row dividers to `border-very-subtle` where they are
  row separators inside a card.
- Keep dense table/grid row separators on `border-divider`.
- Confirm metrics category dividers are `border-subtle`; if already fixed, only update
  docs/evidence.

Review focus:

- Sidebar both themes.
- Metrics/tools category dividers.
- Protocol/token/stablecoin/equity/RWA detail-card row separators.

### Commit 2 — Current Regression Stabilization

Purpose: fix visible drifts already found during review, before adding new primitives.

- Popovers/selects:
  - Ensure action/footer rows cannot horizontally overflow.
  - Keep search blocks padded correctly.
  - Multi-select rows show compact empty and filled checkboxes.
  - Single-select rows show only a selected check, no empty box/circle.
- Table/toolbars:
  - Align search placement and controls across RWA, equities, hacks, raises, stablecoins,
    token, CEX, and protocol-like tables.
  - Keep reset/filter buttons at 32px through primitive sizing and internal badge spacing,
    not fixed wrapper heights.
- Home/chain:
  - Restore the 12px top-controls gap.
  - Keep page stack and card/table gaps on the 8px rhythm.
- Symbol/metadata colors:
  - Audit `text-disabled` uses. Metadata/symbols should use secondary/tertiary, not
    disabled text, unless the control is actually disabled.

Review focus:

- `/`, `/chain/ethereum`, `/rwa`, `/rwa/chains`, `/equities`, `/hacks`, `/raises`,
  `/stablecoins`, `/token/hyperliquid`, `/cex/assets/binance`.

### Commit 3 — Shared Popover/Dialog/Table Composite Adoption

Purpose: reduce repeated markup only where the shared contract is proven.

- Move remaining in-scope direct popover copies to `src/ui/Popover.ts` recipes.
- Adopt shared dialog surface/chrome for in-scope dialogs that already visually match
  the modal recipe. Do not redesign complex interiors in the same commit.
- Adopt `TableToolbar` / `TableToolbarControlGroup` for table bands where it removes
  repeated local shell code without changing data behavior.
- Adopt chart export/button composites where the markup is purely repeated chrome.

Review focus:

- Popover open/close, scroll containment, footer/action-row containment.
- Dialog focus trap and close behavior.
- Table toolbar sizing and search alignment.
- Excluded callers pinned to compatibility variants.

### Commit 4 — Route-Family Shell Cleanup

Purpose: finish hard-rolled shells in route families that already share the same visual
model.

Work route family by route family, not random files:

- Home/chain shared surfaces.
- Metrics/tools card grids and grouped links.
- Protocol overview and protocol TVL/subpage shells.
- Stablecoins asset and overview pages.
- Token overview, token tabs, notes/prose cards, markets/private-gate shells.
- Token-rights summary/table shell, guarding green/warning visual output.
- RWA/RWA perps, equities, hacks, raises.
- Bridges and CEX chart/table shells.
- DAT, adapter/markets, borrow/MCP where they match existing primitives.

For each route family:

- Map shared component usages first.
- Check sibling routes before changing a shared component.
- Replace repeated local `rounded/border/bg/p-*` shells with `Card`, `Panel`,
  `EntityTitleStrip`, `TableToolbar`, or a documented route-family wrapper.
- Keep chart lazy reservations correct: whole chart shells with toolbar + 360px chart
  body reserve 406px; chart-only fallbacks stay 360px.

Review focus:

- One route family per commit if the diff is substantial.
- Live check at least one representative route and one sibling route.

### Commit 5 — Unlocks Focused Visual Resolution

Purpose: settle the unlocks allocation/events changes separately because they are
visually larger than ordinary cleanup.

- Re-audit Figma nodes for unlock allocation, token stats, events, and notes/prose.
- Decide whether allocation/events should keep the newer Panel/Card treatment or be
  toned back to the old density with only typography/gap fixes.
- Preserve headings/content; do not delete content to match a partial Figma snippet.
- Keep the documented 12px unlock event-card radius only if live review confirms the
  roomy exception works with the rest of the page.
- Fix density issues such as `body-lg` data rows only where they are true drift.

Review focus:

- `/unlocks/:protocol` or `/protocol/unlocks/:protocol`, both themes.
- Token allocation bars, token stats strip, events carousel/list, notes/prose cards,
  schedule toolbar, and chart lazy reservations.

### Commit 6 — Final Review And Merge Readiness

Purpose: prove the branch is stable enough to merge.

- Run all review gates in `design-sweep-todo.md`.
- Run full required verification.
- Run `bun run lint:tokens`; update the baseline only if the count genuinely improves
  and the diff is reviewed.
- Live route pass:
  - `/`
  - `/chain/ethereum`
  - `/metrics`
  - `/tools`
  - `/protocol/uniswap`
  - `/protocol/tvl/uniswap`
  - `/protocol/stablecoins/tether`
  - `/token/hyperliquid`
  - `/token-rights`
  - `/unlocks/celestia`
  - `/cex/assets/binance`
  - `/stablecoins`
  - `/bridges`
  - `/rwa`
  - `/liquidations`
  - `/mcp`
- Review `git diff main...HEAD` at a high level and confirm the commit history is
  understandable.

Ready to merge when:

- No known visual regression is undocumented.
- No source doc contradicts current implementation.
- Excluded surfaces were not restyled accidentally.
- Full verification passes or any failure is known, unrelated, and documented.

## Deferred Until After Main Merge

These are useful, but too risky for this branch while we are stabilizing visual drift.
Do not start this list until the merge-readiness gates, owner verification checklist,
and pending owner decisions above are resolved and this branch has merged to `main`,
or until the owner explicitly opens a post-merge follow-up. These are not fallback tasks
for the current branch.

- Rename legacy tokens to `--legacy-*`.
- Drop the `--ld-` prefix from new design tokens.
- Global radius scale codemod from `rounded-[8px]` / `rounded-[12px]` to named Tailwind
  radius utilities.
- Broad typography codemods such as `text-sm font-medium` to `label-md`.
- Moving large high-fanout files such as `MetricPrimitives`, `Tooltip`, or loaders into
  `src/ui` purely for folder hygiene.
- Sheets scope decision.
- Deleting `design-sweep-todo.md` or this execution plan.

## Commit Checklist

Before each commit:

- `git status --short`
- Inspect unstaged/staged diff.
- Confirm unrelated user/parallel-agent changes are not included.
- Run relevant read-only review gates.
- Run required verification for the files changed.
- Update docs if the commit changes a rule, scope decision, or known pending item.
- Stage only the focused commit.
- Write the commit message from the actual diff, not from this plan.
