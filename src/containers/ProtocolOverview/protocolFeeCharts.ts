import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import type { IAdapterBreakdownChartData } from '~/containers/AdapterMetrics/api.types'
import { getGroupedTimestampSec } from './chartSeries.utils'

export type ProtocolFeeChartSeries = Array<[number, number]>
type ProtocolFeeChartRow = [timestamp: number, ...Array<number | null>]

const FEE_CHART_DEFINITIONS = [
	{ key: 'fees', name: 'Fees', color: CHART_COLORS[0] },
	{ key: 'revenue', name: 'Revenue', color: CHART_COLORS[1] },
	{ key: 'holdersRevenue', name: 'Holders Revenue', color: CHART_COLORS[2] }
] as const

const EMPTY_FEE_CHART_PRESENTATION = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
} satisfies { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> }

function groupChart(chart: ProtocolFeeChartSeries, groupBy: ChartTimeGroupingWithCumulative): ProtocolFeeChartSeries {
	const grouped = new Map<number, number>()
	for (const [timestamp, value] of chart) {
		const timestampKey = getGroupedTimestampSec(timestamp, groupBy)
		grouped.set(timestampKey, (grouped.get(timestampKey) ?? 0) + value)
	}

	const rows = Array.from(grouped).sort((a, b) => a[0] - b[0])
	if (groupBy !== 'cumulative') return rows

	let total = 0
	for (const row of rows) {
		total += row[1]
		row[1] = total
	}
	return rows
}

const createProtocolFeeChartRow = (timestamp: number, length: number): ProtocolFeeChartRow => {
	const row: ProtocolFeeChartRow = [timestamp]
	while (row.length < length) row.push(null)
	return row
}

export function buildProtocolFeeChartPresentation({
	fees,
	revenue,
	holdersRevenue,
	selectedCharts,
	groupBy
}: {
	fees: ProtocolFeeChartSeries
	revenue: ProtocolFeeChartSeries
	holdersRevenue: ProtocolFeeChartSeries
	selectedCharts: ReadonlyArray<string>
	groupBy: ChartTimeGroupingWithCumulative
}): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> } {
	const selected = new Set(selectedCharts)
	const selectedDefinitions = FEE_CHART_DEFINITIONS.filter((definition) => selected.has(definition.name))
	if (selectedDefinitions.length === 0) return EMPTY_FEE_CHART_PRESENTATION

	const rowsByTimestamp = new Map<number, ProtocolFeeChartRow>()
	const dimensions = ['timestamp', ...selectedDefinitions.map((definition) => definition.name)]
	const charts: Array<MultiSeriesChartSeriesConfig> = selectedDefinitions.map((definition, index) => ({
		type: groupBy === 'cumulative' ? 'line' : 'bar',
		name: definition.name,
		encode: { x: 0, y: index + 1 },
		color: definition.color,
		stack: definition.name
	}))
	const sourceByKey = { fees, revenue, holdersRevenue }

	for (const [definitionIndex, definition] of selectedDefinitions.entries()) {
		for (const [timestampSec, value] of groupChart(sourceByKey[definition.key], groupBy)) {
			const timestamp = timestampSec * 1e3
			const row = rowsByTimestamp.get(timestamp) ?? createProtocolFeeChartRow(timestamp, dimensions.length)
			row[definitionIndex + 1] = value
			rowsByTimestamp.set(timestamp, row)
		}
	}

	return {
		dataset: {
			source: Array.from(rowsByTimestamp.values()).sort((a, b) => a[0] - b[0]),
			dimensions
		},
		charts
	}
}

/** Breakdown series names ranked by their total over the whole history, largest first, so colors follow rank. */
export function rankBreakdownNames(data: IAdapterBreakdownChartData): Array<string> {
	const totals = new Map<string, number>()
	for (const [, valuesByName] of data) {
		for (const name in valuesByName) totals.set(name, (totals.get(name) ?? 0) + valuesByName[name])
	}
	return Array.from(totals)
		.sort((a, b) => b[1] - a[1])
		.map(([name]) => name)
}
