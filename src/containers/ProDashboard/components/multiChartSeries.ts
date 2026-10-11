import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	getMetricUnitGroup,
	METRIC_UNIT_GROUP_SYMBOL,
	resolveSeriesAxisLayout
} from '~/containers/ProDashboard/components/metricGroups'
import { capitalizeFirstLetter } from '~/utils'
import type { CsvCell } from '~/utils/csvCell'
import type { ChartRuntimeView } from '../chartRuntime'
import {
	type ChartConfig,
	type DashboardGrouping,
	getProDashboardChartTypeConfig,
	isDailyAverageChartType
} from '../types'
import { getCsvPeriodCells, getCsvPeriodHeaders, getGroupedMetricTitle } from '../utils'

/**
 * The grouping a combined chart applies to every series. Returns null when one of its metrics cannot
 * be grouped, because the card then hides its grouping control and every series stays daily.
 */
export function getMultiChartGrouping(
	items: ReadonlyArray<Pick<ChartConfig, 'type'>>,
	grouping: DashboardGrouping | undefined
): DashboardGrouping | null {
	for (const item of items) {
		const chartType = getProDashboardChartTypeConfig(item.type)
		if (chartType === undefined || !('groupable' in chartType) || chartType.groupable !== true) return null
	}
	return grouping ?? 'day'
}

/** The grouping all items of a combined preview share. Daily when they disagree or one cannot be grouped. */
export function getComposerGrouping(items: ReadonlyArray<Pick<ChartConfig, 'type' | 'grouping'>>): DashboardGrouping {
	let shared: DashboardGrouping | undefined
	for (const item of items) {
		if (item.grouping === undefined) continue
		if (shared === undefined) shared = item.grouping
		else if (shared !== item.grouping) return 'day'
	}
	return getMultiChartGrouping(items, shared) ?? 'day'
}

export type MultiChartInputSeries = {
	name: string
	baseType: 'bar' | 'area' | 'line' | undefined
	data: Array<[number, number]>
	color: string
	metricType: string
}

/** One composer preview series, named and colored the way the saved card draws it at this grouping. */
export function buildComposerPreviewSeries(
	item: Pick<ChartConfig, 'type'> & { data: Array<[number, number]> },
	grouping: DashboardGrouping,
	subject: string,
	color: string
): MultiChartInputSeries {
	const meta = getProDashboardChartTypeConfig(item.type)
	return {
		name: `${subject} ${getGroupedMetricTitle(item.type, meta?.title || item.type, grouping)}`,
		baseType:
			meta?.chartType === 'bar' || meta?.chartType === 'area' || meta?.chartType === 'line'
				? meta.chartType
				: undefined,
		data: item.data,
		color,
		metricType: item.type
	}
}

/** The series a combined chart card draws, named for its grouping, in the colors `getMultiChartSeriesColors` gave. */
export function buildMultiChartCardSeries(
	validItems: ReadonlyArray<ChartRuntimeView>,
	{
		showCumulative,
		grouping,
		getProtocolName,
		colors
	}: {
		showCumulative: boolean
		grouping: DashboardGrouping
		getProtocolName: (protocol: string) => string | undefined
		colors: Record<string, string>
	}
): Array<MultiChartInputSeries> {
	// A running total of daily averages is meaningless, so cumulative leaves those series out; the card says so.
	const chartedItems = showCumulative ? validItems.filter((cfg) => !isDailyAverageChartType(cfg.type)) : validItems
	return chartedItems.map((cfg) => {
		const meta = getProDashboardChartTypeConfig(cfg.type)
		const name = cfg.subjectType === 'protocol' ? getProtocolName(cfg.protocol) || cfg.protocol : cfg.chain
		return {
			name: `${name} ${getGroupedMetricTitle(cfg.type, meta?.title || capitalizeFirstLetter(cfg.type), grouping)}`,
			baseType:
				meta?.chartType === 'bar' || meta?.chartType === 'area' || meta?.chartType === 'line'
					? meta.chartType
					: undefined,
			data: cfg.data,
			color: colors[cfg.id],
			metricType: cfg.type
		}
	})
}

export type MultiChartSeriesView = {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	solidChartAreaStyle: boolean
}

function getSeriesMagnitude(data: MultiChartInputSeries['data']): number | undefined {
	let magnitude = 0
	for (const [, value] of data) {
		if (!Number.isFinite(value)) continue
		magnitude = Math.max(magnitude, Math.abs(value))
	}
	return magnitude > 0 ? magnitude : undefined
}

export function buildMultiChartCsvRows(
	{ dataset, charts }: MultiChartSeriesView,
	grouping: DashboardGrouping
): Array<Array<CsvCell>> {
	const rows = new Array<Array<CsvCell>>(dataset.source.length + 1)
	rows[0] = [...getCsvPeriodHeaders(grouping), ...charts.map((chart) => chart.name)]
	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const sourceRow = dataset.source[rowIndex]
		const row: Array<CsvCell> = getCsvPeriodCells((sourceRow[0] as number) / 1e3, grouping)
		for (const chart of charts) {
			const dimension = chart.encode.y
			const value = typeof dimension === 'number' ? sourceRow[dimension] : null
			row.push(value ?? '')
		}
		rows[rowIndex + 1] = row
	}
	return rows
}

