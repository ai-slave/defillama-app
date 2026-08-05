import { getPercentChange } from '~/utils'
import { toInternalSlug } from '~/utils/chainNormalizer'
import type {
	ParentProtocolMetrics,
	ProtocolTableMetrics,
	ProtocolTableSourceRow
} from '../../../unifiedTable/contracts'
import {
	PROTOCOL_BASE_METRIC_FAMILIES,
	PROTOCOL_POINT_METRICS,
	PROTOCOL_SUPPLEMENTAL_METRICS,
	type ProtocolBaseMetricFamily,
	type ProtocolMetricCapabilities,
	type ProtocolPointMetric,
	type ProtocolSupplementalMetric
} from '../../../unifiedTable/protocolCapabilities'

const computeMarketCapToAnnualizedMetricRatio = (
	marketCap: number | null | undefined,
	annualizedMetric: number | null | undefined
): number | null => {
	if (marketCap == null || annualizedMetric == null || annualizedMetric === 0) {
		return null
	}
	return marketCap / annualizedMetric
}

const hasMetricContributor = (metrics: ProtocolTableMetrics, keys: readonly (keyof ProtocolTableMetrics)[]) => {
	for (const key of keys) {
		const value = metrics[key]
		if (value != null && value !== 0) return true
	}
	return false
}

function sumUniqueValues(values: ReadonlyMap<string, number>): number | null {
	if (values.size === 0) return null
	let total = 0
	for (const value of values.values()) total += value
	return total
}

interface ChangeAccumulator {
	currentTotal: number
	previousTotal: number
	hasContributor: boolean
	isInvalid: boolean
}

interface PercentChangeDefinition {
	family: ProtocolBaseMetricFamily | ProtocolSupplementalMetric
	changeKey: keyof ProtocolTableMetrics
	currentKey: keyof ProtocolTableMetrics
	broaderPeriodKeys: readonly (keyof ProtocolTableMetrics)[]
}

interface PreviousValueChangeDefinition {
	family?: ProtocolPointMetric | ProtocolSupplementalMetric
	changeKey: keyof ProtocolTableMetrics
	currentKey: keyof ProtocolTableMetrics
	previousKey: keyof ProtocolTableMetrics
}

