# Charts

design.md "Charts" picks the renderer for each chart shape and owns the look. This page owns the data contracts: what a chart's rows mean, how its tooltip reads them, how it groups periods, and what its picker and CSV contain.

Draw every chart with the shared renderer for its shape; `MultiSeriesChart` handles category axes as well as time. If no renderer fits, extend one. The `raw-echarts-init` rule in `scripts/policies/check-design-tokens.mjs` fails a direct `echarts.init` outside `src/components/ECharts/` and `src/components/ChartExport/`.

## Where the work goes

| To do this                                                                        | Use                                                                                                                                                                                       | Example                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Read a series value or timestamp in a tooltip formatter                           | `getTooltipRawYValue` and `getTooltipAxisValue` from `src/components/ECharts/shared/tooltip.ts`; never index `params.value` or `params.data` by position or series name                   | `src/components/ECharts/MultiSeriesChart/tooltip.ts`              |
| Stamp a calendar date on a time axis                                              | UTC midnight, such as ``Date.parse(`${date}T00:00:00Z`)``                                                                                                                                 | `src/containers/Unlocks/buildUnlocksMultiSeriesChart.ts`          |
| Show the viewer's local time on a chart                                           | `chartOptions.useUTC: false` plus local tooltip and zoom-label formatters (see "Time axes")                                                                                               |                                                                   |
| Group daily points by week, month, quarter or year                                | `getBucketTimestampSec` and the `formatBarChart`, `formatLineChart` and `formatDailyAverageChart` builders in `src/components/ECharts/shared/timeSeries.ts`; never a local bucketing loop | `src/containers/ChainOverview/chainChartData.ts`                  |
| Place a week an API stamps on its Monday                                          | `lastDayOfWeek` from `src/utils/index.tsx`                                                                                                                                                | `src/containers/Unlocks/EmissionsByProtocol.tsx`                  |
| Keep a selection that filters page data or must survive a reload or a shared link | The URL, through `src/components/Select/query.ts`; filter rows, requests and exports with `readSelectionFromQuery` on the client and the server                                           | `src/containers/Unlocks/Table.tsx`                                |
| Keep a selection that only changes what one chart draws                           | `useLocalSelection` (or `useSelectionIntent` when an API needs the intent) from `src/components/Select/localSelection.ts`, with a `scope`                                                 | `src/containers/ProDashboard/components/StablecoinsChartCard.tsx` |
| Draw a share view (dominance, pie, share %)                                       | `buildSelectedPercentageChart` from `src/components/ECharts/MultiSeriesChart/selection.ts` and the pie builders in `src/components/ECharts/PieChart/data.ts`                              | `src/containers/Oracles/OraclesByChain.tsx`                       |
| Draw a stacked chart of absolute values                                           | Drop unpicked series; show the upstream "Others" only while every series is picked                                                                                                        |                                                                   |
| Build a chart's CSV                                                               | `selectChartDatasetColumns` from `src/components/ECharts/MultiSeriesChart/selection.ts`, or the CSV builders in `src/components/ECharts/PieChart/data.ts`; never the full dataset         | `src/containers/AdapterMetrics/ProtocolChart.tsx`                 |

## Before changing a dataset row layout

- Formatter params are typed `unknown`, so type errors do not reveal a reader that a row layout change breaks.
- Search for every reader of the old layout, for example `data[seriesName]`, `seriesName in data` and `.value[1]`.
- Migrate each reader or confirm it is unaffected before the change is done.

## Pickers

- Never keep a list selection in plain `useState`.
- Pass a picker its URL keys and options and let it read its own selection. The `src/components/Select/query.ts` header lists the URL rules.
- A local selection's `scope` names the entity and the chart, such as `${chain}:pie`, so a page that stays mounted while the entity changes starts from the default. The `src/components/Select/localSelection.ts` header lists the local rules.

## Series colors and Others

