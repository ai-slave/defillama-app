# Design Sweep — Final Reconciliation

Status: **complete on `main`** as of 2026-07-09.

This file is the closure record for the visual design sweep. It is no longer an
implementation backlog or merge checklist. Current rules live in [design.md](design.md),
historical decisions live in [design-decision-audit.md](design-decision-audit.md), and the
next architecture sequence lives in [design-execution-plan.md](design-execution-plan.md).

## Owner acceptance

- The owner accepted the current visual result in light and dark mode after the chart
  geometry, legend paging, dataZoom, treemap, pie, backdrop, overlay, table, and panel
  follow-ups.
- Historical “verify live,” “owner eyeball,” and page-by-page visual rows are closed by
  that acceptance. They do not remain hidden prerequisites for architecture work.
- No additional screenshot or browser-verification branch is scheduled for this sweep.

## Landed visual-system baseline

- Semantic surface, text, border, state, chart, and direction tokens are established in
  `src/styles/semantics.css`; application legacy tokens use `--legacy-*`, while sanctioned
  product namespaces remain quarantined under their existing names.
- `Button`, `Card`, `Panel`, `Input`, `Status`, `EntityTitleStrip`, table/chart toolbar
  helpers, dialog/popover recipes, summary-stat helpers, and chart shell helpers own the
  shared visual contracts.
- In-scope cards and panels use the shared 8px surface/radius rhythm, explicit padding,
  32px toolbar controls, 6px dense control gaps, and 8px group/layout gaps.
- Table heading hierarchy, compact toolbars, embedded-table shell ownership, status
  semantics, and data-direction colors are applied across the audited route families.
- In-scope dialogs use `dialogSurfaceStyles` or `dialogCanvasSurfaceStyles`; Search,
  Metrics, MCP, Add to Dashboard, chart metric dialogs, filters, and other audited
  surfaces no longer depend on the legacy `dialog` utility. Remaining `dialog` class
  consumers belong to excluded account/subscription, ProDashboard, LlamaAI, Yields, or
  other separately scoped products.
- Shared menus, selects, comboboxes, hovercards, and popovers use the landed desktop
  anchored / below-`sm` drawer contract and shared overlay chrome.
- DOM and ECharts HTML tooltip chrome use shared overlay recipes. Canvas chart colors use
  `chartTheme`; standard cartesian geometry uses `chartSpacing.ts`.

## Final code reconciliation

### Charts and data surfaces

- Standard cartesian charts inherit `chartGrid()` plus shared legend and dataZoom
  geometry, including when a route overrides one grid dimension.
- Treemap, pie, candlestick, scatter, logo-HBar, and Sankey geometry is intentionally
  specialized and documented in `design.md`.
- Mixed chart/table surfaces, Markets mini charts, dynamic-height charts, table-shaped
  Suspense reservations, and excluded-product charts were reviewed as complete owners of
  their composition rather than unfinished `ChartPanel` migrations.
- No chart-theme, chart-geometry, or chart-shell follow-up branch remains.

### Shared shells and controls

- Standard in-scope chart, table, panel, title-strip, and route-family shells have moved
  to shared primitives or documented intentional compositions.
- Chain/Protocol, Token, RWA, Liquidations, Bridges, DAT, CEX, Stablecoins, Markets,
  Unlocks, LST, Governance, Equities, Adapter Metrics, and the other audited in-scope
  families use the landed control-height and spacing contracts.
- `Select` / `SelectWithCombobox` in-scope callers are explicit. Tightening their public
  defaults further is API architecture, not visual-sweep completion work.
- Repeated `MetricChip`, `StatItem`, `PercentChange`, segmented-control, and export-button
  shapes that remain are consolidation opportunities, not visual regressions.

### Accessibility, status, and hydration findings

- The global inset focus ring, virtual-focus utility, and on-brand focus utility are
  landed. The desktop/mobile logo links do not suppress focus; audited in-scope inputs
  that suppress the global outline provide their own border/ring indicator. The large
  remaining `outline-*` count is concentrated in excluded products or explicit
  input/composite focus treatments, so it is not an open sweep gate.
- Visible loading, empty, and error states use the relevant full-panel, surface-body, or
  chart-body status owner. Blank layout reservations intentionally have no live-region
  role.
- The earlier Protocol chart loading-set issue now derives its set with `useMemo`, and
  time-dependent Unlocks output uses stable server inputs or explicit hydration
  suppression at the changing text boundary. Those historical findings are closed.

## Accepted exceptions

- ProDashboard, LlamaAI, Yields, account/subscription, Downloads/SQL tooling,
  Articles/research/authors/newsletters/reports, investor dashboards, and Sheets remain
  separate products unless a later architecture phase explicitly brings one into scope.
- Series/data colors, branded marketing compositions, and product-specific functional
  layouts are not forced onto generic semantic recipes merely to reach a zero grep count.
- Custom visualizations keep measured or rendering-driven geometry where the standard
  cartesian contract would be incorrect.

## Reclassified architecture work

The old checklist mixed visual acceptance with architecture and opportunistic cleanup.
The remaining real work is now sequenced in `design-execution-plan.md`:

- remaining documented token-ratchet debt;
- shared API/component consolidation (`Select`, segmented controls, summary/change/export
  helpers) when it reduces real duplication;
- typography normalization;
- focused accessibility/component correctness for automatic truncation help, touch access
  to structured hover content, and remaining low-value native-title replacements;
- high-fanout file placement and excluded-product scope decisions;
- retirement of the temporary sweep documents after the architecture program lands.

These are the next program of work. They are not unfinished visual-sweep checks.