const PERCENT_CHANGE_DEFINITIONS: readonly PercentChangeDefinition[] = [
	{ family: 'dex-volume', changeKey: 'volumeChange_1d', currentKey: 'volume24h', broaderPeriodKeys: ['volume_7d'] },
	{
		family: 'dex-volume',
		changeKey: 'volumeChange7dOver7d',
		currentKey: 'volume_7d',
		broaderPeriodKeys: ['volume_30d']
	},
	{
		family: 'dex-volume',
		changeKey: 'volumeChange30dOver30d',
		currentKey: 'volume_30d',
		broaderPeriodKeys: ['cumulativeVolume']
	},
	{ family: 'fees', changeKey: 'feesChange_1d', currentKey: 'fees24h', broaderPeriodKeys: ['fees_7d'] },
	{ family: 'fees', changeKey: 'feesChange7dOver7d', currentKey: 'fees_7d', broaderPeriodKeys: ['fees_30d'] },
	{ family: 'fees', changeKey: 'feesChange30dOver30d', currentKey: 'fees_30d', broaderPeriodKeys: ['fees_1y'] },
	{
		family: 'holder-revenue',
		changeKey: 'holderRevenueChange30dOver30d',
		currentKey: 'holdersRevenue30d',
		broaderPeriodKeys: ['holderRevenue_24h', 'holderRevenue_7d']
	},
	{ family: 'revenue', changeKey: 'revenueChange_1d', currentKey: 'revenue24h', broaderPeriodKeys: ['revenue_7d'] },
	{
		family: 'revenue',
		changeKey: 'revenueChange7dOver7d',
		currentKey: 'revenue_7d',
		broaderPeriodKeys: ['revenue_30d']
	},
	{
		family: 'revenue',
		changeKey: 'revenueChange30dOver30d',
		currentKey: 'revenue_30d',
		broaderPeriodKeys: ['revenue_1y']
	},
	{
		family: 'perps-volume',
		changeKey: 'perps_volume_change_1d',
		currentKey: 'perpsVolume24h',
		broaderPeriodKeys: ['perps_volume_7d']
	},
	{
		family: 'perps-volume',
		changeKey: 'perpsVolumeChange7dOver7d',
		currentKey: 'perps_volume_7d',
		broaderPeriodKeys: ['perps_volume_30d']
	},
	{
		family: 'perps-volume',
		changeKey: 'perpsVolumeChange30dOver30d',
		currentKey: 'perps_volume_30d',
		broaderPeriodKeys: []
	},
	{
		family: 'aggregator-volume',
		changeKey: 'aggregators_volume_change_1d',
		currentKey: 'aggregators_volume_24h',
		broaderPeriodKeys: ['aggregators_volume_7d']
	},
	{
		family: 'aggregator-volume',
		changeKey: 'aggregatorVolumeChange7dOver7d',
		currentKey: 'aggregators_volume_7d',
		broaderPeriodKeys: ['aggregators_volume_30d']
	},
	{
		family: 'derivatives-aggregator-volume',
		changeKey: 'derivatives_aggregators_volume_change_1d',
		currentKey: 'derivatives_aggregators_volume_24h',
		broaderPeriodKeys: ['derivatives_aggregators_volume_7d']
	},
	{
		family: 'derivatives-aggregator-volume',
		changeKey: 'derivativesAggregatorVolumeChange7dOver7d',
		currentKey: 'derivatives_aggregators_volume_7d',
		broaderPeriodKeys: ['derivatives_aggregators_volume_30d']
	},
	{
		family: 'derivatives-aggregator-volume',
		changeKey: 'derivativesAggregatorVolumeChange30dOver30d',
		currentKey: 'derivatives_aggregators_volume_30d',
		broaderPeriodKeys: []
	},
	{
		family: 'bridge-aggregator-volume',
		changeKey: 'bridgeAggregatorVolumeChange1d',
		currentKey: 'bridgeAggregatorVolume24h',
		broaderPeriodKeys: ['bridgeAggregatorVolume7d']
	},
	{
		family: 'options-volume',
		changeKey: 'options_volume_change_1d',
		currentKey: 'options_volume_24h',
		broaderPeriodKeys: ['options_volume_7d']
	},
	{
		family: 'options-volume',
		changeKey: 'optionsVolumeChange7dOver7d',
		currentKey: 'options_volume_7d',
		broaderPeriodKeys: ['options_volume_30d']
	}
]

const POINT_CHANGE_DEFINITIONS: readonly PreviousValueChangeDefinition[] = [
	{ family: 'dex-volume', changeKey: 'volume24hChange7dAgo', currentKey: 'volume24h', previousKey: 'volume24h7dAgo' },
	{ family: 'dex-volume', changeKey: 'volume24hChange30dAgo', currentKey: 'volume24h', previousKey: 'volume24h30dAgo' },
	{ family: 'fees', changeKey: 'fees24hChange7dAgo', currentKey: 'fees24h', previousKey: 'fees24h7dAgo' },
	{ family: 'fees', changeKey: 'fees24hChange30dAgo', currentKey: 'fees24h', previousKey: 'fees24h30dAgo' },
	{ family: 'revenue', changeKey: 'revenue24hChange7dAgo', currentKey: 'revenue24h', previousKey: 'revenue24h7dAgo' },
	{ family: 'revenue', changeKey: 'revenue24hChange30dAgo', currentKey: 'revenue24h', previousKey: 'revenue24h30dAgo' },
	{
		family: 'perps-volume',
		changeKey: 'perpsVolume24hChange7dAgo',
		currentKey: 'perpsVolume24h',
		previousKey: 'perpsVolume24h7dAgo'
	},
	{
		family: 'perps-volume',
		changeKey: 'perpsVolume24hChange30dAgo',
		currentKey: 'perpsVolume24h',
		previousKey: 'perpsVolume24h30dAgo'
	},
	{
		family: 'aggregator-volume',
		changeKey: 'aggregatorVolume24hChange7dAgo',
		currentKey: 'aggregators_volume_24h',
		previousKey: 'aggregatorVolume24h7dAgo'
	},
	{
		family: 'aggregator-volume',
		changeKey: 'aggregatorVolume24hChange30dAgo',
		currentKey: 'aggregators_volume_24h',
		previousKey: 'aggregatorVolume24h30dAgo'
	},
	{
		family: 'derivatives-aggregator-volume',
		changeKey: 'derivativesAggregatorVolume24hChange7dAgo',
		currentKey: 'derivatives_aggregators_volume_24h',
		previousKey: 'derivativesAggregatorVolume24h7dAgo'
	},
	{
		family: 'derivatives-aggregator-volume',
		changeKey: 'derivativesAggregatorVolume24hChange30dAgo',
		currentKey: 'derivatives_aggregators_volume_24h',
		previousKey: 'derivativesAggregatorVolume24h30dAgo'
	},
	{
		family: 'options-volume',
		changeKey: 'optionsVolume24hChange7dAgo',
		currentKey: 'options_volume_24h',
		previousKey: 'optionsVolume24h7dAgo'
	},
	{
		family: 'options-volume',
		changeKey: 'optionsVolume24hChange30dAgo',
		currentKey: 'options_volume_24h',
		previousKey: 'optionsVolume24h30dAgo'
	},
	{
		family: 'bridge-aggregator-volume',
		changeKey: 'bridgeAggregatorVolume24hChange7dAgo',
		currentKey: 'bridgeAggregatorVolume24h',
		previousKey: 'bridgeAggregatorVolume24h7dAgo'
	}
]

