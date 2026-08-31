import type { ParsedUrlQuery } from 'querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { RWAOverviewMode } from './constants'

export type RWAChartMetric = 'activeMcap' | 'onChainMcap' | 'defiActiveTvl'
export type RWAChartView = 'timeSeries' | 'pie' | 'treemap' | 'hbar'
export type RWAChartBreakdown = 'chain' | 'category' | 'assetClass' | 'assetName' | 'platform' | 'assetGroup'
export type RWATimeSeriesChartBreakdown = Exclude<RWAChartBreakdown, 'chain'>
export type RwaTreemapParentGrouping = RWAChartBreakdown
export type RwaTreemapNestedBy = 'none' | 'assetClass' | 'assetName' | 'category'
export type RWAChartOption<T extends string> = { key: T; name: string }
export type RWAChartMetricAvailability = { hasActiveMcapData: boolean }
export type RWAChartModeState =
	| { mode: 'chain'; canBreakdownByChain: boolean; timeSeriesDefaultBreakdown: RWATimeSeriesChartBreakdown }
	| { mode: 'category'; canBreakdownByChain: boolean; timeSeriesDefaultBreakdown: RWATimeSeriesChartBreakdown }
	| { mode: 'platform'; canBreakdownByChain: boolean; timeSeriesDefaultBreakdown: RWATimeSeriesChartBreakdown }
	| { mode: 'assetGroup'; canBreakdownByChain: boolean; timeSeriesDefaultBreakdown: RWATimeSeriesChartBreakdown }

export type RWAChartState = {
	mode: RWAChartModeState
	view: RWAChartView
	metric: RWAChartMetric
	breakdown: RWAChartBreakdown
	treemapNestedBy: RwaTreemapNestedBy
}

const CHART_VIEW_OPTIONS: ReadonlyArray<RWAChartOption<RWAChartView>> = [
	{ key: 'timeSeries', name: 'Time Series Chart' },
	{ key: 'pie', name: 'Pie Chart' },
	{ key: 'treemap', name: 'Treemap Chart' },
	{ key: 'hbar', name: 'HBar Chart' }
]

const CHART_METRIC_OPTIONS: ReadonlyArray<{ key: RWAChartMetric; label: string }> = [
	{ key: 'activeMcap', label: 'Active Mcap' },
	{ key: 'onChainMcap', label: 'Onchain Mcap' },
	{ key: 'defiActiveTvl', label: 'DeFi Active TVL' }
]

const BREAKDOWN_LABELS: Record<RWAChartBreakdown, string> = {
	chain: 'Chain',
	category: 'Asset Category',
	assetClass: 'Asset Class',
	assetName: 'Asset Name',
	platform: 'Asset Platform',
	assetGroup: 'Asset Group'
}

const TREEMAP_NESTED_BY_LABELS: Record<RwaTreemapNestedBy, string> = {
	none: 'No Grouping',
	assetClass: 'Asset Class',
	assetName: 'Asset Name',
	category: 'Asset Category'
}

const TIME_SERIES_BREAKDOWNS: Record<RWAOverviewMode, readonly RWAChartBreakdown[]> = {
	chain: ['assetGroup', 'category', 'assetClass', 'platform'],
	category: ['assetGroup', 'assetClass', 'platform'],
	platform: ['assetGroup', 'assetName', 'category', 'assetClass'],
	assetGroup: ['assetName', 'assetClass', 'platform', 'category']
}

const NON_TIME_SERIES_BREAKDOWNS: Record<
	RWAOverviewMode,
	{ withChain: readonly RWAChartBreakdown[]; withoutChain: readonly RWAChartBreakdown[] }
> = {
	chain: {
		withChain: ['assetGroup', 'category', 'assetClass', 'platform', 'chain'],
		withoutChain: ['assetGroup', 'category', 'assetClass', 'platform']
	},
	category: {
		withChain: ['assetGroup', 'assetClass', 'platform', 'chain'],
		withoutChain: ['assetGroup', 'assetClass', 'platform']
	},
	platform: {
		withChain: ['assetGroup', 'assetName', 'category', 'assetClass', 'chain'],
		withoutChain: ['assetGroup', 'assetName', 'category', 'assetClass']
	},
	assetGroup: {
		withChain: ['assetName', 'assetClass', 'platform', 'category', 'chain'],
		withoutChain: ['assetName', 'assetClass', 'platform', 'category']
	}
}

const NON_TIME_SERIES_DEFAULTS: Record<RWAOverviewMode, RWAChartBreakdown> = {
	chain: 'assetGroup',
	category: 'assetGroup',
	platform: 'assetGroup',
	assetGroup: 'assetName'
}

const TIME_SERIES_DEFAULTS: Record<RWAOverviewMode, RWATimeSeriesChartBreakdown> = {
	chain: 'assetGroup',
	category: 'assetGroup',
	platform: 'assetGroup',
	assetGroup: 'assetName'
}

