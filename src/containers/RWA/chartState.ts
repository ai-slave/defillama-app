import type { ParsedUrlQuery } from 'node:querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'

export type RWAChartMetric = 'activeMcap' | 'onChainMcap' | 'defiActiveTvl'
export type RWAChartView = 'timeSeries' | 'share' | 'pie' | 'treemap' | 'hbar'
/** The axis the pie, treemap and bar views read; the overview maps the table's Group by onto it. */
export type RwaTreemapParentGrouping = 'chain' | 'category' | 'assetClass' | 'assetName' | 'platform' | 'assetGroup'
export type RwaTreemapNestedBy = 'none' | 'assetClass' | 'assetName' | 'category'
export type RWAChartOption<T extends string> = { key: T; name: string }
export type RWAChartMetricAvailability = { hasActiveMcapData: boolean }

/** The chart's own state; the breakdown is the table's Group by and lives in `groupBy`. */
export type RWAChartState = {
	view: RWAChartView
	metric: RWAChartMetric
	treemapNestedBy: RwaTreemapNestedBy
}

const CHART_VIEW_OPTIONS: ReadonlyArray<RWAChartOption<RWAChartView>> = [
	{ key: 'timeSeries', name: 'Time Series Chart' },
	{ key: 'share', name: 'Share Chart' },
	{ key: 'pie', name: 'Pie Chart' },
	{ key: 'treemap', name: 'Treemap Chart' },
	{ key: 'hbar', name: 'HBar Chart' }
]

const CHART_METRIC_OPTIONS: ReadonlyArray<{ key: RWAChartMetric; label: string }> = [
	{ key: 'activeMcap', label: 'Active Mcap' },
	{ key: 'onChainMcap', label: 'Onchain Mcap' },
	{ key: 'defiActiveTvl', label: 'DeFi Active TVL' }
]

const TREEMAP_NESTED_BY_LABELS: Record<RwaTreemapNestedBy, string> = {
	none: 'No Grouping',
	assetClass: 'Asset Class',
	assetName: 'Asset Name',
	category: 'Asset Category'
}

const TREEMAP_NESTED_BY_OPTIONS: Record<RwaTreemapParentGrouping, ReadonlyArray<RwaTreemapNestedBy>> = {
	chain: ['none', 'assetName'],
	category: ['none', 'assetClass', 'assetName'],
	assetClass: ['none', 'assetName'],
	assetName: ['none'],
	platform: ['none', 'assetName'],
	assetGroup: ['none', 'assetClass', 'assetName', 'category']
}

const TREEMAP_DEFAULT_NESTED_BY: Record<RwaTreemapParentGrouping, RwaTreemapNestedBy> = {
	chain: 'none',
	category: 'assetClass',
	assetClass: 'none',
	assetName: 'none',
	platform: 'none',
	assetGroup: 'none'
}

const DEFAULT_CHART_VIEW: RWAChartView = 'timeSeries'
const DEFAULT_CHART_METRIC: RWAChartMetric = 'activeMcap'
const FALLBACK_CHART_METRIC: RWAChartMetric = 'onChainMcap'
const AVAILABLE_BY_DEFAULT: RWAChartMetricAvailability = { hasActiveMcapData: true }

// Platforms whose whole supply sits in `holdersToRemove` wallets have no activeMcap series at all
// (e.g. Crypto.com), so the metric is dropped rather than rendered as an empty chart.
export function getDefaultChartMetric(availability: RWAChartMetricAvailability = AVAILABLE_BY_DEFAULT): RWAChartMetric {
	return availability.hasActiveMcapData ? DEFAULT_CHART_METRIC : FALLBACK_CHART_METRIC
}

function isChartMetricAvailable(metric: RWAChartMetric, availability: RWAChartMetricAvailability): boolean {
	return metric === 'activeMcap' ? availability.hasActiveMcapData : true
}
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

export function getChartViewOptions(): ReadonlyArray<RWAChartOption<RWAChartView>> {
	return CHART_VIEW_OPTIONS
}