const TVL_CHANGE_DEFINITIONS: readonly PreviousValueChangeDefinition[] = [
	{ changeKey: 'change1d', currentKey: 'tvl', previousKey: 'tvlPrevDay' },
	{ changeKey: 'change7d', currentKey: 'tvl', previousKey: 'tvlPrevWeek' },
	{ changeKey: 'change1m', currentKey: 'tvl', previousKey: 'tvlPrevMonth' }
]

function emptyChangeAccumulator(): ChangeAccumulator {
	return { currentTotal: 0, previousTotal: 0, hasContributor: false, isInvalid: false }
}

function updatePercentChange(
	accumulator: ChangeAccumulator,
	definition: PercentChangeDefinition,
	metrics: ProtocolTableMetrics
): void {
	if (accumulator.isInvalid) return
	const current = metrics[definition.currentKey]
	if (current == null) {
		for (const key of definition.broaderPeriodKeys) {
			const broaderValue = metrics[key]
			if (broaderValue != null && broaderValue !== 0) {
				accumulator.isInvalid = true
				break
			}
		}
		return
	}

	const change = metrics[definition.changeKey]
	if (change == null) {
		if (current === 0) {
			for (const key of definition.broaderPeriodKeys) {
				const broaderValue = metrics[key]
				if (broaderValue != null && broaderValue !== 0) {
					accumulator.isInvalid = true
					return
				}
			}
			return
		}
		accumulator.isInvalid = true
		return
	}
	accumulator.hasContributor = true
	const denominator = 1 + change / 100
	if (!Number.isFinite(denominator) || denominator === 0) {
		accumulator.isInvalid = true
		return
	}
	accumulator.currentTotal += current
	accumulator.previousTotal += current / denominator
}

function updatePreviousValueChange(
	accumulator: ChangeAccumulator,
	definition: PreviousValueChangeDefinition,
	metrics: ProtocolTableMetrics
): void {
	if (accumulator.isInvalid) return
	const current = metrics[definition.currentKey]
	const previous = metrics[definition.previousKey]
	if (current == null) {
		if (previous != null) accumulator.isInvalid = true
		return
	}

	accumulator.hasContributor = true
	if (previous == null) {
		accumulator.isInvalid = true
		return
	}
	accumulator.currentTotal += current
	accumulator.previousTotal += previous
}

function finishChange(accumulator: ChangeAccumulator): number | null {
	return !accumulator.isInvalid && accumulator.hasContributor
		? getPercentChange(accumulator.currentTotal, accumulator.previousTotal)
		: null
}

interface AggregateMetricsOptions {
	excludeParentTvl: boolean
	marketValueScope?: 'economic-entity' | 'protocol'
	parentMetrics?: Readonly<Record<string, ParentProtocolMetrics>>
	aggregationPlan?: ProtocolAggregationPlan
}

interface ParentRowMembership {
	protocolIds: Set<string>
	chainSlugs: Set<string>
}

interface ParentSupplement<MetricKey extends keyof ProtocolTableMetrics> {
	childProtocolIds: string[]
	childProtocolIdsByChain: Record<string, string[]>
	metrics: Pick<ProtocolTableMetrics, MetricKey>
	metricsByChain: Record<string, Pick<ProtocolTableMetrics, MetricKey>>
}

