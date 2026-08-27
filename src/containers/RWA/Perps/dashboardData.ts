import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAChartDataset, RWAChartRow } from '~/containers/RWA/chartDataset'
import type { IRWAPerpsMarket } from './api.types'
import { getRWAPerpsSharedBreakdownLabel } from './breakdownLabels'
import type {
	RWAPerpsAssetTimeSeriesBreakdown,
	RWAPerpsAssetGroupBreakdown,
	RWAPerpsChartMode,
	RWAPerpsOverviewBreakdown,
	RWAPerpsVenueBreakdown
} from './types'

const EMPTY_DATASET: RWAChartDataset = { source: [], dimensions: ['timestamp'] }

type RWAPerpsTimeSeriesBreakdownForMode =
	| RWAPerpsOverviewBreakdown
	| RWAPerpsVenueBreakdown
	| RWAPerpsAssetGroupBreakdown
	| RWAPerpsAssetTimeSeriesBreakdown

function getRWAPerpsTimeSeriesDatasetDimensions(source: RWAChartDataset['source']) {
	const latestValueBySeries = new Map<string, number>()

	for (let rowIndex = source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = source[rowIndex]

		for (const series in row) {
			if (series === 'timestamp' || latestValueBySeries.has(series)) continue
			latestValueBySeries.set(series, row[series] ?? 0)
		}
	}

	return [
		'timestamp',
		...[...latestValueBySeries.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([series]) => series)
	]
}

export function buildRWAPerpsTimeSeriesDatasetForRows({
	dataset,
	rows,
	breakdown,
	seriesKey = 'contract'
}: {
	dataset: RWAChartDataset
	rows: IRWAPerpsMarket[]
	breakdown: RWAPerpsTimeSeriesBreakdownForMode
	seriesKey?: 'contract' | 'id'
}): RWAChartDataset {
	if (dataset.source.length === 0 || rows.length === 0) return EMPTY_DATASET

	const labelBySeries = new Map<string, string>()
	for (const row of rows) {
		labelBySeries.set(seriesKey === 'id' ? row.id : row.contract, getRWAPerpsSharedBreakdownLabel(row, breakdown))
	}

	const source: RWAChartDataset['source'] = []
	for (const row of dataset.source) {
		const nextRow: RWAChartRow = { timestamp: row.timestamp }
		let hasSelectedValue = false

		for (const series in row) {
			if (series === 'timestamp') continue
			const label = labelBySeries.get(series)
			if (!label) continue
			const value = row[series]
			if (value == null) continue

			nextRow[label] = (nextRow[label] ?? 0) + value
			hasSelectedValue = true
		}

		if (hasSelectedValue) source.push(nextRow)
	}

	const dimensions = getRWAPerpsTimeSeriesDatasetDimensions(source)
	return dimensions.length > 1 ? { source, dimensions } : EMPTY_DATASET
}

export function getRWAPerpsIncludedRows(markets: IRWAPerpsMarket[], mode: RWAPerpsChartMode): IRWAPerpsMarket[] {
	if (mode === 'venue' || !markets.some((market) => market.suspicious)) return markets
	return markets.filter((market) => !market.suspicious)
}

export function buildRWAPerpsTimeSeriesCharts({
	metric,
	dimensions,
	timeSeriesMode
}: {
	metric: 'openInterest' | 'volume24h' | 'markets'
	dimensions: string[]
	timeSeriesMode: 'grouped' | 'breakdown'
}): Array<MultiSeriesChartSeriesConfig> {
	const seriesType: MultiSeriesChartSeriesConfig['type'] = metric === 'volume24h' ? 'bar' : 'line'
	const seriesKeys = dimensions.filter((dimension) => dimension !== 'timestamp')
	const hasTotalOverlay = timeSeriesMode === 'breakdown' && metric !== 'volume24h' && seriesKeys.includes('Total')
	const breakdownSeries = seriesKeys.filter((seriesName) => !(hasTotalOverlay && seriesName === 'Total'))
	const charts: MultiSeriesChartSeriesConfig[] = []

	for (const [index, seriesName] of breakdownSeries.entries()) {
		charts.push({
			name: seriesName,
			type: seriesType,
			...(metric === 'volume24h' ? { stack: 'A', large: false } : {}),
			encode: { x: 'timestamp', y: seriesName },
			color: CHART_COLORS[(index + (hasTotalOverlay ? 1 : 0)) % CHART_COLORS.length] ?? CHART_COLORS[0]
		})
	}

	if (hasTotalOverlay) {
		charts.push({
			name: 'Total',
			type: 'line',
			encode: { x: 'timestamp', y: 'Total' },
			color: CHART_COLORS[0],
			hideAreaStyle: true,
			excludeFromTooltipTotal: true
		})
	}

	return charts
}
