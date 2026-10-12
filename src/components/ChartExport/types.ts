import type * as echarts from 'echarts/core'

/**
 * Ties one chart to export buttons rendered anywhere on the page: the chart reports its instance through
 * `handleChartReady`, and `ChartExportButtons` (or the .csv/.png button alone) reads it through `chartInstance`.
 * `useGetChartInstance()` returns one. Passing the same handle to both is what connects them, so a page never wires
 * `onReady` for exports by hand.
 */
export interface ChartExportHandle {
	chartInstance: () => echarts.ECharts | null
	handleChartReady: (instance: echarts.ECharts | null) => void
}

/**
 * A chart with no export buttons of its own or on the page. The reason is the record of the decision: a preview inside
 * an editor, an embed, a sparkline-sized visual whose numbers sit beside it, or the menu that exports it instead.
 */
export interface OmittedChartExport {
	omit: string
}

/**
 * Where a headless renderer's .csv/.png live: a handle the page also gives to its export buttons, or a stated
 * reason for having none. Every call states it, so a chart cannot lose its exports silently.
 */
export type HeadlessChartExportButtons = ChartExportHandle | OmittedChartExport

/**
 * Where a MultiSeriesChart or PieChart puts its .csv/.png: `'auto'` draws them in the chart's own header, an object
 * does the same with export names, a handle leaves them to buttons the page renders (beside its filters, in a panel
 * toolbar), and `{ omit }` states why there are none.
 */
export type ChartExportButtonsMode =
	| 'auto'
	| { filename?: string; pngTitle?: string; pngIconUrl?: string }
	| HeadlessChartExportButtons

export function chartExportHandle(mode: ChartExportButtonsMode): ChartExportHandle | undefined {
	return typeof mode === 'object' && 'handleChartReady' in mode ? mode : undefined
}
