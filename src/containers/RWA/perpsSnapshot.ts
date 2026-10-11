import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { DAY_MS } from '~/utils/timeSeries'
import type { RWAOverviewDisplayRow } from './api.types'
import { getRwaPerpsMarkets } from './cards/cardData'
import { getRwaPerpsMetricLabel, type RWAPerpsChartMetric } from './chartBreakdown'
import { isRwaTotalSeriesLabel, type RWAPositionalChartDataset, type RwaNamedValue } from './chartDataset'
import { getRwaPerpsMarketGroups } from './perpsHistoryFold'
import type { RWAGroupBy } from './table/groupBy'

/* The pie, treemap and bar views of a perps split: one value per series. Open interest and markets are balances,
   read on the latest day; volume is a flow, summed over the period the volume control picks, the rolling window the
   /dexs chains-by-adapter treemap reads. Pure: the panels fetch the split and render the slices. */

const WINDOW_DAYS: Record<ChartTimeGroupingWithCumulative, number> = {
	daily: 1,
	weekly: 7,
	monthly: 30,
	quarterly: 90,
	yearly: 365,
	cumulative: Number.POSITIVE_INFINITY
}

export function getRwaPerpsSnapshotWindowDays(
	metric: RWAPerpsChartMetric,
	period: ChartTimeGroupingWithCumulative
): number {
	return metric === 'volume' ? WINDOW_DAYS[period] : 1
}

/** The value the slices measure, for the treemap tooltip and the export title. */
export function getRwaPerpsSnapshotLabel(metric: RWAPerpsChartMetric, period: ChartTimeGroupingWithCumulative): string {
	if (metric !== 'volume') return getRwaPerpsMetricLabel(metric)
	const days = WINDOW_DAYS[period]
	if (days === Number.POSITIVE_INFINITY) return 'Volume, all time'
	return days === 1 ? 'Volume, last 24h' : `Volume, last ${days} days`
}

/**
 * Sums each series over the last `days` days of the split (the latest row alone when `days` is 1), largest first.
 * Total lines stay out, and a series with nothing in the window draws no slice.
 */
export function buildRwaPerpsSnapshot(dataset: RWAPositionalChartDataset, days: number): Array<RwaNamedValue> {
	const lastRow = dataset.source[dataset.source.length - 1]
	if (!lastRow) return []
	const cutoff = lastRow[0] - days * DAY_MS
	const sums = new Map<string, number>()
	for (let rowIndex = dataset.source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = dataset.source[rowIndex]!
		if (row[0] <= cutoff) break
		for (const [index, name] of dataset.dimensions.entries()) {
			if (index === 0 || isRwaTotalSeriesLabel(name)) continue
			const value = row[index]
			if (value == null) continue
			sums.set(name, (sums.get(name) ?? 0) + value)
		}
	}
	return toRankedSlices(sums)
}

/** One slice per name with something to draw, largest first. */
function toRankedSlices(sums: Map<string, number>): Array<RwaNamedValue> {
	const slices: Array<RwaNamedValue> = []
	for (const [name, value] of sums) if (value > 0) slices.push({ name, value })
	return slices.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

type RowSnapshotField = 'openInterest' | 'volume24h' | 'volume7d' | 'volume30d' | 'volumeAllTime'

/** The row field that holds a snapshot window; the quarter and year volume windows and markets have none. */
function getRowSnapshotField(
	metric: RWAPerpsChartMetric,
	period: ChartTimeGroupingWithCumulative
): RowSnapshotField | null {
	if (metric === 'openInterest') return 'openInterest'
	if (metric === 'markets') return null
	switch (period) {
		case 'daily':
			return 'volume24h'
		case 'weekly':
			return 'volume7d'
		case 'monthly':
			return 'volume30d'
		case 'cumulative':
			return 'volumeAllTime'
		default:
			return null
	}
}

/**
 * The pie, treemap and bar slices from the page's own rows, summed by the table's Group by (one slice per market
 * under None), largest first; null when the rows carry no field for the window, so the panel reads the history instead.
 */
export function buildRwaPerpsRowSnapshot(
	rows: ReadonlyArray<RWAOverviewDisplayRow>,
	{
		metric,
		period,
		groupBy,
		includeCex
	}: {
		metric: RWAPerpsChartMetric
		period: ChartTimeGroupingWithCumulative
		groupBy: RWAGroupBy
		includeCex: boolean
	}
): Array<RwaNamedValue> | null {
	const field = getRowSnapshotField(metric, period)
	if (!field) return null
	const markets = getRwaPerpsMarkets(rows, includeCex)
	const groups = getRwaPerpsMarketGroups(markets, groupBy)
	const sums = new Map<string, number>()
	for (const market of markets) {
		const value = market[field]
		const group = groups.get(market.id)
		if (group == null || value == null) continue
		sums.set(group, (sums.get(group) ?? 0) + value)
	}
	return toRankedSlices(sums)
}