const TREEMAP_NESTED_BY_OPTIONS: Record<RwaTreemapParentGrouping, readonly RwaTreemapNestedBy[]> = {
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

export function getRwaTimeSeriesDefaultBreakdown(
	mode: RWAOverviewMode,
	assetGroupSlug: string | null
): RWATimeSeriesChartBreakdown {
	if (mode === 'assetGroup' && assetGroupSlug === 'public-equities') return 'platform'
	return TIME_SERIES_DEFAULTS[mode]
}

export function createRwaChartModeState(
	mode: RWAOverviewMode,
	canBreakdownByChain: boolean,
	assetGroupSlug: string | null
): RWAChartModeState {
	const timeSeriesDefaultBreakdown = getRwaTimeSeriesDefaultBreakdown(mode, assetGroupSlug)
	switch (mode) {
		case 'chain':
			return { mode, canBreakdownByChain, timeSeriesDefaultBreakdown }
		case 'category':
			return { mode, canBreakdownByChain, timeSeriesDefaultBreakdown }
		case 'platform':
			return { mode, canBreakdownByChain, timeSeriesDefaultBreakdown }
		case 'assetGroup':
			return { mode, canBreakdownByChain, timeSeriesDefaultBreakdown }
		default:
			return assertNever(mode)
	}
}

export function getChartViewOptions(): readonly RWAChartOption<RWAChartView>[] {
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

export function getBreakdownLabel(breakdown: RWAChartBreakdown): string {
	return BREAKDOWN_LABELS[breakdown]
}

export function getTreemapNestedByLabel(nestedBy: RwaTreemapNestedBy): string {
	return TREEMAP_NESTED_BY_LABELS[nestedBy]
}

export function getDefaultChartBreakdown(mode: RWAChartModeState, view: RWAChartView): RWAChartBreakdown {
	if (view === 'timeSeries') return mode.timeSeriesDefaultBreakdown
	return NON_TIME_SERIES_DEFAULTS[mode.mode]
}

export function getChartBreakdownOptions(
	state: Pick<RWAChartState, 'mode' | 'view'>
): RWAChartOption<RWAChartBreakdown>[] {
	return getAllowedBreakdowns(state.mode, state.view).map((key) => ({
		key,
		name: BREAKDOWN_LABELS[key]
	}))
}

export function getTreemapParentGrouping(breakdown: RWAChartBreakdown): RwaTreemapParentGrouping {
	return breakdown
}

export function getTreemapNestedByOptions(
	parentGrouping: RwaTreemapParentGrouping
): RWAChartOption<RwaTreemapNestedBy>[] {
	return TREEMAP_NESTED_BY_OPTIONS[parentGrouping].map((key) => ({
		key,
		name: TREEMAP_NESTED_BY_LABELS[key]
	}))
}

export function parseRwaChartState(
	query: ParsedUrlQuery,
	mode: RWAChartModeState,
	availability: RWAChartMetricAvailability = AVAILABLE_BY_DEFAULT
): RWAChartState {
	const view = normalizeChartView(readSingleQueryValue(query.chartView))
	const metric = normalizeChartMetric(readSingleQueryValue(query.chartType), availability)
	const breakdownQueryKey = getBreakdownQueryKey(view)
	const breakdown = normalizeBreakdown(mode, view, readSingleQueryValue(query[breakdownQueryKey]))
	const treemapNestedBy = normalizeTreemapNestedBy(
		getTreemapParentGrouping(breakdown),
		readSingleQueryValue(query.treemapNestedBy)
	)

	return { mode, view, metric, breakdown, treemapNestedBy }
}

export function setChartView(state: RWAChartState, view: RWAChartView): RWAChartState {
	const breakdown = normalizeBreakdown(state.mode, view, state.breakdown)
	const treemapNestedBy = normalizeTreemapNestedBy(getTreemapParentGrouping(breakdown), state.treemapNestedBy)
	return { ...state, view, breakdown, treemapNestedBy }
}

export function setChartBreakdown(state: RWAChartState, breakdown: RWAChartBreakdown): RWAChartState {
	const allowedBreakdowns = getAllowedBreakdowns(state.mode, state.view)
	assert(
		allowedBreakdowns.includes(breakdown),
		`Invalid chart breakdown ${breakdown} for ${state.mode.mode}/${state.view}`
	)
	const treemapNestedBy = normalizeTreemapNestedBy(getTreemapParentGrouping(breakdown), state.treemapNestedBy)
	return { ...state, breakdown, treemapNestedBy }
}

export function setTreemapNestedBy(state: RWAChartState, nestedBy: RwaTreemapNestedBy): RWAChartState {
	const parentGrouping = getTreemapParentGrouping(state.breakdown)
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

export function getChartBreakdownQueryValue(state: RWAChartState): string | undefined {
	const defaultBreakdown = getDefaultChartBreakdown(state.mode, state.view)
	if (state.breakdown === defaultBreakdown) return undefined
	return state.breakdown
}

export function getTreemapNestedByQueryValue(state: RWAChartState): string | undefined {
	const defaultNestedBy = TREEMAP_DEFAULT_NESTED_BY[getTreemapParentGrouping(state.breakdown)]
	if (state.treemapNestedBy === defaultNestedBy) return undefined
	return state.treemapNestedBy
}

function getAllowedBreakdowns(mode: RWAChartModeState, view: RWAChartView): readonly RWAChartBreakdown[] {
	if (view === 'timeSeries') return TIME_SERIES_BREAKDOWNS[mode.mode]
	const options = NON_TIME_SERIES_BREAKDOWNS[mode.mode]
	return mode.canBreakdownByChain ? options.withChain : options.withoutChain
}

function getBreakdownQueryKey(view: RWAChartView): 'timeSeriesChartBreakdown' | 'nonTimeSeriesChartBreakdown' {
	return view === 'timeSeries' ? 'timeSeriesChartBreakdown' : 'nonTimeSeriesChartBreakdown'
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

function normalizeBreakdown(mode: RWAChartModeState, view: RWAChartView, value: string | undefined): RWAChartBreakdown {
	const allowedBreakdowns = getAllowedBreakdowns(mode, view)
	const matchedBreakdown = allowedBreakdowns.find((breakdown) => breakdown === value)
	if (matchedBreakdown) return matchedBreakdown
	return getDefaultChartBreakdown(mode, view)
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