function mergeParentSupplementTotals<MetricKey extends keyof ProtocolTableMetrics>(
	aggregated: ProtocolTableMetrics,
	rowsByParent: ReadonlyMap<string, ParentRowMembership>,
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>,
	getSupplement: (parent: ParentProtocolMetrics) => ParentSupplement<MetricKey> | undefined,
	keys: readonly MetricKey[]
): void {
	const invalidKeys = new Set<MetricKey>()

	for (const [parentId, membership] of rowsByParent) {
		const parent = parentMetrics[parentId]
		const source = parent ? getSupplement(parent) : undefined
		if (!source) continue
		const chainSlug = membership.chainSlugs.size === 1 ? membership.chainSlugs.values().next().value : undefined
		const sourceMetrics = chainSlug ? source.metricsByChain[chainSlug] : source.metrics
		const childProtocolIds = chainSlug ? source.childProtocolIdsByChain[chainSlug] : source.childProtocolIds
		const hasEveryChild =
			sourceMetrics !== undefined &&
			childProtocolIds !== undefined &&
			childProtocolIds.every((protocolId) => membership.protocolIds.has(protocolId))
		for (const key of keys) {
			const value = sourceMetrics?.[key]
			if (!hasEveryChild || value == null) {
				invalidKeys.add(key)
				continue
			}
			if (!invalidKeys.has(key)) aggregated[key] = (aggregated[key] ?? 0) + value
		}
	}
	for (const key of invalidKeys) aggregated[key] = null
}

function applyParentSupplements(
	aggregated: ProtocolTableMetrics,
	rows: ProtocolTableSourceRow[],
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>,
	includeEarnings: boolean,
	includeBridgeAggregatorVolume: boolean
): void {
	const rowsByParent = new Map<string, ParentRowMembership>()
	const economicProtocolIds = new Set<string>()
	for (const row of rows) {
		const parentId = row.parentProtocolId
		if (includeBridgeAggregatorVolume) economicProtocolIds.add(parentId ?? row.protocolId)
		if (!parentId) continue

		let membership = rowsByParent.get(parentId)
		if (!membership) {
			membership = { protocolIds: new Set<string>(), chainSlugs: new Set<string>() }
			rowsByParent.set(parentId, membership)
		}
		membership.protocolIds.add(row.protocolId)
		if (row.chain) membership.chainSlugs.add(toInternalSlug(row.chain))
	}

	if (includeEarnings) {
		mergeParentSupplementTotals(aggregated, rowsByParent, parentMetrics, (parent) => parent.supplements?.earnings, [
			'earnings24h',
			'earnings7d',
			'earnings30d',
			'earnings1y'
		])
	}
	if (!includeBridgeAggregatorVolume) return
	mergeParentSupplementTotals(
		aggregated,
		rowsByParent,
		parentMetrics,
		(parent) => parent.supplements?.bridgeAggregatorVolume,
		['bridgeAggregatorVolume24h', 'bridgeAggregatorVolume7d', 'bridgeAggregatorVolume30d']
	)

	if (economicProtocolIds.size !== 1) {
		aggregated.bridgeAggregatorVolumeChange1d = null
		aggregated.bridgeAggregatorVolume24hChange7dAgo = null
		aggregated.bridgeAggregatorVolumeDominance24h = null
		return
	}

	const parentId = rows[0]?.parentProtocolId
	if (!parentId) return
	const parentSource = parentMetrics[parentId]?.supplements?.bridgeAggregatorVolume
	if (!parentSource) return
	const membership = rowsByParent.get(parentId)
	if (!membership) return
	const chainSlug = membership.chainSlugs.size === 1 ? membership.chainSlugs.values().next().value : undefined
	const sourceMetrics = chainSlug ? parentSource.metricsByChain[chainSlug] : parentSource.metrics
	const childProtocolIds = chainSlug ? parentSource.childProtocolIdsByChain[chainSlug] : parentSource.childProtocolIds
	const hasEveryChild =
		sourceMetrics !== undefined &&
		childProtocolIds !== undefined &&
		childProtocolIds.every((protocolId) => membership.protocolIds.has(protocolId))
	for (const key of [
		'bridgeAggregatorVolumeChange1d',
		'bridgeAggregatorVolume24hChange7dAgo',
		'bridgeAggregatorVolumeDominance24h'
	] as const) {
		aggregated[key] = hasEveryChild ? (sourceMetrics[key] ?? null) : null
	}
}

