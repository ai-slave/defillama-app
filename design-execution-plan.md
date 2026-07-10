# Design System Architecture Plan

The visual design sweep and its stabilization passes are complete on `main`. The owner
has accepted the current light/dark visual result, so architecture work is now the active
program rather than a deferred parking lot.

Canonical references:

- [design.md](design.md) is the current rulebook for tokens, spacing, typography, and
  component recipes.
- [design-sweep-todo.md](design-sweep-todo.md) is the finalized sweep closure record.
- [design-decision-audit.md](design-decision-audit.md) preserves historical context and
  superseded decisions.
- This file owns the remaining sequence. If implementation changes a rule, reconcile
  `design.md` in the same branch.

## Landed baseline

- Semantic tokens, shared surfaces, typography utilities, focus/status behavior, and the
  token ratchet are established.
- Shared Card/Panel, table/chart toolbar, title-strip, dialog/popover, summary-stat, and
  chart-shell contracts are adopted across the audited in-scope routes.
- Chart theme and geometry are final for the sweep: canvas chrome uses `chartTheme`, HTML
  tooltip chrome uses the shared overlay recipe, and standard geometry uses
  `chartSpacing.ts` with documented special cases.
- Historical visual-verification rows are closed by owner acceptance. No route sweep,
  chart pass, or visual-stabilization branch remains before architecture work.
- Excluded products remain visually stable until a phase below explicitly changes their
  scope; shared code may still be refactored when compatibility is preserved.

## Next Architecture Work

Each phase should be a focused branch with a mechanically reviewable boundary. Finish and
verify one phase before starting the next.

### 1. Separate legacy token ownership

- Rename quarantined legacy application variables to the `--legacy-*` namespace across
  definitions and consumers.
- Preserve aliases during the migration so the branch is behavior-neutral; remove an
  alias only after the consumer scan reaches zero.
- Keep sanctioned product namespaces (`--pro-*`, `--sub-*`, `--sl-*`, `--signin-*`) as
  product namespaces rather than relabeling them as generic legacy tokens.
- Refresh the token-ratchet inventory after the mechanical rename and verify excluded
  surfaces remain visually unchanged.

### 2. Promote semantic tokens to clean names

- After legacy names no longer occupy them, drop the `--ld-` prefix from semantic,
  component, and chart tokens.
- Update Tailwind registrations, CSS definitions, TypeScript token readers, tests, and
  documentation in the same branch.
- Fold the remaining core `lint:tokens` debt and the Tailwind border-color compatibility
  shim into explicit semantic ownership where doing so is behavior-neutral; keep branded
  or product-specific values documented rather than inventing false generic semantics.
- Treat this as a semantic rename first. Any intentional color change needs a separate,
  reviewable commit.

### 3. Normalize the radius scale

- Define stable named 8px and 12px radius contracts in the Tailwind theme.
- Replace primitive-level `rounded-[8px]` / `rounded-[12px]` usage with the named scale,
  then migrate reviewed call sites.
- Preserve documented exceptions such as unlock event cards and product-specific legacy
  surfaces; do not convert every `rounded-*` occurrence mechanically without checking its
  component role.

### 4. Normalize typography

- Replace reviewed `text-sm font-medium`, heading-size/font-weight pairs, redundant custom
  line heights, and equivalent mono combinations with the named typography utilities.
- Confirm the remaining interpolated line-height values as the accepted app values unless
  a later library specification supplies different measurements.
- Keep chart canvas fonts in pixels and preserve branded/editor/product typography where
  it is intentionally outside the application ramp.

### 5. Consolidate shared APIs and file placement

- Move high-fanout design-system owners such as `MetricPrimitives`, Tooltip, and loaders
  into `src/ui` only when imports can be migrated mechanically without changing behavior.
- Tighten `Select` / `SelectWithCombobox` public defaults after excluded consumers are
  pinned to explicit compatibility props.
- Extract a shared segmented-control primitive if it removes the current TagGroup /
  ChartGroupingSelector entry-point duplication without conflating navigation tabs.
- Consolidate repeated `StatItem`, `PercentChange`, and chart export composition only
  where the shared API can express the existing semantics and layout.
- Include focused component correctness uncovered by the sweep: automatic help for
  visually truncated `FormattedName`, a touch-reachable explanation for
  `FullOldViewButton`, and opportunistic replacement of remaining low-value native
  `title` attributes.

### 6. Decide excluded-product scope

- Make an explicit Sheets decision first: migrate it to the application design system,
  keep it as a separately themed product, or quarantine its tokens/components behind an
  explicit compatibility boundary.
- Apply the same decision framework before changing Downloads, account/subscription,
  ProDashboard, LlamaAI, Yields, Articles/research, or investor-dashboard visuals.
- Shared refactors may touch these products only with explicit compatibility and
  regression verification; entering architecture scope does not silently authorize a
  visual redesign.

### 7. Retire temporary sweep documentation

- Fold any architecture decisions that remain normative into `design.md`.
- Preserve genuinely useful historical rationale in `design-decision-audit.md`.
- Delete `design-sweep-todo.md` and this execution plan once the phases above are complete
  and no temporary sequencing information remains.

## Guardrails

- Mobile dialogs use bottom sheets only below `sm`; `sm+` dialogs remain centered unless
  a product has an explicit alternative contract.
- Shared menu/select drawers stay below-`sm`; desktop popovers remain anchored.
- Card/Panel and chart/table shell ownership does not change as a side effect of namespace
  or file-placement work.
- Series/data colors are not semantic UI tokens.
- Architecture branches should prefer behavior-neutral moves and names. Separate visual
  changes into explicit commits with a stated expected result.

## Verification Policy

Follow `AGENTS.md`. For source-code changes, run in order:

1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test:typecheck`

Run `bun run lint:tokens` whenever a branch touches tokens, class strings, primitives,
route styling, or token baselines. Do not run a production build.

Owner visual acceptance covers the completed sweep. New architecture branches need only
the focused visual checks required by the surfaces they actually touch.
