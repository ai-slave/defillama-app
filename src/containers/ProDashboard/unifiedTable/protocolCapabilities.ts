import type { UnifiedBooleanTableFilterKey, UnifiedNumericTableFilterKey, UnifiedTableConfig } from './config/current'
import { getFilteredShareMetricKey } from './config/filteredShareColumns'
import type { ProtocolTableMetrics } from './contracts'

export const PROTOCOL_POINT_METRICS = [
	'dex-volume',
	'fees',
	'revenue',
	'perps-volume',
	'aggregator-volume',
	'derivatives-aggregator-volume',
	'options-volume'
] as const

export type ProtocolPointMetric = (typeof PROTOCOL_POINT_METRICS)[number]

export const PROTOCOL_SUPPLEMENTAL_METRICS = ['earnings', 'bridge-aggregator-volume'] as const

export type ProtocolSupplementalMetric = (typeof PROTOCOL_SUPPLEMENTAL_METRICS)[number]

export const PROTOCOL_BASE_METRIC_FAMILIES = [
	'tvl',
	'dex-volume',
	'fees',
	'holder-revenue',
	'revenue',
	'perps-volume',
	'aggregator-volume',
	'derivatives-aggregator-volume',
	'options-volume',
	'open-interest',
	'market-cap',
	'bridged-tvl',
	'stablecoins',
	'protocol-count'
] as const

export type ProtocolBaseMetricFamily = (typeof PROTOCOL_BASE_METRIC_FAMILIES)[number]

export interface RequestedProtocolRatioDependencies {
	marketCap: boolean
	tvl: boolean
	fees: boolean
	revenue: boolean
}

export interface ProtocolMetricCapabilities {
	baseMetricFamilies: ProtocolBaseMetricFamily[]
	pointMetrics: ProtocolPointMetric[]
	supplementalMetrics: ProtocolSupplementalMetric[]
	requestedRatioDependencies: RequestedProtocolRatioDependencies
	needsOracleMembership: boolean
}

const BASE_METRIC_FAMILY_BY_COLUMN_ID = {
	tvl: 'tvl',
	tvlPrevDay: 'tvl',
	tvlPrevWeek: 'tvl',
	tvlPrevMonth: 'tvl',
	change1d: 'tvl',
	change7d: 'tvl',
	change1m: 'tvl',
	tvlShare: 'tvl',
	volume24h: 'dex-volume',
	volume_7d: 'dex-volume',
	volume_30d: 'dex-volume',
	cumulativeVolume: 'dex-volume',
	volumeChange_1d: 'dex-volume',
	volumeChange7dOver7d: 'dex-volume',
	volumeChange30dOver30d: 'dex-volume',
	volumeDominance_24h: 'dex-volume',
	volumeMarketShare7d: 'dex-volume',
	volume24hShare: 'dex-volume',
	fees24h: 'fees',
	fees_7d: 'fees',
	fees_30d: 'fees',
	fees_1y: 'fees',
	feesAnnualized1y: 'fees',
	average_1y: 'fees',
	cumulativeFees: 'fees',
	feesChange_1d: 'fees',
	feesChange7dOver7d: 'fees',
	feesChange30dOver30d: 'fees',
	holderRevenue_24h: 'holder-revenue',
	holderRevenue_7d: 'holder-revenue',
	holdersRevenue30d: 'holder-revenue',
	holderRevenueChange30dOver30d: 'holder-revenue',
	revenue24h: 'revenue',
	revenue_7d: 'revenue',
	revenue_30d: 'revenue',
	revenue_1y: 'revenue',
	revenueAnnualized1y: 'revenue',
	average_revenue_1y: 'revenue',
	cumulativeRevenue: 'revenue',
	revenueChange_1d: 'revenue',
	revenueChange7dOver7d: 'revenue',
	revenueChange30dOver30d: 'revenue',
	perpsVolume24h: 'perps-volume',
	perps_volume_7d: 'perps-volume',
	perps_volume_30d: 'perps-volume',
	perps_volume_change_1d: 'perps-volume',
	perpsVolumeChange7dOver7d: 'perps-volume',
	perpsVolumeChange30dOver30d: 'perps-volume',
	perps_volume_dominance_24h: 'perps-volume',
	aggregators_volume_24h: 'aggregator-volume',
	aggregators_volume_7d: 'aggregator-volume',
	aggregators_volume_30d: 'aggregator-volume',
	aggregators_volume_change_1d: 'aggregator-volume',
	aggregatorVolumeChange7dOver7d: 'aggregator-volume',
	aggregators_volume_dominance_24h: 'aggregator-volume',
	aggregators_volume_marketShare7d: 'aggregator-volume',
	derivatives_aggregators_volume_24h: 'derivatives-aggregator-volume',
	derivatives_aggregators_volume_7d: 'derivatives-aggregator-volume',
	derivatives_aggregators_volume_30d: 'derivatives-aggregator-volume',
	derivatives_aggregators_volume_change_1d: 'derivatives-aggregator-volume',
	derivativesAggregatorVolumeChange7dOver7d: 'derivatives-aggregator-volume',
	derivativesAggregatorVolumeChange30dOver30d: 'derivatives-aggregator-volume',
	options_volume_24h: 'options-volume',
	options_volume_7d: 'options-volume',
	options_volume_30d: 'options-volume',
	options_volume_change_1d: 'options-volume',
	optionsVolumeChange7dOver7d: 'options-volume',
	options_volume_dominance_24h: 'options-volume',
	openInterest: 'open-interest',
	mcap: 'market-cap',
	fdv: 'market-cap',
	mcaptvl: 'market-cap',
	pf: 'market-cap',
	ps: 'market-cap',
	bridgedTvl: 'bridged-tvl',
	stablesMcap: 'stablecoins',
	stablesShare: 'stablecoins',
	protocolCount: 'protocol-count'
} as const satisfies Readonly<Partial<Record<keyof ProtocolTableMetrics, ProtocolBaseMetricFamily>>>