function applyCanonicalParentOpenInterest(
	aggregated: ProtocolTableMetrics,
	rows: ProtocolTableSourceRow[],
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>
): void {
	type ParentOpenInterestMembership = ParentRowMembership & { allocatedOpenInterest: number }
	const rowsByParent = new Map<string, ParentOpenInterestMembership>()
	for (const row of rows) {
		if (!row.parentProtocolId) continue
		const membership = rowsByParent.get(row.parentProtocolId) ?? {
			protocolIds: new Set<string>(),
			chainSlugs: new Set<string>(),
			allocatedOpenInterest: 0
		}
		membership.protocolIds.add(row.protocolId)
		if (row.chain) membership.chainSlugs.add(toInternalSlug(row.chain))
		membership.allocatedOpenInterest += row.metrics.openInterest ?? 0
		rowsByParent.set(row.parentProtocolId, membership)
	}

	for (const [parentId, membership] of rowsByParent) {
		const source = parentMetrics[parentId]?.supplements?.openInterest
		if (!source) continue
		const chainSlug = membership.chainSlugs.size === 1 ? membership.chainSlugs.values().next().value : undefined
		const sourceMetrics = chainSlug ? source.metricsByChain[chainSlug] : source.metrics
		const childProtocolIds = chainSlug ? source.childProtocolIdsByChain[chainSlug] : source.childProtocolIds
		const hasEveryChild = childProtocolIds?.every((protocolId) => membership.protocolIds.has(protocolId)) ?? false
		const canonicalOpenInterest = sourceMetrics?.openInterest
		if (!hasEveryChild || canonicalOpenInterest == null) continue
		aggregated.openInterest = (aggregated.openInterest ?? 0) - membership.allocatedOpenInterest + canonicalOpenInterest
	}
}

const PARENT_TVL_KEYS = new Set<keyof ProtocolTableMetrics>(['tvl', 'tvlPrevDay', 'tvlPrevWeek', 'tvlPrevMonth'])
const SUM_METRIC_KEYS_BY_BASE_FAMILY = {
	tvl: ['tvl', 'tvlPrevDay', 'tvlPrevWeek', 'tvlPrevMonth'],
	'dex-volume': ['volume24h', 'volume_7d', 'volume_30d', 'cumulativeVolume'],
	fees: ['fees24h', 'fees_7d', 'fees_30d', 'fees_1y', 'feesAnnualized1y', 'average_1y', 'cumulativeFees'],
	'holder-revenue': ['holderRevenue_24h', 'holderRevenue_7d', 'holdersRevenue30d'],
	revenue: [
		'revenue24h',
		'revenue_7d',
		'revenue_30d',
		'revenue_1y',
		'revenueAnnualized1y',
		'average_revenue_1y',
		'cumulativeRevenue'
	],
	'perps-volume': ['perpsVolume24h', 'perps_volume_7d', 'perps_volume_30d'],
	'aggregator-volume': ['aggregators_volume_24h', 'aggregators_volume_7d', 'aggregators_volume_30d'],
	'derivatives-aggregator-volume': [
		'derivatives_aggregators_volume_24h',
		'derivatives_aggregators_volume_7d',
		'derivatives_aggregators_volume_30d'
	],
	'options-volume': ['options_volume_24h', 'options_volume_7d', 'options_volume_30d'],
	'open-interest': ['openInterest'],
	'market-cap': [],
	'bridged-tvl': ['bridgedTvl'],
	stablecoins: ['stablesMcap'],
	'protocol-count': []
} as const satisfies Record<ProtocolBaseMetricFamily, readonly (keyof ProtocolTableMetrics)[]>

const SUM_METRIC_KEYS_BY_SUPPLEMENT = {
	earnings: ['earnings24h', 'earnings7d', 'earnings30d', 'earnings1y'],
	'bridge-aggregator-volume': ['bridgeAggregatorVolume24h', 'bridgeAggregatorVolume7d', 'bridgeAggregatorVolume30d']
} as const satisfies Record<ProtocolSupplementalMetric, readonly (keyof ProtocolTableMetrics)[]>
const FEE_ANNUALIZED_CONTRIBUTOR_KEYS: readonly (keyof ProtocolTableMetrics)[] = [
	'fees24h',
	'fees_7d',
	'fees_30d',
	'fees_1y',
	'cumulativeFees',
	'feesAnnualized1y'
]
const REVENUE_ANNUALIZED_CONTRIBUTOR_KEYS: readonly (keyof ProtocolTableMetrics)[] = [
	'revenue24h',
	'revenue_7d',
	'revenue_30d',
	'revenue_1y',
	'cumulativeRevenue',
	'revenueAnnualized1y'
]
const ADDITIVE_SHARE_METRIC_KEYS_BY_BASE_FAMILY: Readonly<
	Partial<Record<ProtocolBaseMetricFamily, readonly (keyof ProtocolTableMetrics)[]>>
