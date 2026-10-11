import type { RWAFlowOverviewSplitBy } from './api.types'
import type { RWAChartAggregationMode } from './chartAggregation'
import { RWA_PERPS_TOTAL_LABELS } from './chartDataset'
import {
	getChartViewOptions,
	type RWAChartMetric,
	type RWAChartOption,
	type RWAChartView,
	type RwaTreemapParentGrouping
} from './chartState'
import type { RWAPerpsChartMetricKey } from './Perps/types'
import type { RWAGroupBy } from './table/groupBy'
import type { RwaPerpsChartScope } from './usePerpsChartDataset'

/** Every metric the overview panel can draw; open interest, volume and markets belong to the Perps pages. */
export type RWAOverviewChartMetric = RWASpotChartMetric | 'openInterest' | 'volume' | 'markets'
/** What the Assets chart panel draws: the tracked asset metrics and the flows. */
export type RWASpotChartMetric = RWAChartMetric | 'flows' | 'flowVsPrice'

/**
 * Where a spot time series comes from. `assets` folds the page's per-asset history by one attribute;
 * `chains` folds the per-chain asset histories, one series per chain, because the payload carries no chain axis.
 */
export type RWASpotChartSource =
	| {
			kind: 'assets'
			mode: Exclude<RWAChartAggregationMode, 'total' | 'assetClass'>
	  }
	| { kind: 'chains' }

const GROUP_LABELS: Record<RWAGroupBy, string> = {
	platform: 'Platform',
	chain: 'Chain',
	assetGroup: 'Asset Group',
	category: 'Category',
	assetClass: 'Asset Class',
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
		case 'assetClass':
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
		case 'assetClass':
		case 'none':
			return 'assetName'
		default:
			return assertNever(groupBy)
	}
}

/**
 * Where an unfiltered Perps time series comes from: a server split per venue, asset group or reference asset,
 * or the per-contract split folded to the largest contracts.
 */
export type RWAPerpsChartSource =
	| {
			kind: 'split'
			breakdown: 'venue' | 'assetGroup' | 'assetClass' | 'baseAsset'
	  }
	| { kind: 'contracts' }

export type RWAPerpsChartMetric = Extract<RWAOverviewChartMetric, 'openInterest' | 'volume' | 'markets'>

export function getRwaPerpsChartSource(groupBy: RWAGroupBy): RWAPerpsChartSource {
	switch (groupBy) {
		case 'platform':
		case 'chain':
		case 'category':
			return { kind: 'split', breakdown: 'venue' }
		case 'assetGroup':
			return { kind: 'split', breakdown: 'assetGroup' }
		case 'assetClass':
			return { kind: 'split', breakdown: 'assetClass' }
		case 'asset':
			return { kind: 'split', breakdown: 'baseAsset' }
		case 'none':
			return { kind: 'contracts' }
		default:
			return assertNever(groupBy)
	}
}

/**
 * Where the perps chart reads: the server split of the scope, or the per-market history folded in the browser by the
 * table's Group by when a filter other than Venue Type narrows the markets, or when an underlying's page groups its
 * markets, which the split routes do not serve.
 */
export function getRwaPerpsChartPlan({
	scope,
	groupBy,
	isFiltered
}: {
	scope: RwaPerpsChartScope
	groupBy: RWAGroupBy
	isFiltered: boolean
}): 'split' | 'fold' {
	return isFiltered || (scope.kind === 'baseAsset' && groupBy !== 'none') ? 'fold' : 'split'
}

/** What one member of a perps chart is, for the series picker, the treemap and the csv header. Perps pages offer no
    chain or category, and their split reads venue as `getRwaPerpsChartSource` does. */