/** Build the final multi-chart dataset directly from ascending per-series tuples. */
export function buildMultiChartSeriesView({
	series,
	showCumulative,
	showPercentage,
	stackSeries
}: {
	series: Array<MultiChartInputSeries>
	showCumulative: boolean
	showPercentage: boolean
	stackSeries: boolean
}): MultiChartSeriesView {
	const dimensions = new Array<string>(series.length + 1)
	const indexes = new Uint32Array(series.length)
	const runningTotals = new Float64Array(series.length)
	const hasRunningTotal = new Uint8Array(series.length)
	const percentageTotals = new Float64Array(series.length)
	dimensions[0] = 'timestamp'
	for (let i = 0; i < series.length; i++) {
		dimensions[i + 1] = series[i].name
	}

	const shouldZeroFill = stackSeries || showPercentage
	const source: MultiSeriesChartDataset['source'] = []
	const pointCount = series[0]?.data.length ?? 0
	let usesAlignedFastPath = series.length > 0
	for (let i = 1; i < series.length && usesAlignedFastPath; i++) {
		if (series[i].data.length !== pointCount) usesAlignedFastPath = false
	}

	// Sources produced by one endpoint normally share a timestamp vector. Build
	// those rows directly; if equal-length sources differ, restart with the merge.
	if (usesAlignedFastPath) {
		alignedRows: for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
			const timestamp = series[0].data[pointIndex][0]
			const row = new Array<number>(series.length + 1)
			row[0] = timestamp * 1e3
			let rowTotal = 0
			for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
				const item = series[seriesIndex]
				const point = item.data[pointIndex]
				if (point[0] !== timestamp) {
					usesAlignedFastPath = false
					break alignedRows
				}
				let value = point[1]
				if (showCumulative && item.baseType === 'bar') {
					runningTotals[seriesIndex] += value
					value = runningTotals[seriesIndex]
				}
				row[seriesIndex + 1] = value
				rowTotal += value
			}
			if (showPercentage) {
				for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
					const percentage = rowTotal > 0 ? (row[seriesIndex + 1] / rowTotal) * 100 : 0
					row[seriesIndex + 1] = percentage
					percentageTotals[seriesIndex] += percentage
				}
			}
			source.push(row)
		}
	}

	if (!usesAlignedFastPath) {
		source.length = 0
		runningTotals.fill(0)
		hasRunningTotal.fill(0)
		percentageTotals.fill(0)
		while (true) {
			let timestamp = Number.POSITIVE_INFINITY
			for (let i = 0; i < series.length; i++) {
				const point = series[i].data[indexes[i]]
				if (point && point[0] < timestamp) timestamp = point[0]
			}
			if (timestamp === Number.POSITIVE_INFINITY) break

			const row = new Array<number | null>(series.length + 1)
			row[0] = timestamp * 1e3
			let rowTotal = 0
			for (let i = 0; i < series.length; i++) {
				const item = series[i]
				const point = item.data[indexes[i]]
				let value: number | null = shouldZeroFill ? 0 : null
				if (point?.[0] === timestamp) {
					indexes[i]++
					if (showCumulative && item.baseType === 'bar') {
						runningTotals[i] += point[1]
						hasRunningTotal[i] = 1
						value = runningTotals[i]
					} else {
						value = point[1]
					}
				} else if (showCumulative && item.baseType === 'bar' && hasRunningTotal[i]) {
					value = runningTotals[i]
				}
				row[i + 1] = value
				if (value != null) rowTotal += value
			}

			if (showPercentage) {
				for (let i = 0; i < series.length; i++) {
					const value = row[i + 1] ?? 0
					const percentage = rowTotal > 0 ? (value / rowTotal) * 100 : 0
					row[i + 1] = percentage
					percentageTotals[i] += percentage
				}
			}
			source.push(row)
		}
	}

	const axisLayout = resolveSeriesAxisLayout(
		series.map((item) => ({ metricType: item.metricType, magnitude: getSeriesMagnitude(item.data) }))
	)
	const chartOrder = new Array<number>(series.length)
	for (let i = 0; i < series.length; i++) chartOrder[i] = i
	if (showPercentage && source.length > 0) {
		chartOrder.sort((a, b) => percentageTotals[a] - percentageTotals[b])
	}

	const charts = new Array<MultiSeriesChartSeriesConfig>(series.length)
	for (let outputIndex = 0; outputIndex < chartOrder.length; outputIndex++) {
		const inputIndex = chartOrder[outputIndex]
		const item = series[inputIndex]
		const isCumulativeFlow = showCumulative && item.baseType === 'bar'
		const type = showPercentage || isCumulativeFlow || item.baseType !== 'bar' ? 'line' : 'bar'
		const yAxisIndex = showPercentage ? 0 : axisLayout.seriesAxisIndexes[inputIndex]
		const unitGroup = showPercentage ? 'percent' : getMetricUnitGroup(item.metricType)
		charts[outputIndex] = {
			type,
			name: item.name,
			encode: { x: 0, y: inputIndex + 1 },
			color: item.color,
			valueSymbol: METRIC_UNIT_GROUP_SYMBOL[unitGroup],
			...(type === 'line' ? { connectNulls: true } : {}),
			...(showPercentage || stackSeries ? { stack: 'total' } : {}),
			...(showPercentage || axisLayout.needMultipleAxes ? { yAxisIndex } : {})
		}
	}

	return {
		dataset: { source, dimensions },
		charts,
		solidChartAreaStyle:
			showPercentage || (stackSeries && series.length > 0 && series.every((item) => item.baseType === 'area'))
	}
}
