import type { ParsedUrlQuery } from 'node:querystring'
import {
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type {
	RWAPerpsAssetNonTimeSeriesBreakdown,
	RWAPerpsAssetTimeSeriesBreakdown,
	RWAPerpsAssetTreemapBreakdown,
	RWAPerpsAssetGroupNonTimeSeriesBreakdown,
	RWAPerpsAssetGroupTimeSeriesBreakdown,
	RWAPerpsAssetGroupTreemapBreakdown,
	RWAPerpsChartMetricKey,
	RWAPerpsChartMode,
	RWAPerpsChartView,
	RWAPerpsOverviewNonTimeSeriesBreakdown,
	RWAPerpsOverviewTimeSeriesBreakdown,
	RWAPerpsOverviewTreemapBreakdown,
	RWAPerpsTimeSeriesMode,
	RWAPerpsTreemapNestedBy,
	RWAPerpsVenueNonTimeSeriesBreakdown,
	RWAPerpsVenueTimeSeriesBreakdown,
	RWAPerpsVenueTreemapBreakdown
} from './types'

export type RWAPerpsTimeSeriesBreakdown =
	| RWAPerpsOverviewTimeSeriesBreakdown
	| RWAPerpsVenueTimeSeriesBreakdown
	| RWAPerpsAssetGroupTimeSeriesBreakdown
	| RWAPerpsAssetTimeSeriesBreakdown
export type RWAPerpsNonTimeSeriesBreakdown =
	| RWAPerpsOverviewNonTimeSeriesBreakdown
	| RWAPerpsVenueNonTimeSeriesBreakdown
	| RWAPerpsAssetGroupNonTimeSeriesBreakdown
	| RWAPerpsAssetNonTimeSeriesBreakdown
export type RWAPerpsTreemapBreakdown =
	| RWAPerpsOverviewTreemapBreakdown
	| RWAPerpsVenueTreemapBreakdown
	| RWAPerpsAssetGroupTreemapBreakdown
	| RWAPerpsAssetTreemapBreakdown
export type RWAPerpsChartBreakdown =
	| RWAPerpsTimeSeriesBreakdown
	| RWAPerpsNonTimeSeriesBreakdown
	| RWAPerpsTreemapBreakdown

type RWAPerpsTimeSeriesBreakdownByMode = {
	overview: RWAPerpsOverviewTimeSeriesBreakdown
	venue: RWAPerpsVenueTimeSeriesBreakdown
	assetGroup: RWAPerpsAssetGroupTimeSeriesBreakdown
	asset: RWAPerpsAssetTimeSeriesBreakdown
}

type RWAPerpsNonTimeSeriesBreakdownByMode = {
	overview: RWAPerpsOverviewNonTimeSeriesBreakdown
	venue: RWAPerpsVenueNonTimeSeriesBreakdown
	assetGroup: RWAPerpsAssetGroupNonTimeSeriesBreakdown
	asset: RWAPerpsAssetNonTimeSeriesBreakdown
}

type RWAPerpsTreemapBreakdownByMode = {
	overview: RWAPerpsOverviewTreemapBreakdown
	venue: RWAPerpsVenueTreemapBreakdown
	assetGroup: RWAPerpsAssetGroupTreemapBreakdown
	asset: RWAPerpsAssetTreemapBreakdown
}

type RWAPerpsChartStateCommon = {
	metric: RWAPerpsChartMetricKey
	timeSeriesMode: RWAPerpsTimeSeriesMode
	treemapNestedBy: RWAPerpsTreemapNestedBy
}

export type RWAPerpsChartStateForMode<TMode extends RWAPerpsChartMode> = RWAPerpsChartStateCommon & { mode: TMode } & (
		| { view: 'timeSeries'; breakdown: RWAPerpsTimeSeriesBreakdownByMode[TMode] }
		| { view: 'pie' | 'hbar'; breakdown: RWAPerpsNonTimeSeriesBreakdownByMode[TMode] }
		| { view: 'treemap'; breakdown: RWAPerpsTreemapBreakdownByMode[TMode] }
	)

export type RWAPerpsChartState = {
	[TMode in RWAPerpsChartMode]: RWAPerpsChartStateForMode<TMode>
}[RWAPerpsChartMode]

export type RWAPerpsChartDefaults = {
	timeSeriesBreakdown?: RWAPerpsTimeSeriesBreakdown
}

export type RWAPerpsChartOption<T extends string> = {
	key: T
	name: string
}

export type RWAPerpsChartLabels = {
	openInterest: { label: string }
	markets: { label: string }
	venue: { label: string }
	assetClass: { label: string }
	baseAsset: { label: string }
	assetGroup: { label: string }
	contract: { label: string }
}

const CHART_VIEW_OPTIONS: ReadonlyArray<RWAPerpsChartOption<RWAPerpsChartView>> = [
	{ key: 'timeSeries', name: 'Time Series Chart' },
	{ key: 'pie', name: 'Pie Chart' },
	{ key: 'treemap', name: 'Treemap Chart' },
	{ key: 'hbar', name: 'HBar Chart' }
]

const TIME_SERIES_MODE_OPTIONS: ReadonlyArray<RWAPerpsChartOption<RWAPerpsTimeSeriesMode>> = [
	{ key: 'grouped', name: 'Grouped' },
	{ key: 'breakdown', name: 'Breakdown' }
]

const CHART_METRIC_KEYS: ReadonlyArray<RWAPerpsChartMetricKey> = ['openInterest', 'volume24h', 'markets']

const TIME_SERIES_BREAKDOWNS = {
	overview: ['assetGroup', 'baseAsset', 'venue', 'assetClass', 'contract'],
	venue: ['assetGroup', 'baseAsset', 'contract', 'assetClass'],
	assetGroup: ['baseAsset', 'venue', 'assetClass', 'contract'],
	asset: ['venue', 'contract']
} as const satisfies Record<RWAPerpsChartMode, ReadonlyArray<RWAPerpsTimeSeriesBreakdown>>

const NON_TIME_SERIES_BREAKDOWNS = {
	overview: ['assetGroup', 'baseAsset', 'venue', 'assetClass', 'contract'],
	venue: ['assetGroup', 'baseAsset', 'contract', 'assetClass'],
	assetGroup: ['baseAsset', 'venue', 'assetClass', 'contract'],
	asset: ['venue', 'contract']
} as const satisfies Record<RWAPerpsChartMode, ReadonlyArray<RWAPerpsNonTimeSeriesBreakdown>>

const TREEMAP_BREAKDOWNS = {
	overview: ['assetGroup', 'baseAsset', 'venue', 'assetClass', 'contract'],
	venue: ['assetGroup', 'baseAsset', 'assetClass', 'contract'],
	assetGroup: ['baseAsset', 'venue', 'assetClass', 'contract'],
	asset: ['venue', 'contract']
} as const satisfies Record<RWAPerpsChartMode, ReadonlyArray<RWAPerpsTreemapBreakdown>>

const TREEMAP_NESTED_BY_OPTIONS: Record<
	RWAPerpsChartMode,
	Partial<Record<RWAPerpsTreemapBreakdown, ReadonlyArray<RWAPerpsTreemapNestedBy>>>
> = {
	overview: {
		venue: ['none', 'assetClass', 'baseAsset', 'contract'],
		assetGroup: ['none', 'baseAsset', 'assetClass', 'contract'],
		assetClass: ['none', 'baseAsset', 'contract'],
		baseAsset: ['none', 'contract'],
		contract: ['none']
	},
	venue: {
		assetGroup: ['none', 'baseAsset', 'assetClass', 'contract'],
		assetClass: ['none', 'baseAsset', 'contract'],
		baseAsset: ['none', 'contract'],
		contract: ['none']
	},
	assetGroup: {
		venue: ['none', 'baseAsset', 'assetClass', 'contract'],
		assetClass: ['none', 'baseAsset', 'contract'],
		baseAsset: ['none', 'contract'],
		contract: ['none']
	},
	asset: {
		venue: ['none', 'contract'],
		contract: ['none']
	}
}

const DEFAULT_TREEMAP_NESTED_BY: Record<
	RWAPerpsChartMode,
	Partial<Record<RWAPerpsTreemapBreakdown, RWAPerpsTreemapNestedBy>>
> = {
	overview: {
		venue: 'assetClass',
		assetGroup: 'baseAsset',
		assetClass: 'baseAsset',
		baseAsset: 'contract',
		contract: 'none'
	},
	venue: {
		assetGroup: 'baseAsset',
		assetClass: 'baseAsset',
		baseAsset: 'contract',
		contract: 'none'
	},
	assetGroup: {
		venue: 'baseAsset',
		assetClass: 'baseAsset',
		baseAsset: 'contract',
		contract: 'none'
	},
	asset: {
		venue: 'contract',
		contract: 'none'
	}
}

export const DEFAULT_CHART_VIEW: RWAPerpsChartView = 'timeSeries'
const DEFAULT_CHART_METRIC: RWAPerpsChartMetricKey = 'openInterest'
const DEFAULT_TIME_SERIES_MODE: RWAPerpsTimeSeriesMode = 'breakdown'
const DEFAULT_TIME_SERIES_BREAKDOWN = {
	overview: 'assetGroup',
	venue: 'assetGroup',
	assetGroup: 'baseAsset',
	asset: 'venue'
} as const satisfies { [TMode in RWAPerpsChartMode]: RWAPerpsTimeSeriesBreakdownByMode[TMode] }
const DEFAULT_NON_TIME_SERIES_BREAKDOWN = {
	overview: 'assetGroup',
	venue: 'assetGroup',
	assetGroup: 'baseAsset',
	asset: 'venue'
} as const satisfies { [TMode in RWAPerpsChartMode]: RWAPerpsNonTimeSeriesBreakdownByMode[TMode] }
const DEFAULT_TREEMAP_BREAKDOWN = {
	overview: 'assetGroup',
	venue: 'assetGroup',
	assetGroup: 'baseAsset',
	asset: 'venue'
} as const satisfies { [TMode in RWAPerpsChartMode]: RWAPerpsTreemapBreakdownByMode[TMode] }
const DEFAULT_CHART_VIEW_BY_MODE: Record<RWAPerpsChartMode, RWAPerpsChartView> = {
	overview: DEFAULT_CHART_VIEW,
	venue: DEFAULT_CHART_VIEW,
	assetGroup: DEFAULT_CHART_VIEW,
	asset: DEFAULT_CHART_VIEW
}
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

export function getRWAPerpsChartViewOptions() {
	return CHART_VIEW_OPTIONS
}

export function getRWAPerpsTimeSeriesModeOptions() {
	return TIME_SERIES_MODE_OPTIONS
}

export function getDefaultRWAPerpsChartView(mode: RWAPerpsChartMode): RWAPerpsChartView {
	return DEFAULT_CHART_VIEW_BY_MODE[mode] ?? DEFAULT_CHART_VIEW
}

export function getRWAPerpsChartMetricOptions(labels: RWAPerpsChartLabels) {
	return CHART_METRIC_KEYS.map((key) => ({
		key,
		name: key === 'volume24h' ? 'Volume' : labels[key].label
	}))
}

export function getRWAPerpsChartMetricLabel(metric: RWAPerpsChartMetricKey, labels: RWAPerpsChartLabels) {
	const option = getRWAPerpsChartMetricOptions(labels).find((item) => item.key === metric)
	assert(option, `Missing RWA perps chart metric label for ${metric}`)
	return option.name
}

export function getRWAPerpsBreakdownLabel(breakdown: RWAPerpsChartBreakdown, labels: RWAPerpsChartLabels) {
	switch (breakdown) {
		case 'venue':
			return labels.venue.label
		case 'assetClass':
			return labels.assetClass.label
		case 'baseAsset':
			return labels.baseAsset.label
		case 'assetGroup':
			return labels.assetGroup.label
		case 'contract':
			return labels.contract.label
	}
}

export function getRWAPerpsTreemapNestedByLabel(nestedBy: RWAPerpsTreemapNestedBy, labels: RWAPerpsChartLabels) {
	switch (nestedBy) {
		case 'none':
			return 'No Grouping'
		case 'assetClass':
			return labels.assetClass.label
		case 'baseAsset':
			return labels.baseAsset.label
		case 'contract':
			return labels.contract.label
	}
}

export function getDefaultRWAPerpsChartBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'timeSeries',
	defaults?: RWAPerpsChartDefaults
): RWAPerpsTimeSeriesBreakdownByMode[TMode]
export function getDefaultRWAPerpsChartBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'treemap',
	defaults?: RWAPerpsChartDefaults
): RWAPerpsTreemapBreakdownByMode[TMode]
export function getDefaultRWAPerpsChartBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'pie' | 'hbar',
	defaults?: RWAPerpsChartDefaults
): RWAPerpsNonTimeSeriesBreakdownByMode[TMode]
export function getDefaultRWAPerpsChartBreakdown(
	mode: RWAPerpsChartMode,
	view: RWAPerpsChartView,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsChartBreakdown {
	if (view === 'timeSeries') {
		return (
			findOption(defaults?.timeSeriesBreakdown, TIME_SERIES_BREAKDOWNS[mode]) ?? DEFAULT_TIME_SERIES_BREAKDOWN[mode]
		)
	}
	if (view === 'treemap') return DEFAULT_TREEMAP_BREAKDOWN[mode]
	return DEFAULT_NON_TIME_SERIES_BREAKDOWN[mode]
}

export function getRWAPerpsChartBreakdownOptions({
	mode,
	view,
	labels
}: Pick<RWAPerpsChartState, 'mode' | 'view'> & {
	labels: RWAPerpsChartLabels
}): Array<RWAPerpsChartOption<RWAPerpsChartBreakdown>> {
	const options =
		view === 'timeSeries'
			? TIME_SERIES_BREAKDOWNS[mode]
			: view === 'treemap'
				? TREEMAP_BREAKDOWNS[mode]
				: NON_TIME_SERIES_BREAKDOWNS[mode]
	return options.map((key) => ({ key, name: getRWAPerpsBreakdownLabel(key, labels) }))
}

export function getRWAPerpsTreemapNestedByOptions(
	mode: RWAPerpsChartMode,
	breakdown: RWAPerpsTreemapBreakdown,
	labels: RWAPerpsChartLabels
): Array<RWAPerpsChartOption<RWAPerpsTreemapNestedBy>> {
	const options = TREEMAP_NESTED_BY_OPTIONS[mode][breakdown]
	assert(options, `Missing RWA perps treemap nested-by options for ${mode}/${breakdown}`)
	return options.map((key) => ({
		key,
		name: getRWAPerpsTreemapNestedByLabel(key, labels)
	}))
}

export function parseRWAPerpsChartState(
	query: ParsedUrlQuery,
	mode: RWAPerpsChartMode,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsChartState {
	const view = normalizeChartView(mode, readSingleQueryValue(query.chartView))
	return createRWAPerpsChartState({
		mode,
		view,
		metric: normalizeChartMetric(readSingleQueryValue(query.chartType)),
		breakdown: readSingleQueryValue(query[getBreakdownQueryKey(view)]),
		timeSeriesMode: normalizeTimeSeriesMode(readSingleQueryValue(query.timeSeriesMode)),
		treemapNestedBy: readSingleQueryValue(query.treemapNestedBy),
		...(defaults ? { defaults } : {})
	})
}

export function parseRWAPerpsVolumeGroupBy(value: string | Array<string> | null | undefined): LowercaseDwmGrouping {
	const normalizedValue = (Array.isArray(value) ? value[0] : value)?.toLowerCase()
	for (const option of DWM_GROUPING_OPTIONS_LOWERCASE) {
		if (option.value === normalizedValue) return option.value
	}
	return 'daily'
}

export function setRWAPerpsChartView(state: RWAPerpsChartState, value: string): RWAPerpsChartState {
	return createRWAPerpsChartState({
		mode: state.mode,
		view: normalizeChartView(state.mode, value),
		metric: state.metric,
		breakdown: state.breakdown,
		timeSeriesMode: state.timeSeriesMode,
		treemapNestedBy: state.treemapNestedBy
	})
}

export function setRWAPerpsChartBreakdown(state: RWAPerpsChartState, breakdown: string): RWAPerpsChartState {
	const allowedBreakdowns = getAllowedBreakdowns(state.mode, state.view)
	assert(
		findOption(breakdown, allowedBreakdowns),
		`Invalid RWA perps chart breakdown ${breakdown} for ${state.mode}/${state.view}`
	)
	return createRWAPerpsChartState({
		mode: state.mode,
		view: state.view,
		metric: state.metric,
		breakdown,
		timeSeriesMode: state.timeSeriesMode,
		treemapNestedBy: state.treemapNestedBy
	})
}

export function setRWAPerpsTreemapNestedBy(state: RWAPerpsChartState, nestedBy: string): RWAPerpsChartState {
	const treemapBreakdown =
		state.view === 'treemap' ? state.breakdown : getDefaultRWAPerpsChartBreakdown(state.mode, 'treemap')
	const allowedNestedBy = TREEMAP_NESTED_BY_OPTIONS[state.mode][treemapBreakdown]
	assert(allowedNestedBy, `Missing RWA perps treemap nested-by options for ${state.mode}/${treemapBreakdown}`)
	assert(
		findOption(nestedBy, allowedNestedBy),
		`Invalid RWA perps treemap nested-by ${nestedBy} for ${state.mode}/${treemapBreakdown}`
	)
	return createRWAPerpsChartState({
		mode: state.mode,
		view: state.view,
		metric: state.metric,
		breakdown: state.breakdown,
		timeSeriesMode: state.timeSeriesMode,
		treemapNestedBy: nestedBy
	})
}

export function setRWAPerpsTimeSeriesMode(
	state: RWAPerpsChartState,
	timeSeriesMode: RWAPerpsTimeSeriesMode
): RWAPerpsChartState {
	return { ...state, timeSeriesMode }
}
export function getRWAPerpsChartViewQueryValueForMode(mode: RWAPerpsChartMode, view: RWAPerpsChartView) {
	return view === getDefaultRWAPerpsChartView(mode) ? undefined : view
}

export function getRWAPerpsChartMetricQueryValue(metric: RWAPerpsChartMetricKey) {
	return metric === DEFAULT_CHART_METRIC ? undefined : metric
}

export function getRWAPerpsTimeSeriesModeQueryValue(timeSeriesMode: RWAPerpsTimeSeriesMode) {
	return timeSeriesMode === DEFAULT_TIME_SERIES_MODE ? undefined : timeSeriesMode
}

export function getRWAPerpsVolumeGroupByQueryValue(groupBy: LowercaseDwmGrouping) {
	return groupBy === 'daily' ? undefined : groupBy
}

export function getRWAPerpsChartBreakdownQueryValue(state: RWAPerpsChartState, defaults?: RWAPerpsChartDefaults) {
	switch (state.view) {
		case 'timeSeries':
			return state.breakdown === getDefaultRWAPerpsChartBreakdown(state.mode, state.view, defaults)
				? undefined
				: state.breakdown
		case 'treemap':
			return state.breakdown === getDefaultRWAPerpsChartBreakdown(state.mode, state.view, defaults)
				? undefined
				: state.breakdown
		case 'pie':
		case 'hbar':
			return state.breakdown === getDefaultRWAPerpsChartBreakdown(state.mode, state.view, defaults)
				? undefined
				: state.breakdown
	}
}

export function getRWAPerpsTreemapNestedByQueryValue(state: RWAPerpsChartState) {
	const treemapBreakdown =
		state.view === 'treemap' ? state.breakdown : getDefaultRWAPerpsChartBreakdown(state.mode, 'treemap')
	const defaultNestedBy = DEFAULT_TREEMAP_NESTED_BY[state.mode][treemapBreakdown]
	assert(defaultNestedBy, `Missing RWA perps treemap nested-by default for ${state.mode}/${treemapBreakdown}`)
	return state.treemapNestedBy === defaultNestedBy ? undefined : state.treemapNestedBy
}

type CreateRWAPerpsChartStateInput = {
	mode: RWAPerpsChartMode
	view: RWAPerpsChartView
	metric: RWAPerpsChartMetricKey
	breakdown: string | undefined
	timeSeriesMode: RWAPerpsTimeSeriesMode
	treemapNestedBy: string | undefined
	defaults?: RWAPerpsChartDefaults
}

function createRWAPerpsChartState(args: CreateRWAPerpsChartStateInput): RWAPerpsChartState {
	switch (args.mode) {
		case 'overview':
			return createRWAPerpsChartStateForMode({ ...args, mode: args.mode })
		case 'venue':
			return createRWAPerpsChartStateForMode({ ...args, mode: args.mode })
		case 'assetGroup':
			return createRWAPerpsChartStateForMode({ ...args, mode: args.mode })
		case 'asset':
			return createRWAPerpsChartStateForMode({ ...args, mode: args.mode })
	}
}

function createRWAPerpsChartStateForMode<TMode extends RWAPerpsChartMode>(
	args: Omit<CreateRWAPerpsChartStateInput, 'mode'> & { mode: TMode }
): RWAPerpsChartStateForMode<TMode> {
	const treemapBreakdown =
		args.view === 'treemap'
			? normalizeBreakdown(args.mode, 'treemap', args.breakdown, args.defaults)
			: getDefaultRWAPerpsChartBreakdown(args.mode, 'treemap')
	const common = {
		mode: args.mode,
		metric: args.metric,
		timeSeriesMode: args.timeSeriesMode,
		treemapNestedBy: normalizeTreemapNestedBy(args.mode, treemapBreakdown, args.treemapNestedBy)
	}
	if (args.view === 'timeSeries') {
		return {
			...common,
			view: args.view,
			breakdown: normalizeBreakdown(args.mode, args.view, args.breakdown, args.defaults)
		}
	}
	if (args.view === 'treemap') return { ...common, view: args.view, breakdown: treemapBreakdown }
	return {
		...common,
		view: args.view,
		breakdown: normalizeBreakdown(args.mode, args.view, args.breakdown, args.defaults)
	}
}

function getAllowedBreakdowns(mode: RWAPerpsChartMode, view: RWAPerpsChartView): ReadonlyArray<RWAPerpsChartBreakdown> {
	if (view === 'timeSeries') return TIME_SERIES_BREAKDOWNS[mode]
	if (view === 'treemap') return TREEMAP_BREAKDOWNS[mode]
	return NON_TIME_SERIES_BREAKDOWNS[mode]
}

function getBreakdownQueryKey(view: RWAPerpsChartView): 'timeSeriesChartBreakdown' | 'nonTimeSeriesChartBreakdown' {
	return view === 'timeSeries' ? 'timeSeriesChartBreakdown' : 'nonTimeSeriesChartBreakdown'
}

function normalizeChartView(mode: RWAPerpsChartMode, value: string | undefined): RWAPerpsChartView {
	if (value === 'bar') return 'hbar'
	for (const option of CHART_VIEW_OPTIONS) {
		if (option.key === value) return option.key
	}
	return getDefaultRWAPerpsChartView(mode)
}

function normalizeChartMetric(value: string | undefined): RWAPerpsChartMetricKey {
	for (const key of CHART_METRIC_KEYS) {
		if (key === value) return key
	}
	return DEFAULT_CHART_METRIC
}

function normalizeTimeSeriesMode(value: string | undefined): RWAPerpsTimeSeriesMode {
	for (const option of TIME_SERIES_MODE_OPTIONS) {
		if (option.key === value) return option.key
	}
	return DEFAULT_TIME_SERIES_MODE
}

function normalizeBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'timeSeries',
	value: string | undefined,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsTimeSeriesBreakdownByMode[TMode]
function normalizeBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'treemap',
	value: string | undefined,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsTreemapBreakdownByMode[TMode]
function normalizeBreakdown<TMode extends RWAPerpsChartMode>(
	mode: TMode,
	view: 'pie' | 'hbar',
	value: string | undefined,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsNonTimeSeriesBreakdownByMode[TMode]
function normalizeBreakdown(
	mode: RWAPerpsChartMode,
	view: RWAPerpsChartView,
	value: string | undefined,
	defaults?: RWAPerpsChartDefaults
): RWAPerpsChartBreakdown {
	const allowedBreakdowns = getAllowedBreakdowns(mode, view)
	const selectedBreakdown = findOption(value, allowedBreakdowns)
	if (selectedBreakdown) return selectedBreakdown
	if (view === 'timeSeries') return getDefaultRWAPerpsChartBreakdown(mode, view, defaults)
	if (view === 'treemap') return getDefaultRWAPerpsChartBreakdown(mode, view, defaults)
	return getDefaultRWAPerpsChartBreakdown(mode, view, defaults)
}

function normalizeTreemapNestedBy(
	mode: RWAPerpsChartMode,
	breakdown: RWAPerpsTreemapBreakdown,
	value: string | undefined
): RWAPerpsTreemapNestedBy {
	const allowedNestedBy = TREEMAP_NESTED_BY_OPTIONS[mode][breakdown]
	assert(allowedNestedBy, `Missing RWA perps treemap nested-by options for ${mode}/${breakdown}`)
	const selectedNestedBy = findOption(value, allowedNestedBy)
	if (selectedNestedBy) return selectedNestedBy

	const defaultNestedBy = DEFAULT_TREEMAP_NESTED_BY[mode][breakdown]
	assert(defaultNestedBy, `Missing RWA perps treemap nested-by default for ${mode}/${breakdown}`)
	return defaultNestedBy
}

function findOption<TValue extends string>(
	value: string | undefined,
	options: ReadonlyArray<TValue>
): TValue | undefined {
	for (const option of options) {
		if (option === value) return option
	}
	return undefined
}