export function getRwaPerpsGroupLabels(groupBy: RWAGroupBy): { one: string; many: string } {
	switch (groupBy) {
		case 'platform':
		case 'chain':
		case 'category':
			return { one: 'Venue', many: 'Venues' }
		case 'assetGroup':
			return { one: 'Asset Group', many: 'Asset Groups' }
		case 'assetClass':
			return { one: 'Asset Class', many: 'Asset Classes' }
		case 'asset':
			return { one: 'Asset', many: 'Assets' }
		case 'none':
			return { one: 'Market', many: 'Markets' }
		default:
			return assertNever(groupBy)
	}
}

const PERPS_CHART_METRIC_OPTIONS: ReadonlyArray<{
	key: RWAPerpsChartMetric
	label: string
}> = [
	{ key: 'openInterest', label: 'Open Interest' },
	{ key: 'volume', label: 'Volume' },
	{ key: 'markets', label: 'Markets' }
]

export function getRwaPerpsChartMetricOptions(): ReadonlyArray<{
	key: RWAPerpsChartMetric
	label: string
}> {
	return PERPS_CHART_METRIC_OPTIONS
}

export function getRwaPerpsMetricLabel(metric: RWAPerpsChartMetric): string {
	return PERPS_CHART_METRIC_OPTIONS.find((option) => option.key === metric)!.label
}

/** The Perps pages read the same `chartType` key as the Assets pages; open interest is their default. */
export function parseRwaPerpsChartMetric(value: string | undefined): RWAPerpsChartMetric {
	return value === 'volume' || value === 'markets' ? value : 'openInterest'
}

export function getRwaPerpsChartMetricQueryValue(metric: RWAPerpsChartMetric): string | undefined {
	return metric === 'openInterest' ? undefined : metric
}

/** The key the perps breakdown routes read; volume is the 24h series. */
export function getRwaPerpsChartServerKey(metric: RWAPerpsChartMetric): RWAPerpsChartMetricKey {
	return metric === 'volume' ? 'volume24h' : metric
}

/** Markets is a count of listings: the series sum per day into a Total, with no dollar sign. */
export function getRwaPerpsChartMetricSpec(metric: RWAPerpsChartMetric): {
	valueSymbol: string
	totalLabel: string
} {
	switch (metric) {
		case 'openInterest':
			return { valueSymbol: '$', totalLabel: RWA_PERPS_TOTAL_LABELS.openInterest }
		case 'volume':
			return { valueSymbol: '$', totalLabel: RWA_PERPS_TOTAL_LABELS.volume }
		case 'markets':
			return { valueSymbol: '', totalLabel: RWA_PERPS_TOTAL_LABELS.markets }
		default:
			return assertNever(metric)
	}
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
		case 'assetClass':
		case 'none':
			return null
		default:
			return assertNever(groupBy)
	}
}

export function getRwaChartGroupLabel(groupBy: RWAGroupBy): string {
	return GROUP_LABELS[groupBy]
}

/**
 * Share is a time series drawn as percent of the row, so it needs series that sum to a total. Pie, treemap and bar
 * read one value per group: a balance (open interest, markets, the spot metrics) on its latest day, a flow (volume)
 * over the picked period, as the chains-by-adapter charts on /dexs do. Flows chart in and out, so they keep the line.
 */
export function getRwaChartViewOptions(metric: RWAOverviewChartMetric): ReadonlyArray<RWAChartOption<RWAChartView>> {
	switch (metric) {
		case 'activeMcap':
		case 'onChainMcap':
		case 'defiActiveTvl':
		case 'openInterest':
		case 'markets':
		case 'volume':
			return getChartViewOptions()
		case 'flows':
		case 'flowVsPrice':
			return getChartViewOptions().filter((option) => option.key === 'timeSeries')
		default:
			return assertNever(metric)
	}
}

/** The venue chart reads the same `chartView` key; the legacy `bar` is the horizontal bar view. */
export function parseRwaPerpsChartView(metric: RWAPerpsChartMetric, value: string | undefined): RWAChartView {
	const key = value === 'bar' ? 'hbar' : value
	return getRwaChartViewOptions(metric).find((option) => option.key === key)?.key ?? 'timeSeries'
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}