> = {
	tvl: ['tvlShare'],
	'dex-volume': ['volumeDominance_24h', 'volumeMarketShare7d', 'volume24hShare'],
	'perps-volume': ['perps_volume_dominance_24h'],
	'aggregator-volume': ['aggregators_volume_dominance_24h', 'aggregators_volume_marketShare7d'],
	'options-volume': ['options_volume_dominance_24h'],
	stablecoins: ['stablesShare']
}

export interface ProtocolAggregationPlan {
	sumMetricKeys: readonly (keyof ProtocolTableMetrics)[]
	percentChangeDefinitions: readonly PercentChangeDefinition[]
	pointChangeDefinitions: readonly PreviousValueChangeDefinition[]
	additiveShareMetricKeys: readonly (keyof ProtocolTableMetrics)[]
	includeTvlChanges: boolean
	includeFeesAnnualized: boolean
	includeRevenueAnnualized: boolean
	includeMarketValues: boolean
	includeMcapTvl: boolean
	includePf: boolean
	includePs: boolean
	includeProtocolCount: boolean
	includeCanonicalParentOpenInterest: boolean
	includeEarnings: boolean
	includeBridgeAggregatorVolume: boolean
}

export function buildProtocolAggregationPlan(capabilities: ProtocolMetricCapabilities): ProtocolAggregationPlan {
	const baseFamilies = new Set(capabilities.baseMetricFamilies)
	const supplementalMetrics = new Set(capabilities.supplementalMetrics)
	const requestedPercentFamilies = new Set<ProtocolBaseMetricFamily | ProtocolSupplementalMetric>([
		...capabilities.baseMetricFamilies,
		...capabilities.supplementalMetrics
	])
	const requestedPointFamilies = new Set<ProtocolPointMetric | ProtocolSupplementalMetric>([
		...capabilities.pointMetrics,
		...capabilities.supplementalMetrics
	])
	const sumMetricKeys: (keyof ProtocolTableMetrics)[] = []
	const additiveShareMetricKeys: (keyof ProtocolTableMetrics)[] = []
	for (const family of capabilities.baseMetricFamilies) {
		sumMetricKeys.push(...SUM_METRIC_KEYS_BY_BASE_FAMILY[family])
		additiveShareMetricKeys.push(...(ADDITIVE_SHARE_METRIC_KEYS_BY_BASE_FAMILY[family] ?? []))
	}
	for (const metric of capabilities.supplementalMetrics) {
		sumMetricKeys.push(...SUM_METRIC_KEYS_BY_SUPPLEMENT[metric])
	}
	return {
		sumMetricKeys,
		percentChangeDefinitions: PERCENT_CHANGE_DEFINITIONS.filter((definition) =>
			requestedPercentFamilies.has(definition.family)
		),
		pointChangeDefinitions: POINT_CHANGE_DEFINITIONS.filter(
			(definition) => definition.family !== undefined && requestedPointFamilies.has(definition.family)
		),
		additiveShareMetricKeys,
		includeTvlChanges: baseFamilies.has('tvl'),
		includeFeesAnnualized: baseFamilies.has('fees'),
		includeRevenueAnnualized: baseFamilies.has('revenue'),
		includeMarketValues: baseFamilies.has('market-cap'),
		includeMcapTvl: capabilities.requestedRatioDependencies.marketCap && capabilities.requestedRatioDependencies.tvl,
		includePf: capabilities.requestedRatioDependencies.marketCap && capabilities.requestedRatioDependencies.fees,
		includePs: capabilities.requestedRatioDependencies.marketCap && capabilities.requestedRatioDependencies.revenue,
		includeProtocolCount: baseFamilies.has('protocol-count'),
		includeCanonicalParentOpenInterest: baseFamilies.has('open-interest'),
		includeEarnings: supplementalMetrics.has('earnings'),
		includeBridgeAggregatorVolume: supplementalMetrics.has('bridge-aggregator-volume')
	}
}