const BASE_METRIC_FILTER_DEPENDENCIES: ReadonlyArray<{
	family: ProtocolBaseMetricFamily
	numericKeys?: readonly UnifiedNumericTableFilterKey[]
	booleanKeys?: readonly UnifiedBooleanTableFilterKey[]
}> = [
	{
		family: 'tvl',
		numericKeys: [
			'tvlMin',
			'tvlMax',
			'change1dMin',
			'change1dMax',
			'change7dMin',
			'change7dMax',
			'change1mMin',
			'change1mMax',
			'tvlShareMin',
			'tvlShareMax'
		],
		booleanKeys: ['hasMcapTVLRatio']
	},
	{
		family: 'dex-volume',
		numericKeys: [
			'volumeDex24hMin',
			'volumeDex24hMax',
			'volume7dMin',
			'volume7dMax',
			'volume30dMin',
			'volume30dMax',
			'volumeChange1dMin',
			'volumeChange1dMax',
			'volumeChange7dOver7dMin',
			'volumeChange7dOver7dMax',
			'volumeChange30dOver30dMin',
			'volumeChange30dOver30dMax',
			'volumeDominance24hMin',
			'volumeDominance24hMax',
			'volumeMarketShare7dMin',
			'volumeMarketShare7dMax'
		],
		booleanKeys: ['hasVolume']
	},
	{
		family: 'fees',
		numericKeys: [
			'fees24hMin',
			'fees24hMax',
			'fees7dMin',
			'fees7dMax',
			'fees30dMin',
			'fees30dMax',
			'fees1yMin',
			'fees1yMax',
			'feesChange1dMin',
			'feesChange1dMax',
			'feesChange7dOver7dMin',
			'feesChange7dOver7dMax',
			'feesChange30dOver30dMin',
			'feesChange30dOver30dMax',
			'pfRatioMin',
			'pfRatioMax'
		],
		booleanKeys: ['hasFees']
	},
	{
		family: 'holder-revenue',
		numericKeys: ['holderRevenue24hMin', 'holderRevenue24hMax'],
		booleanKeys: ['hasHolderRevenue']
	},
	{
		family: 'revenue',
		numericKeys: [
			'revenue24hMin',
			'revenue24hMax',
			'revenue7dMin',
			'revenue7dMax',
			'revenue30dMin',
			'revenue30dMax',
			'revenue1yMin',
			'revenue1yMax',
			'revenueChange1dMin',
			'revenueChange1dMax',
			'revenueChange7dOver7dMin',
			'revenueChange7dOver7dMax',
			'revenueChange30dOver30dMin',
			'revenueChange30dOver30dMax'
		],
		booleanKeys: ['hasRevenue']
	},
	{
		family: 'perps-volume',
		numericKeys: ['perpsVolumeDominance24hMin', 'perpsVolumeDominance24hMax'],
		booleanKeys: ['hasPerps']
	},
	{
		family: 'aggregator-volume',
		numericKeys: [
			'aggregatorsVolume24hMin',
			'aggregatorsVolume24hMax',
			'aggregatorsVolume7dMin',
			'aggregatorsVolume7dMax',
			'aggregatorsVolume30dMin',
			'aggregatorsVolume30dMax'
		],
		booleanKeys: ['hasAggregators']
	},
	{
		family: 'derivatives-aggregator-volume',
		numericKeys: [
			'derivativesAggregatorsVolume24hMin',
			'derivativesAggregatorsVolume24hMax',
			'derivativesAggregatorsVolume7dMin',
			'derivativesAggregatorsVolume7dMax',
			'derivativesAggregatorsVolume30dMin',
			'derivativesAggregatorsVolume30dMax'
		],
		booleanKeys: ['hasDerivativesAggregators']
	},
	{
		family: 'options-volume',
		numericKeys: ['optionsVolumeDominance24hMin', 'optionsVolumeDominance24hMax'],
		booleanKeys: ['hasOptions']
	},
	{ family: 'open-interest', booleanKeys: ['hasOpenInterest'] },
	{
		family: 'market-cap',
		numericKeys: ['mcapMin', 'mcapMax', 'pfRatioMin', 'pfRatioMax'],
		booleanKeys: ['hasMarketCap', 'hasMcapTVLRatio']
	},
	{
		family: 'bridged-tvl',
		numericKeys: ['bridgedTvlMin', 'bridgedTvlMax'],
		booleanKeys: ['hasBridgedTVL']
	},
	{
		family: 'stablecoins',
		numericKeys: ['stablesMcapMin', 'stablesMcapMax'],
		booleanKeys: ['hasStables']
	},
	{ family: 'protocol-count', numericKeys: ['protocolCountMin', 'protocolCountMax'] }
]