- Series take `chartColor(rank)` from `src/constants/colors.ts` in the order the chart ranks them. A series that keeps its place while a picker changes keeps its color.
- A chart without a picker draws at most `CHART_SERIES_LIMIT` (10) named series plus one "Others" in `OTHERS_COLOR`, summed per point and drawn last. With a picker, the default selection is the top 10 and the rest fold into "Others", unless the page chooses to show every series by default (the `/chains` dominance chart).
- A pie draws at most `CHART_SERIES_LIMIT` named slices plus "Others", so a slice never repeats a color and a pie beside a stacked chart colors the same ten the same way.
- In one stack, `MultiSeriesChart` recolors a series that repeats an earlier drawn series' palette color (`assignStackColors`). While the drawn series fit the palette, repeats take the unused colors in draw order (`assignUniqueColors`), the rule pies follow, so a pie and a stack of the same picks agree. Past the palette, each repeat, largest area first, takes the palette color it shares the fewest visible rows with. A stack that shows every series has no unused colors, so a chain picked into the pie from past rank 10 can differ from its band; the top 10 always agree, and the tooltip names the band. It runs once per dataset and pick, never on hover. Recolored series follow the drawn data, so a filter or pick can move them, as rank colors already move when ranks change. Unstacked charts, stacks side by side and brand colors keep the caller's colors.
- A shared color cannot name its series, so `MultiSeriesChart` flags the series under the pointer (`EChartsTooltipItem.pointed`) for whichever formatter the chart uses: the stack band holding the pointer, or, on a chart of several unstacked lines, the line within 12px of it. Every tooltip formatter on a stacked or multi-line chart lists that series first in `TOOLTIP_POINTED_ROW_STYLE` (a page formatter reads it with `getPointedSeriesName`), even when its value would fall past a cap or into "+N more", and keeps it out of any folded remainder. An Others band keeps its own row, and totals never change. Hover never dims the other series: dimming left bars muted after fast pointer movement and made dense stacks hard to scan.
- A treemap's children are `childColors(parent, n)`; a treemap does not fold, because every tile carries its label.
- Up/down, supply/borrow, risk tiers and brand colors that come with the data keep their meaning-based colors.
- A product page whose metrics keep one color across all its charts (the token rating page: market cap blue, volume gold, depth purple) names them once in `src/constants/colors.ts` as `[light, dark]` pairs, like `ASSET_BRAND_COLORS`, and passes them as per-series colors to the shared charts. A pair under 3:1 on a chart background moves its lightness (OKLCH, same hue) just far enough in that mode; `check-color-contrast` checks every pair.

## Share views

- A share view measures every value against the whole population the page's URL filters select.
- The chart picker only chooses which members get their own series. Everything else, including an upstream remainder, is one "Others".
- A share view always totals 100%, and a pick keeps its share whatever else is picked.
- Nothing picked draws nothing.
- A chart's CSV follows its picker: every picked series in its own column without the top-N "Others" fold, plus the "Others" the chart draws.
- A share view exports the same shares the chart draws.

## Grouped periods

Weekly, monthly, quarterly and yearly charts bucket daily points into UTC calendar periods. A week runs Monday to Sunday and is keyed by its Sunday; every other period is keyed by its first day. The tooltip reads that key as the period it names, such as "14 - 20 Sep 2026" or "Sep 1 - 30, 2026", and the CSV writes the period's start and end dates.

- Flows and counts that add up across days sum the period (`formatBarChart`).
- Balances and running totals keep the period's last available value (`formatLineChart`), on the same key as the bars, so one period label describes every series in the chart.
- Daily counts that do not add up across days, such as active addresses, average the period's observed days (`formatDailyAverageChart`) and say so in their series name. Cumulative mode leaves them out.
- A grouped chart passes `groupBy` together with its rows, in the same memo or deferred snapshot, so the tooltip and CSV never label one grouping's rows with another.
- An API payload that is already grouped keeps its values. A week the API stamps on its Monday moves to that week's Sunday (`lastDayOfWeek`) and is not summed again.
- Fiscal reporting periods, such as equities fundamentals, are the provider's periods. Name them by their period end, such as "Quarter ending Jul 2025".

## Time axes

ECharts time axes run in UTC. `MultiSeriesChart` sets `useUTC: true` unless a caller sets `chartOptions.useUTC: false`, and `CandlestickChart` always sets it. Tick placement and default tick labels then agree with the UTC tooltip, zoom and hallmark labels, and a daily point stamped at UTC midnight sits on its day's tick in every viewer zone. Without it, ECharts places and labels ticks in the viewer's local time, and one chart shows two zones.

- Stamp calendar dates at UTC midnight. Never stamp a date key at local midnight (`dayjs(date)`, `new Date(y, m, d)`, an offsetless date-time string): a chart built on the server and one built in the browser would disagree.
- A chart that shows the viewer's local time opts out as a whole: set `useUTC: false` and replace the tooltip and zoom-label formatters with local ones. `useUTC` changes only ECharts' own time handling; the shared tooltip and zoom formatters stay UTC.
- Local time on a chart also follows "Render clock and hydration" in `docs/date-formatting.md`.

## Testing a formatter

- Test a custom formatter with real builder output that has at least two series with different values.
- Confirm the test fails without the fix. The rest of the policy is in `docs/testing.md`.
