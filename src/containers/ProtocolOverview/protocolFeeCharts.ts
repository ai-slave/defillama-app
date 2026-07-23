import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { getGroupedTimestampSec } from './chartSeries.utils'

export type ProtocolFeeChartSeries = Array<[number, number]>

const FEE_CHART_DEFINITIONS = [
	{ key: 'fees', name: 'Fees', color: CHART_COLORS[0] },
	{ key: 'revenue', name: 'Revenue', color: CHART_COLORS[1] },
	{ key: 'holdersRevenue', name: 'Holders Revenue', color: CHART_COLORS[2] }
] as const

const EMPTY_FEE_CHART_PRESENTATION = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
} satisfies { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] }

function groupChart(chart: ProtocolFeeChartSeries, groupBy: ChartTimeGroupingWithCumulative): ProtocolFeeChartSeries {
	const grouped = new Map<number, number>()
	for (const [timestamp, value] of chart) {
		const timestampKey = getGroupedTimestampSec(timestamp, groupBy)
		grouped.set(timestampKey, (grouped.get(timestampKey) ?? 0) + value)
	}

	const rows = Array.from(grouped).sort((a, b) => a[0] - b[0])
	if (groupBy !== 'cumulative') return rows

	let total = 0
	return rows.map(([timestamp, value]) => {
		total += value
		return [timestamp, total]
	})
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
	selectedCharts: readonly string[]
	groupBy: ChartTimeGroupingWithCumulative
}): { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const selected = new Set(selectedCharts)
	const selectedDefinitions = FEE_CHART_DEFINITIONS.filter((definition) => selected.has(definition.name))
	if (selectedDefinitions.length === 0) return EMPTY_FEE_CHART_PRESENTATION

	const rowsByTimestamp = new Map<number, Array<number | null>>()
	const dimensions = ['timestamp', ...selectedDefinitions.map((definition) => definition.name)]
	const charts: MultiSeriesChartSeriesConfig[] = selectedDefinitions.map((definition, index) => ({
		type: groupBy === 'cumulative' ? 'line' : 'bar',
		name: definition.name,
		encode: { x: 0, y: index + 1 },
		color: definition.color,
		stack: definition.name
	}))
	const sourceByKey = { fees, revenue, holdersRevenue }

	for (let definitionIndex = 0; definitionIndex < selectedDefinitions.length; definitionIndex++) {
		const definition = selectedDefinitions[definitionIndex]
		for (const [timestampSec, value] of groupChart(sourceByKey[definition.key], groupBy)) {
			const timestamp = timestampSec * 1e3
			const row = rowsByTimestamp.get(timestamp) ?? new Array<number | null>(dimensions.length).fill(null)
			row[0] = timestamp
			row[definitionIndex + 1] = value
			rowsByTimestamp.set(timestamp, row)
		}
	}

	return {
		dataset: {
			source: Array.from(rowsByTimestamp.values()).sort((a, b) => a[0]! - b[0]!),
			dimensions
		},
		charts
	}
}
