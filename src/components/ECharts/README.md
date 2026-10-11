# Chart renderers

design.md → Charts picks the renderer for a chart's shape and owns its look (series palette, theme and geometry modules). `docs/charts.md` owns data contracts: tooltip readers, time axes, period grouping, pickers and CSV. This page covers what each chart kind must show, the props the renderers share and the exceptions to the shared geometry.

## Shared props

A prop that does the same job on two renderers has the same name on both.

- **Header:** only `MultiSeriesChart` and `PieChart` draw a header row, from `title` (`MultiSeriesChart` adds `subtitle`, `titleTooltip` and `headingAs`). Leave `title` out rather than passing `""`. The other renderers draw no header: their `ChartPanelToolbar` holds a `ChartPanelTitle` and `ChartExportButtons`, which reach the chart through `onReady`.
- **Exports:** `exportButtons` on the renderers with a header: `'auto'`, `'hidden'`, or an object choosing `csv`, `png`, `filename`, `pngTitle` and `pngIconUrl`. Under a `ChartPanelToolbar` it is `'hidden'`, and the buttons go in the toolbar.
- **Legend:** `showLegend`, off by default.
- **Size:** `containerClassName={CHART_FILL}` inside a `ChartPanelBody` (src/ui/ChartPanel.tsx). `height` is for a fixed tile, such as a side donut or a sparkline, and for a height the code computes. Pro dashboard charts keep their own card system, sized by the height the user picks for each card (compact, default, tall), so they pass `height` and never move onto the chart shell.
- **Tooltip:** `tooltipFormatter` on the renderers that take one; `MultiSeriesChart` reads `chartOptions.tooltip`.

## What a chart must show

| To do this                            | Use                                                                                                                                                                  | Example                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Show a distribution                   | State the population, label the bucket dimension and the measure, and expose exact values through the axis or tooltip                                                |                                                                     |
| Compare buckets                       | A quantitative axis; when bars are normalized to the largest bucket instead, say so in the chart body                                                                |                                                                     |
| Rank categories                       | Name every category on the axis; keep the complete name in the tooltip when an axis label is shortened                                                               |                                                                     |
| Color a signed matrix (returns)       | `bg-data-up-tint text-data-up` above zero, `bg-data-down-tint text-data-down` below, neutral at zero, tertiary text when unavailable; brand tint stays for selection | `ReturnMatrix` in `src/containers/Equities/AggregateShared.tsx`     |
| Let a treemap drill down              | Click-to-zoom with the native breadcrumb hidden needs `ChartRestoreButton` in the toolbar, so every drilldown has a visible way back                                 | `AggregateTreemap` in `src/containers/Equities/AggregateShared.tsx` |
| Title a treemap of a whole population | `showRootLabel={false}` when the panel title already names it; grouped parent headers stay                                                                           | `AggregateTreemap` in `src/containers/Equities/AggregateShared.tsx` |
| Label treemap tiles                   | The `TreemapLabelContrast` extension, registered for every treemap renderer and the PNG exporter                                                                     | `TreemapChart/labelContrast.ts`                                     |
| Export a treemap as PNG               | Native ECharts labels only, set at series, level and data-item scope, with animation off on the treemap series                                                       | `src/components/ChartExport/chartPngExport.ts`                      |
| Center a pie with outside labels      | `centerY` on `PieChart`, so the pie and its labels center together                                                                                                   | `src/containers/BridgedTVL/BridgedTVLByChain.tsx`                   |

## Treemap labels

- Black or white text by relative-luminance contrast against the resolved tile fill, compositing a transparent fill over its background.
- Parent headers draw their own label background.
- Names and values share one opaque text color, with no text outlines or shadows.
- A PNG export never adds a second text graphic layer over the tiles. Level settings can suppress series labels, so set export labels at every scope, and check that labels appear once in nested and zoomed exports.
- The treemap series has its own animation default that overrides the global flag, so the export turns it off on the series.

## Event rail

`MultiSeriesChart` draws hallmarks on a rail under the plot (`MultiSeriesChart/eventRail.ts`). Events from every source, Pro dashboard notes and LlamaAI annotations included, draw here; no chart offers a switch to draw them as lines instead.

- `hallmarks` and `rangeHallmarks` are unix seconds, the unit the API sends. A source that builds dates in milliseconds converts them before passing them in.
- `referenceLines` is not an event: it draws a dated divider across the plot, such as Today on an unlock schedule, where the line itself splits past from future.

- A point event is a 16px circle: grey for a milestone, red with a "!" when its label names a hack, exploit, attack, rug pull or depeg. The rail reads the label, so a hallmark label leads with what happened ("Hack · Access Control · $8.2m lost"), never a bare classification.
- Point events closer than a marker's width at the current zoom share one marker that shows their count. It is red when any member is, and its tooltip lists every member.
- A range event is a band across its span: violet, or solid red with a "!" for a danger label. Hovering the band shades its span on the plot. The rail is the one place events draw, so a page never adds its own `markArea` or mark line for them.
- Fills hold 3:1 on the plot surface and glyphs 4.5:1 on their fill, in both themes, so a marker never depends on its 1px border.
- The chart's Events toggle chip uses `OTHERS_COLOR`, the grey of the default marker, never a series colour.

## Geometry exceptions

The cartesian renderers take their inset, legend and dataZoom geometry from `shared/chartSpacing.ts`. These keep their own:

- Treemaps use an 8px inset on the canvas wrapper (`CHART_INSET`), because ECharts zoom clips to the canvas, not the series rectangle. Never replace it with series offsets, and check the zoomed state as well as the unzoomed one.
- Legend-based pies stay vertically centered and reserve their measured legend region.
- Stacked candlestick grids keep one fixed left edge across panels.
- Scatter labels stay inside their plot.
- Logo `HBarChart`s reserve a measured left region for the logos.
- `SankeyChart` owns its node layout instead of a cartesian grid.

A new exception needs a route-level visual check in both themes.