export function getChartMetricOptions(
	availability: RWAChartMetricAvailability = AVAILABLE_BY_DEFAULT
): ReadonlyArray<{ key: RWAChartMetric; label: string }> {
	if (availability.hasActiveMcapData) return CHART_METRIC_OPTIONS
	return CHART_METRIC_OPTIONS.filter((option) => isChartMetricAvailable(option.key, availability))
}

export function getChartMetricLabel(metric: RWAChartMetric): string {
	const option = CHART_METRIC_OPTIONS.find(({ key }) => key === metric)
	assert(option, `Missing chart metric label for ${metric}`)
	return option.label
}

export function getTreemapNestedByLabel(nestedBy: RwaTreemapNestedBy): string {
	return TREEMAP_NESTED_BY_LABELS[nestedBy]
}

export function getTreemapNestedByOptions(
	parentGrouping: RwaTreemapParentGrouping
): Array<RWAChartOption<RwaTreemapNestedBy>> {
	return TREEMAP_NESTED_BY_OPTIONS[parentGrouping].map((key) => ({
		key,
		name: TREEMAP_NESTED_BY_LABELS[key]
	}))
}

export function parseRwaChartState(
	query: ParsedUrlQuery,
	{
		treemapParentGrouping,
		availability = AVAILABLE_BY_DEFAULT
	}: { treemapParentGrouping: RwaTreemapParentGrouping; availability?: RWAChartMetricAvailability }
): RWAChartState {
	const view = normalizeChartView(readSingleQueryValue(query.chartView))
	const metric = normalizeChartMetric(readSingleQueryValue(query.chartType), availability)
	const treemapNestedBy = normalizeTreemapNestedBy(treemapParentGrouping, readSingleQueryValue(query.treemapNestedBy))
	return { view, metric, treemapNestedBy }
}

export function setTreemapNestedBy(
	state: RWAChartState,
	parentGrouping: RwaTreemapParentGrouping,
	nestedBy: RwaTreemapNestedBy
): RWAChartState {
	const allowedNestedBy = TREEMAP_NESTED_BY_OPTIONS[parentGrouping]
	assert(allowedNestedBy.includes(nestedBy), `Invalid treemap nested-by ${nestedBy} for ${parentGrouping}`)
	return { ...state, treemapNestedBy: nestedBy }
}

export function getChartViewQueryValue(view: RWAChartView): string | undefined {
	return view === DEFAULT_CHART_VIEW ? undefined : view
}

export function getChartMetricQueryValue(
	metric: RWAChartMetric,
	availability: RWAChartMetricAvailability = AVAILABLE_BY_DEFAULT
): string | undefined {
	return metric === getDefaultChartMetric(availability) ? undefined : metric
}

export function getTreemapNestedByQueryValue(
	state: RWAChartState,
	parentGrouping: RwaTreemapParentGrouping
): string | undefined {
	const defaultNestedBy = TREEMAP_DEFAULT_NESTED_BY[parentGrouping]
	if (state.treemapNestedBy === defaultNestedBy) return undefined
	return state.treemapNestedBy
}

function normalizeChartView(value: string | undefined): RWAChartView {
	if (value === 'bar') return 'hbar'
	const matchedView = CHART_VIEW_OPTIONS.find((option) => option.key === value)?.key
	if (matchedView) return matchedView
	return DEFAULT_CHART_VIEW
}

function normalizeChartMetric(value: string | undefined, availability: RWAChartMetricAvailability): RWAChartMetric {
	const matchedMetric = CHART_METRIC_OPTIONS.find((option) => option.key === value)?.key
	if (matchedMetric && isChartMetricAvailable(matchedMetric, availability)) return matchedMetric
	return getDefaultChartMetric(availability)
}

function normalizeTreemapNestedBy(
	parentGrouping: RwaTreemapParentGrouping,
	value: string | undefined
): RwaTreemapNestedBy {
	const allowedNestedBy = TREEMAP_NESTED_BY_OPTIONS[parentGrouping]
	const matchedNestedBy = allowedNestedBy.find((nestedBy) => nestedBy === value)
	if (matchedNestedBy) return matchedNestedBy
	return TREEMAP_DEFAULT_NESTED_BY[parentGrouping]
}