const PROTOCOL_AGGREGATION_PLAN_CACHE_LIMIT = 64
const protocolAggregationPlanCache = new Map<string, ProtocolAggregationPlan>()

function getProtocolAggregationPlanKey(capabilities: ProtocolMetricCapabilities): string {
	const ratios = capabilities.requestedRatioDependencies
	return [
		capabilities.baseMetricFamilies.join('|'),
		capabilities.pointMetrics.join('|'),
		capabilities.supplementalMetrics.join('|'),
		ratios.marketCap ? '1' : '0',
		ratios.tvl ? '1' : '0',
		ratios.fees ? '1' : '0',
		ratios.revenue ? '1' : '0'
	].join(':')
}

export function getProtocolAggregationPlan(capabilities: ProtocolMetricCapabilities): ProtocolAggregationPlan {
	const key = getProtocolAggregationPlanKey(capabilities)
	const cached = protocolAggregationPlanCache.get(key)
	if (cached) {
		protocolAggregationPlanCache.delete(key)
		protocolAggregationPlanCache.set(key, cached)
		return cached
	}

	const plan = buildProtocolAggregationPlan(capabilities)
	protocolAggregationPlanCache.set(key, plan)
	if (protocolAggregationPlanCache.size > PROTOCOL_AGGREGATION_PLAN_CACHE_LIMIT) {
		const oldestKey = protocolAggregationPlanCache.keys().next().value
		if (oldestKey !== undefined) protocolAggregationPlanCache.delete(oldestKey)
	}
	return plan
}

export const FULL_PROTOCOL_AGGREGATION_PLAN = buildProtocolAggregationPlan({
	baseMetricFamilies: [...PROTOCOL_BASE_METRIC_FAMILIES],
	pointMetrics: [...PROTOCOL_POINT_METRICS],
	supplementalMetrics: [...PROTOCOL_SUPPLEMENTAL_METRICS],
	requestedRatioDependencies: { marketCap: true, tvl: true, fees: true, revenue: true },
	needsOracleMembership: true
})

