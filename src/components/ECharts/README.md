# Chart renderers

design.md → Charts picks the renderer for a chart's shape and owns its look (series palette, theme and geometry modules). `docs/charts.md` owns data contracts: tooltip readers, time axes, period grouping, pickers and CSV. This page covers what each chart kind must show and the exceptions to the shared geometry.

## What a chart must show

| To do this                            | Use                                                                                                                                                              | Example                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Show a distribution                   | State the population, label the bucket dimension and the measure, and expose exact values through the axis or tooltip                                            |                                                                     |
| Compare buckets                       | A quantitative axis; when bars are normalized to the largest bucket instead, say so in the chart body                                                            |                                                                     |
| Rank categories                       | Name every category on the axis; keep the complete name in the tooltip when an axis label is shortened                                                           |                                                                     |
| Color a signed matrix (returns)       | `bg-data-up/10 text-data-up` above zero, `bg-data-down/10 text-data-down` below, neutral at zero, tertiary text when unavailable; brand tint stays for selection | `ReturnMatrix` in `src/containers/Equities/AggregateShared.tsx`     |
| Let a treemap drill down              | Click-to-zoom with the native breadcrumb hidden needs `ChartRestoreButton` in the toolbar, so every drilldown has a visible way back                             | `AggregateTreemap` in `src/containers/Equities/AggregateShared.tsx` |
| Title a treemap of a whole population | `showRootLabel={false}` when the panel title already names it; grouped parent headers stay                                                                       | `AggregateTreemap` in `src/containers/Equities/AggregateShared.tsx` |
| Label treemap tiles                   | The `TreemapLabelContrast` extension, registered for every treemap renderer and the PNG exporter                                                                 | `TreemapChart/labelContrast.ts`                                     |
| Export a treemap as PNG               | Native ECharts labels only, set at series, level and data-item scope, with animation off on the treemap series                                                   | `src/components/ChartExport/chartPngExport.ts`                      |
| Center a pie with outside labels      | `centerY` on `PieChart`, so the pie and its labels center together                                                                                               | `src/containers/BridgedTVL/BridgedTVLByChain.tsx`                   |

## Treemap labels

- Black or white text by relative-luminance contrast against the resolved tile fill, compositing a transparent fill over its background.
- Parent headers draw their own label background.
- Names and values share one opaque text color, with no text outlines or shadows.
- A PNG export never adds a second text graphic layer over the tiles. Level settings can suppress series labels, so set export labels at every scope, and check that labels appear once in nested and zoomed exports.
- The treemap series has its own animation default that overrides the global flag, so the export turns it off on the series.

## Geometry exceptions

The cartesian renderers take their inset, legend and dataZoom geometry from `shared/chartSpacing.ts`. These keep their own:

- Treemaps use an 8px inset on the canvas wrapper (`CHART_INSET`), because ECharts zoom clips to the canvas, not the series rectangle. Never replace it with series offsets, and check the zoomed state as well as the unzoomed one.
- Legend-based pies stay vertically centered and reserve their measured legend region.
- Stacked candlestick grids keep one fixed left edge across panels.
- Scatter labels stay inside their plot.
- Logo `HBarChart`s reserve a measured left region for the logos.
- `SankeyChart` owns its node layout instead of a cartesian grid.

A new exception needs a route-level visual check in both themes.