const POINT_METRIC_BY_COLUMN_ID = {
	volume24hChange7dAgo: 'dex-volume',
	volume24hChange30dAgo: 'dex-volume',
	fees24hChange7dAgo: 'fees',
	fees24hChange30dAgo: 'fees',
	revenue24hChange7dAgo: 'revenue',
	revenue24hChange30dAgo: 'revenue',
	perpsVolume24hChange7dAgo: 'perps-volume',
	perpsVolume24hChange30dAgo: 'perps-volume',
	aggregatorVolume24hChange7dAgo: 'aggregator-volume',
	aggregatorVolume24hChange30dAgo: 'aggregator-volume',
	derivativesAggregatorVolume24hChange7dAgo: 'derivatives-aggregator-volume',
	derivativesAggregatorVolume24hChange30dAgo: 'derivatives-aggregator-volume',
	optionsVolume24hChange7dAgo: 'options-volume',
	optionsVolume24hChange30dAgo: 'options-volume'
} as const satisfies Readonly<Partial<Record<keyof ProtocolTableMetrics, ProtocolPointMetric>>>

const POINT_METRIC_FILTER_DEPENDENCIES: ReadonlyArray<{
	metric: ProtocolPointMetric
	keys: readonly UnifiedNumericTableFilterKey[]
}> = [
	{
		metric: 'dex-volume',
		keys: ['volume24hChange7dAgoMin', 'volume24hChange7dAgoMax', 'volume24hChange30dAgoMin', 'volume24hChange30dAgoMax']
	},
	{
		metric: 'fees',
		keys: ['fees24hChange7dAgoMin', 'fees24hChange7dAgoMax', 'fees24hChange30dAgoMin', 'fees24hChange30dAgoMax']
	},
	{
		metric: 'revenue',
		keys: [
			'revenue24hChange7dAgoMin',
			'revenue24hChange7dAgoMax',
			'revenue24hChange30dAgoMin',
			'revenue24hChange30dAgoMax'
		]
	}
]

const PROTOCOL_POINT_METRIC_SET = new Set<string>(PROTOCOL_POINT_METRICS)
const PROTOCOL_SUPPLEMENTAL_METRIC_SET = new Set<string>(PROTOCOL_SUPPLEMENTAL_METRICS)
const PROTOCOL_BASE_METRIC_FAMILY_SET = new Set<string>(PROTOCOL_BASE_METRIC_FAMILIES)

const EARNINGS_METRICS = new Set<string>([
	'earnings24h',
	'earnings7d',
	'earnings30d',
	'earnings1y'
] as const satisfies readonly (keyof ProtocolTableMetrics)[])
const BRIDGE_AGGREGATOR_METRICS = new Set<string>([
	'bridgeAggregatorVolume24h',
	'bridgeAggregatorVolume7d',
	'bridgeAggregatorVolume30d',
	'bridgeAggregatorVolumeChange1d',
	'bridgeAggregatorVolume24hChange7dAgo',
	'bridgeAggregatorVolumeDominance24h'
] as const satisfies readonly (keyof ProtocolTableMetrics)[])

function isBaseMetricColumnId(columnId: string): columnId is keyof typeof BASE_METRIC_FAMILY_BY_COLUMN_ID {
	return Object.hasOwn(BASE_METRIC_FAMILY_BY_COLUMN_ID, columnId)
}