export function aggregateMetrics(
	rows: ProtocolTableSourceRow[],
	options: AggregateMetricsOptions = { excludeParentTvl: false }
): ProtocolTableMetrics {
	const plan = options.aggregationPlan ?? FULL_PROTOCOL_AGGREGATION_PLAN
	const totals: Partial<Record<keyof ProtocolTableMetrics, number>> = {}
	const seen: Partial<Record<keyof ProtocolTableMetrics, boolean>> = {}
	let hasIncompleteFeesAnnualized1y = false
	let hasIncompleteRevenueAnnualized1y = false

	const protocolIds = plan.includeProtocolCount ? new Set<string>() : null
	const uniqueMcapValues = plan.includeMarketValues ? new Map<string, number>() : null
	const uniqueFdvValues = plan.includeMarketValues ? new Map<string, number>() : null
	const percentChanges = plan.percentChangeDefinitions.map((definition) => ({
		definition,
		accumulator: emptyChangeAccumulator()
	}))
	const pointChanges = plan.pointChangeDefinitions.map((definition) => ({
		definition,
		accumulator: emptyChangeAccumulator()
	}))
	const tvlChanges = plan.includeTvlChanges
		? TVL_CHANGE_DEFINITIONS.map((definition) => ({ definition, accumulator: emptyChangeAccumulator() }))
		: []
	const additiveShares: Array<{ key: keyof ProtocolTableMetrics; total: number; hasValue: boolean }> = []
	for (const key of plan.additiveShareMetricKeys) {
		additiveShares.push({ key, total: 0, hasValue: false })
	}

	for (const row of rows) {
		const { metrics } = row

		const protocolKey = row.protocolId
		protocolIds?.add(protocolKey)

		if (uniqueMcapValues && uniqueFdvValues) {
			let economicProtocolKey = protocolKey
			let marketMetrics: ProtocolTableMetrics | ParentProtocolMetrics | undefined = metrics
			if (options.marketValueScope !== 'protocol' && row.parentProtocolId !== null) {
				economicProtocolKey = row.parentProtocolId
				marketMetrics = options.parentMetrics?.[row.parentProtocolId]
			}
			if (marketMetrics?.mcap != null && !uniqueMcapValues.has(economicProtocolKey)) {
				uniqueMcapValues.set(economicProtocolKey, marketMetrics.mcap)
			}
			if (marketMetrics?.fdv != null && !uniqueFdvValues.has(economicProtocolKey)) {
				uniqueFdvValues.set(economicProtocolKey, marketMetrics.fdv)
			}
		}

		if (
			plan.includeFeesAnnualized &&
			metrics.feesAnnualized1y == null &&
			hasMetricContributor(metrics, FEE_ANNUALIZED_CONTRIBUTOR_KEYS)
		) {
			hasIncompleteFeesAnnualized1y = true
		}
		if (
			plan.includeRevenueAnnualized &&
			metrics.revenueAnnualized1y == null &&
			hasMetricContributor(metrics, REVENUE_ANNUALIZED_CONTRIBUTOR_KEYS)
		) {
			hasIncompleteRevenueAnnualized1y = true
		}

		for (const key of plan.sumMetricKeys) {
			if (options.excludeParentTvl && row.excludeTvlFromParent && PARENT_TVL_KEYS.has(key)) continue
			const value = metrics[key]
			if (value !== null && value !== undefined) {
				totals[key] = (totals[key] ?? 0) + value
				seen[key] = true
			}
		}

		for (const change of percentChanges) updatePercentChange(change.accumulator, change.definition, metrics)
		for (const change of pointChanges) updatePreviousValueChange(change.accumulator, change.definition, metrics)
		for (const share of additiveShares) {
			if (options.excludeParentTvl && row.excludeTvlFromParent && share.key === 'tvlShare') continue
			const value = metrics[share.key]
			if (value != null) {
				share.total += value
				share.hasValue = true
			}
		}
		if (!options.excludeParentTvl || !row.excludeTvlFromParent) {
			for (const change of tvlChanges) updatePreviousValueChange(change.accumulator, change.definition, metrics)
		}
	}

	const aggregated: ProtocolTableMetrics = {}

	for (const key of plan.sumMetricKeys) {
		aggregated[key] = seen[key] ? (totals[key] ?? null) : null
	}
	if (hasIncompleteFeesAnnualized1y) {
		aggregated.feesAnnualized1y = null
		aggregated.average_1y = null
	}
	if (hasIncompleteRevenueAnnualized1y) {
		aggregated.revenueAnnualized1y = null
		aggregated.average_revenue_1y = null
	}

	if (uniqueMcapValues && uniqueFdvValues) {
		aggregated.mcap = sumUniqueValues(uniqueMcapValues)
		aggregated.fdv = sumUniqueValues(uniqueFdvValues)
	}

	for (const change of percentChanges) {
		aggregated[change.definition.changeKey] = finishChange(change.accumulator)
	}

	for (const change of pointChanges) {
		aggregated[change.definition.changeKey] = finishChange(change.accumulator)
	}

	for (const share of additiveShares) {
		aggregated[share.key] = share.hasValue ? share.total : null
	}
	if (plan.includeBridgeAggregatorVolume) {
		aggregated.bridgeAggregatorVolumeDominance24h =
			rows.length === 1 ? (rows[0]?.metrics.bridgeAggregatorVolumeDominance24h ?? null) : null
	}
	if (options.parentMetrics && plan.includeCanonicalParentOpenInterest) {
		applyCanonicalParentOpenInterest(aggregated, rows, options.parentMetrics)
	}

	if (options.parentMetrics && (plan.includeEarnings || plan.includeBridgeAggregatorVolume)) {
		applyParentSupplements(
			aggregated,
			rows,
			options.parentMetrics,
			plan.includeEarnings,
			plan.includeBridgeAggregatorVolume
		)
	}

	for (const change of tvlChanges) {
		aggregated[change.definition.changeKey] = finishChange(change.accumulator)
	}

	if (plan.includeMcapTvl) {
		aggregated.mcaptvl =
			aggregated.mcap != null && aggregated.tvl != null && aggregated.tvl > 0 ? aggregated.mcap / aggregated.tvl : null
	}

	if (plan.includePf) {
		aggregated.pf = computeMarketCapToAnnualizedMetricRatio(aggregated.mcap, aggregated.feesAnnualized1y)
	}
	if (plan.includePs) {
		aggregated.ps = computeMarketCapToAnnualizedMetricRatio(aggregated.mcap, aggregated.revenueAnnualized1y)
	}

	if (protocolIds) aggregated.protocolCount = protocolIds.size > 0 ? protocolIds.size : null

	return aggregated
}
