import type { RWAFlowOverviewSplitBy } from './api.types'
import type { RWAChartAggregationMode } from './chartAggregation'
import {
	getChartViewOptions,
	type RWAChartMetric,
	type RWAChartOption,
	type RWAChartView,
	type RwaTreemapParentGrouping
} from './chartState'
import type { RWAGroupBy } from './table/groupBy'

/** Every metric the overview panel can draw; open interest and volume belong to the Perps view. */
export type RWAOverviewChartMetric = RWAChartMetric | 'flows' | 'flowVsPrice' | 'openInterest' | 'volume'

/**
 * Where a spot time series comes from. `assets` folds the page's per-asset history by one attribute;
 * `chains` folds the per-chain asset histories, one series per chain, because the payload carries no chain axis.
 */
export type RWASpotChartSource =
	| { kind: 'assets'; mode: Exclude<RWAChartAggregationMode, 'total' | 'assetClass'> }
	| { kind: 'chains' }

/** A fold honours the table's filters; a server split honours the scope flags only. */
export type RWAChartDataOrigin = 'fold' | 'split'

export const RWA_CHART_FILTER_NOTE =
	'This chart follows the Group by and the scope toggles; the other filters apply to the table only.'

const GROUP_LABELS: Record<RWAGroupBy, string> = {
	platform: 'Platform',
	chain: 'Chain',
	assetGroup: 'Asset Group',
	category: 'Category',
	asset: 'Asset',
	none: 'Asset'
}

export function getRwaSpotChartSource(groupBy: RWAGroupBy): RWASpotChartSource {
	switch (groupBy) {
		case 'chain':
			return { kind: 'chains' }
		case 'platform':
		case 'assetGroup':
		case 'category':
			return { kind: 'assets', mode: groupBy }
		case 'asset':
		case 'none':
			return { kind: 'assets', mode: 'assetName' }
		default:
			return assertNever(groupBy)
	}
}

/** The axis the pie, treemap and bar views read; Asset Class is a treemap nesting level only. */
export type RwaChartAxis = Exclude<RwaTreemapParentGrouping, 'assetClass'>

/** The pie, treemap and bar views read the same axis; None and Asset show one slice per asset. */
export function getRwaTreemapParentGrouping(groupBy: RWAGroupBy): RwaChartAxis {
	switch (groupBy) {
		case 'platform':
		case 'chain':
		case 'assetGroup':
		case 'category':
			return groupBy
		case 'asset':
		case 'none':
			return 'assetName'
		default:
			return assertNever(groupBy)
	}
}

/**
 * Where a Perps view time series comes from: a server split per venue, asset group or reference asset, or the
 * per-contract split folded to the largest contracts. Both are splits, so the table filters do not apply.
 */
export type RWAPerpsChartSource =
	| { kind: 'split'; breakdown: 'venue' | 'assetGroup' | 'baseAsset' }
	| { kind: 'contracts' }

export type RWAPerpsChartMetric = Extract<RWAOverviewChartMetric, 'openInterest' | 'volume'>

export function getRwaPerpsChartSource(groupBy: RWAGroupBy): RWAPerpsChartSource {
	switch (groupBy) {
		case 'platform':
		case 'chain':
		case 'category':
			return { kind: 'split', breakdown: 'venue' }
		case 'assetGroup':
			return { kind: 'split', breakdown: 'assetGroup' }
		case 'asset':
			return { kind: 'split', breakdown: 'baseAsset' }
		case 'none':
			return { kind: 'contracts' }
		default:
			return assertNever(groupBy)
	}
}

const PERPS_CHART_METRIC_OPTIONS: ReadonlyArray<{ key: RWAPerpsChartMetric; label: string }> = [
	{ key: 'openInterest', label: 'Open Interest' },
	{ key: 'volume', label: 'Volume' }
]

export function getRwaPerpsChartMetricOptions(): ReadonlyArray<{ key: RWAPerpsChartMetric; label: string }> {
	return PERPS_CHART_METRIC_OPTIONS
}

/** The Perps view reads the same `chartType` key as the Assets view; open interest is its default. */
export function parseRwaPerpsChartMetric(value: string | undefined): RWAPerpsChartMetric {
	return value === 'volume' ? 'volume' : 'openInterest'
}

export function getRwaPerpsChartMetricQueryValue(metric: RWAPerpsChartMetric): string | undefined {
	return metric === 'openInterest' ? undefined : metric
}

/** The flows split the front page reads for a Group by; None and Asset read the total, summed from one split. */
export function getRwaFlowSplitBy(groupBy: RWAGroupBy): RWAFlowOverviewSplitBy | null {
	switch (groupBy) {
		case 'platform':
		case 'chain':
		case 'assetGroup':
		case 'category':
			return groupBy
		case 'asset':
		case 'none':
			return null
		default:
			return assertNever(groupBy)
	}
}

export function getRwaChartGroupLabel(groupBy: RWAGroupBy): string {
	return GROUP_LABELS[groupBy]
}

export function getRwaChartFilterNote(origin: RWAChartDataOrigin, hasAttributeFilters: boolean): string | null {
	return origin === 'split' && hasAttributeFilters ? RWA_CHART_FILTER_NOTE : null
}

/** Share is a time series drawn as percent of the row, so it needs series that sum to a total. */
export function getRwaChartViewOptions(metric: RWAOverviewChartMetric): ReadonlyArray<RWAChartOption<RWAChartView>> {
	switch (metric) {
		case 'activeMcap':
		case 'onChainMcap':
		case 'defiActiveTvl':
			return getChartViewOptions()
		case 'openInterest':
			return getChartViewOptions().filter((option) => option.key === 'timeSeries' || option.key === 'share')
		case 'flows':
		case 'flowVsPrice':
		case 'volume':
			return getChartViewOptions().filter((option) => option.key === 'timeSeries')
		default:
			return assertNever(metric)
	}
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}