function isPointMetricColumnId(columnId: string): columnId is keyof typeof POINT_METRIC_BY_COLUMN_ID {
	return Object.hasOwn(POINT_METRIC_BY_COLUMN_ID, columnId)
}

export function isProtocolPointMetric(value: string): value is ProtocolPointMetric {
	return PROTOCOL_POINT_METRIC_SET.has(value)
}

export function isProtocolSupplementalMetric(value: string): value is ProtocolSupplementalMetric {
	return PROTOCOL_SUPPLEMENTAL_METRIC_SET.has(value)
}

export function isProtocolBaseMetricFamily(value: string): value is ProtocolBaseMetricFamily {
	return PROTOCOL_BASE_METRIC_FAMILY_SET.has(value)
}

function getSupplementalMetricForColumn(columnId: string): ProtocolSupplementalMetric | null {
	const metricId = getFilteredShareMetricKey(columnId) ?? columnId
	if (EARNINGS_METRICS.has(metricId)) return 'earnings'
	if (BRIDGE_AGGREGATOR_METRICS.has(metricId)) return 'bridge-aggregator-volume'
	return null
}

function addColumnPointMetric(metrics: Set<ProtocolPointMetric>, columnId: string): void {
	if (isPointMetricColumnId(columnId)) metrics.add(POINT_METRIC_BY_COLUMN_ID[columnId])
}

function addColumnBaseMetricFamily(metrics: Set<ProtocolBaseMetricFamily>, columnId: string): void {
	const metricId = getFilteredShareMetricKey(columnId) ?? columnId
	if (isBaseMetricColumnId(metricId)) metrics.add(BASE_METRIC_FAMILY_BY_COLUMN_ID[metricId])
	if (isPointMetricColumnId(metricId)) metrics.add(POINT_METRIC_BY_COLUMN_ID[metricId])
	if (metricId === 'mcaptvl') metrics.add('tvl')
	if (metricId === 'pf') metrics.add('fees')
	if (metricId === 'ps') metrics.add('revenue')
}

function expressionVariables(expression: string): string[] {
	return expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
}

export function getProtocolMetricCapabilities(config: UnifiedTableConfig): ProtocolMetricCapabilities {
	const families = new Set<ProtocolBaseMetricFamily>()
	const pointMetrics = new Set<ProtocolPointMetric>()
	const supplementalMetrics = new Set<ProtocolSupplementalMetric>()
	let needsOracleMembership = Boolean(config.filters?.oracles?.length)
	const visibility = config.columnVisibility ?? {}
	const addColumn = (columnId: string) => {
		if (columnId === 'oracles') needsOracleMembership = true
		addColumnBaseMetricFamily(families, columnId)
		addColumnPointMetric(pointMetrics, columnId)
		const supplementalMetric = getSupplementalMetricForColumn(columnId)
		if (supplementalMetric) supplementalMetrics.add(supplementalMetric)
	}

	for (const columnId of config.columnOrder ?? []) {
		if (visibility[columnId] !== false) addColumn(columnId)
	}
	for (const columnId in visibility) {
		if (visibility[columnId]) addColumn(columnId)
	}
	for (const { id } of config.defaultSorting ?? []) addColumn(id)
	for (const column of config.customColumns ?? []) {
		if (visibility[column.id] === false) continue
		for (const variable of expressionVariables(column.expression)) addColumn(variable)
	}
	for (const dependency of BASE_METRIC_FILTER_DEPENDENCIES) {
		const numericRequested = dependency.numericKeys?.some((key) => config.filters?.[key] !== undefined) ?? false
		const booleanRequested = dependency.booleanKeys?.some((key) => config.filters?.[key] === true) ?? false
		if (numericRequested || booleanRequested) families.add(dependency.family)
	}
	for (const dependency of POINT_METRIC_FILTER_DEPENDENCIES) {
		if (dependency.keys.some((key) => config.filters?.[key] !== undefined)) {
			families.add(dependency.metric)
			pointMetrics.add(dependency.metric)
		}
	}

	return {
		baseMetricFamilies: PROTOCOL_BASE_METRIC_FAMILIES.filter((family) => families.has(family)),
		pointMetrics: PROTOCOL_POINT_METRICS.filter((metric) => pointMetrics.has(metric)),
		supplementalMetrics: PROTOCOL_SUPPLEMENTAL_METRICS.filter((metric) => supplementalMetrics.has(metric)),
		needsOracleMembership,
		requestedRatioDependencies: {
			marketCap: families.has('market-cap'),
			tvl: families.has('tvl'),
			fees: families.has('fees'),
			revenue: families.has('revenue')
		}
	}
}
