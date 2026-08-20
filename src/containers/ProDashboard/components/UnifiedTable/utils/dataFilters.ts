import { toInternalSlug } from '~/utils/chainNormalizer'
import type {
	UnifiedBooleanTableFilterKey,
	UnifiedNumericTableFilterKey,
	UnifiedTableFilters
} from '../../../unifiedTable/config/current'
import type {
	ChainMetrics,
	ParentProtocolMetrics,
	ProtocolTableMetrics,
	ProtocolTableSourceRow
} from '../../../unifiedTable/contracts'
import type { ProtocolTableRow } from '../types'

const normalize = (value: string | null | undefined) => value?.toLowerCase().trim()
const DAY_IN_SECONDS = 86_400

interface ProtocolFilterContext {
	getListedAt?: (protocolId: string) => number | undefined
	nowSeconds?: number
}

interface MetricRow {
	metrics: ProtocolTableMetrics
}

interface RangeFilterConfig {
	minKey: UnifiedNumericTableFilterKey
	maxKey: UnifiedNumericTableFilterKey
	getValue: (row: MetricRow) => number | null | undefined
}

interface PresenceFilterConfig {
	key: UnifiedBooleanTableFilterKey
	matches: (row: MetricRow) => boolean
}

const SOURCE_RANGE_FILTERS: readonly RangeFilterConfig[] = [
	{ minKey: 'tvlMin', maxKey: 'tvlMax', getValue: (row) => row.metrics.tvl },
	{ minKey: 'mcapMin', maxKey: 'mcapMax', getValue: (row) => row.metrics.mcap },
	{ minKey: 'volumeDex24hMin', maxKey: 'volumeDex24hMax', getValue: (row) => row.metrics.volume24h },
	{ minKey: 'volume7dMin', maxKey: 'volume7dMax', getValue: (row) => row.metrics.volume_7d },
	{ minKey: 'volume30dMin', maxKey: 'volume30dMax', getValue: (row) => row.metrics.volume_30d },
	{ minKey: 'volumeChange1dMin', maxKey: 'volumeChange1dMax', getValue: (row) => row.metrics.volumeChange_1d },
	{
		minKey: 'volume24hChange7dAgoMin',
		maxKey: 'volume24hChange7dAgoMax',
		getValue: (row) => row.metrics.volume24hChange7dAgo
	},
	{
		minKey: 'volume24hChange30dAgoMin',
		maxKey: 'volume24hChange30dAgoMax',
		getValue: (row) => row.metrics.volume24hChange30dAgo
	},
	{
		minKey: 'volumeChange7dOver7dMin',
		maxKey: 'volumeChange7dOver7dMax',
		getValue: (row) => row.metrics.volumeChange7dOver7d
	},
	{
		minKey: 'volumeChange30dOver30dMin',
		maxKey: 'volumeChange30dOver30dMax',
		getValue: (row) => row.metrics.volumeChange30dOver30d
	},
	{ minKey: 'fees24hMin', maxKey: 'fees24hMax', getValue: (row) => row.metrics.fees24h },
	{ minKey: 'fees7dMin', maxKey: 'fees7dMax', getValue: (row) => row.metrics.fees_7d },
	{ minKey: 'fees30dMin', maxKey: 'fees30dMax', getValue: (row) => row.metrics.fees_30d },
	{ minKey: 'fees1yMin', maxKey: 'fees1yMax', getValue: (row) => row.metrics.fees_1y },
	{ minKey: 'feesChange1dMin', maxKey: 'feesChange1dMax', getValue: (row) => row.metrics.feesChange_1d },
	{
		minKey: 'fees24hChange7dAgoMin',
		maxKey: 'fees24hChange7dAgoMax',
		getValue: (row) => row.metrics.fees24hChange7dAgo
	},
	{
		minKey: 'fees24hChange30dAgoMin',
		maxKey: 'fees24hChange30dAgoMax',
		getValue: (row) => row.metrics.fees24hChange30dAgo
	},
	{
		minKey: 'feesChange7dOver7dMin',
		maxKey: 'feesChange7dOver7dMax',
		getValue: (row) => row.metrics.feesChange7dOver7d
	},
	{
		minKey: 'feesChange30dOver30dMin',
		maxKey: 'feesChange30dOver30dMax',
		getValue: (row) => row.metrics.feesChange30dOver30d
	},
	{ minKey: 'revenue24hMin', maxKey: 'revenue24hMax', getValue: (row) => row.metrics.revenue24h },
	{ minKey: 'revenue7dMin', maxKey: 'revenue7dMax', getValue: (row) => row.metrics.revenue_7d },
	{ minKey: 'revenue30dMin', maxKey: 'revenue30dMax', getValue: (row) => row.metrics.revenue_30d },
	{ minKey: 'revenue1yMin', maxKey: 'revenue1yMax', getValue: (row) => row.metrics.revenue_1y },
	{ minKey: 'revenueChange1dMin', maxKey: 'revenueChange1dMax', getValue: (row) => row.metrics.revenueChange_1d },
	{
		minKey: 'revenue24hChange7dAgoMin',
		maxKey: 'revenue24hChange7dAgoMax',
		getValue: (row) => row.metrics.revenue24hChange7dAgo
	},
	{
		minKey: 'revenue24hChange30dAgoMin',
		maxKey: 'revenue24hChange30dAgoMax',
		getValue: (row) => row.metrics.revenue24hChange30dAgo
	},
	{
		minKey: 'revenueChange7dOver7dMin',
		maxKey: 'revenueChange7dOver7dMax',
		getValue: (row) => row.metrics.revenueChange7dOver7d
	},
	{
		minKey: 'revenueChange30dOver30dMin',
		maxKey: 'revenueChange30dOver30dMax',
		getValue: (row) => row.metrics.revenueChange30dOver30d
	},
	{ minKey: 'change1dMin', maxKey: 'change1dMax', getValue: (row) => row.metrics.change1d },
	{ minKey: 'change7dMin', maxKey: 'change7dMax', getValue: (row) => row.metrics.change7d },
	{ minKey: 'change1mMin', maxKey: 'change1mMax', getValue: (row) => row.metrics.change1m },
	{ minKey: 'pfRatioMin', maxKey: 'pfRatioMax', getValue: (row) => row.metrics.pf },
	{
		minKey: 'volumeDominance24hMin',
		maxKey: 'volumeDominance24hMax',
		getValue: (row) => row.metrics.volumeDominance_24h
	},
	{
		minKey: 'volumeMarketShare7dMin',
		maxKey: 'volumeMarketShare7dMax',
		getValue: (row) => row.metrics.volumeMarketShare7d
	},
	{
		minKey: 'perpsVolumeDominance24hMin',
		maxKey: 'perpsVolumeDominance24hMax',
		getValue: (row) => row.metrics.perps_volume_dominance_24h
	},
	{
		minKey: 'optionsVolumeDominance24hMin',
		maxKey: 'optionsVolumeDominance24hMax',
		getValue: (row) => row.metrics.options_volume_dominance_24h
	},
	{ minKey: 'holderRevenue24hMin', maxKey: 'holderRevenue24hMax', getValue: (row) => row.metrics.holderRevenue_24h },
	{
		minKey: 'aggregatorsVolume24hMin',
		maxKey: 'aggregatorsVolume24hMax',
		getValue: (row) => row.metrics.aggregators_volume_24h
	},
	{
		minKey: 'aggregatorsVolume7dMin',
		maxKey: 'aggregatorsVolume7dMax',
		getValue: (row) => row.metrics.aggregators_volume_7d
	},
	{
		minKey: 'aggregatorsVolume30dMin',
		maxKey: 'aggregatorsVolume30dMax',
		getValue: (row) => row.metrics.aggregators_volume_30d
	},
	{
		minKey: 'derivativesAggregatorsVolume24hMin',
		maxKey: 'derivativesAggregatorsVolume24hMax',
		getValue: (row) => row.metrics.derivatives_aggregators_volume_24h
	},
	{
		minKey: 'derivativesAggregatorsVolume7dMin',
		maxKey: 'derivativesAggregatorsVolume7dMax',
		getValue: (row) => row.metrics.derivatives_aggregators_volume_7d
	},
	{
		minKey: 'derivativesAggregatorsVolume30dMin',
		maxKey: 'derivativesAggregatorsVolume30dMax',
		getValue: (row) => row.metrics.derivatives_aggregators_volume_30d
	}
]

const READ_MODEL_RANGE_FILTERS: readonly RangeFilterConfig[] = [
	{ minKey: 'protocolCountMin', maxKey: 'protocolCountMax', getValue: (row) => row.metrics.protocolCount }
]

const CHAIN_RANGE_FILTERS: readonly RangeFilterConfig[] = [
	{ minKey: 'tvlShareMin', maxKey: 'tvlShareMax', getValue: (row) => row.metrics.tvlShare },
	{ minKey: 'stablesMcapMin', maxKey: 'stablesMcapMax', getValue: (row) => row.metrics.stablesMcap },
	{ minKey: 'bridgedTvlMin', maxKey: 'bridgedTvlMax', getValue: (row) => row.metrics.bridgedTvl }
]

const isPositive = (value: number | null | undefined) => value != null && value > 0

const SOURCE_PRESENCE_FILTERS: readonly PresenceFilterConfig[] = [
	{ key: 'hasPerps', matches: (row) => isPositive(row.metrics.perpsVolume24h) },
	{ key: 'hasOptions', matches: (row) => isPositive(row.metrics.options_volume_24h) },
	{ key: 'hasOpenInterest', matches: (row) => isPositive(row.metrics.openInterest) },
	{ key: 'hasVolume', matches: (row) => isPositive(row.metrics.volume24h) },
	{ key: 'hasFees', matches: (row) => isPositive(row.metrics.fees24h) },
	{ key: 'hasRevenue', matches: (row) => isPositive(row.metrics.revenue24h) },
	{ key: 'hasMarketCap', matches: (row) => row.metrics.mcap != null },
	{ key: 'hasAggregators', matches: (row) => isPositive(row.metrics.aggregators_volume_24h) },
	{
		key: 'hasDerivativesAggregators',
		matches: (row) => isPositive(row.metrics.derivatives_aggregators_volume_24h)
	},
	{ key: 'hasHolderRevenue', matches: (row) => isPositive(row.metrics.holderRevenue_24h) },
	{ key: 'hasMcapTVLRatio', matches: (row) => row.metrics.mcaptvl != null }
]

const CHAIN_PRESENCE_FILTERS: readonly PresenceFilterConfig[] = [
	{ key: 'hasBridgedTVL', matches: (row) => isPositive(row.metrics.bridgedTvl) },
	{ key: 'hasStables', matches: (row) => isPositive(row.metrics.stablesMcap) }
]

function applyMetricFilters<Row extends MetricRow>(
	rows: Row[],
	filters: UnifiedTableFilters,
	rangeConfigs: readonly RangeFilterConfig[],
	presenceConfigs: readonly PresenceFilterConfig[]
): Row[] {
	if (!hasRequestedRange(filters, rangeConfigs) && !hasRequestedPresence(filters, presenceConfigs)) return rows
	return rows.filter((row) => matchesMetricFilters(row, filters, rangeConfigs, presenceConfigs))
}

function matchesMetricFilters(
	row: MetricRow,
	filters: UnifiedTableFilters,
	rangeConfigs: readonly RangeFilterConfig[],
	presenceConfigs: readonly PresenceFilterConfig[]
): boolean {
	for (const { minKey, maxKey, getValue } of rangeConfigs) {
		const minValue = filters[minKey]
		const maxValue = filters[maxKey]
		if (minValue === undefined && maxValue === undefined) continue
		const value = getValue(row)
		if (minValue !== undefined && (value == null || value < minValue)) return false
		if (maxValue !== undefined && (value == null || value > maxValue)) return false
	}
	for (const config of presenceConfigs) {
		if (filters[config.key] === true && !config.matches(row)) return false
	}
	return true
}

function hasRequestedRange(filters: UnifiedTableFilters, configs: readonly RangeFilterConfig[]): boolean {
	return configs.some(({ minKey, maxKey }) => filters[minKey] !== undefined || filters[maxKey] !== undefined)
}

function hasRequestedPresence(filters: UnifiedTableFilters, configs: readonly PresenceFilterConfig[]): boolean {
	return configs.some(({ key }) => filters[key] === true)
}

export function hasProtocolSubsetFilters(filters?: UnifiedTableFilters): boolean {
	if (!filters) return false
	return (
		Boolean(filters.protocols?.length) ||
		Boolean(filters.categories?.length) ||
		Boolean(filters.excludedCategories?.length) ||
		Boolean(filters.oracles?.length) ||
		filters.protocolAgeDaysMin !== undefined ||
		filters.protocolAgeDaysMax !== undefined ||
		hasRequestedRange(filters, SOURCE_RANGE_FILTERS) ||
		hasRequestedPresence(filters, SOURCE_PRESENCE_FILTERS)
	)
}

export function filterRowsByConfig(
	rows: ProtocolTableSourceRow[],
	filters?: UnifiedTableFilters,
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>> = {},
	chainMetrics: Readonly<Record<string, ChainMetrics>> = {},
	context: ProtocolFilterContext = {}
): ProtocolTableSourceRow[] {
	if (!filters) return rows

	const protocolSet = new Set<string>()
	for (const protocol of filters.protocols ?? []) protocolSet.add(normalize(protocol) ?? '')
	const categorySet = new Set<string>()
	for (const category of filters.categories ?? []) categorySet.add(normalize(category) ?? '')
	const excludedCategorySet = new Set<string>()
	for (const category of filters.excludedCategories ?? []) excludedCategorySet.add(normalize(category) ?? '')
	// Saved filters can contain aliases while source rows use chain names.
	const chainSet = new Set<string>()
	for (const chain of filters.chains ?? []) chainSet.add(toInternalSlug(chain))
	const oracleSet = new Set<string>()
	for (const oracle of filters.oracles ?? []) oracleSet.add(normalize(oracle) ?? '')
	const hasMetricFilters =
		hasRequestedRange(filters, SOURCE_RANGE_FILTERS) || hasRequestedPresence(filters, SOURCE_PRESENCE_FILTERS)
	const hasChainMetricFilters =
		hasRequestedRange(filters, CHAIN_RANGE_FILTERS) || hasRequestedPresence(filters, CHAIN_PRESENCE_FILTERS)
	const hasProtocolAgeFilter =
		filters.protocolAgeDaysMin !== undefined || filters.protocolAgeDaysMax !== undefined
	const nowSeconds = context.nowSeconds ?? Date.now() / 1000

	return rows.filter((row) => {
		if (protocolSet.size > 0) {
			const protocolId = normalize(row.protocolId)
			const rowName = normalize(row.name)
			const parentName = normalize(row.parentProtocolName)
			if (
				(!protocolId || !protocolSet.has(protocolId)) &&
				(!rowName || !protocolSet.has(rowName)) &&
				(!parentName || !protocolSet.has(parentName))
			) {
				return false
			}
		}

		if (hasProtocolAgeFilter) {
			const listedAt = context.getListedAt?.(row.protocolId)
			if (listedAt === undefined || !Number.isFinite(listedAt) || listedAt <= 0) return false
			const ageDays = Math.max(0, (nowSeconds - listedAt) / DAY_IN_SECONDS)
			if (filters.protocolAgeDaysMin !== undefined && ageDays < filters.protocolAgeDaysMin) return false
			if (filters.protocolAgeDaysMax !== undefined && ageDays > filters.protocolAgeDaysMax) return false
		}

		const category = normalize(row.category)
		if (categorySet.size > 0 && (!category || !categorySet.has(category))) return false
		if (excludedCategorySet.size > 0 && category && excludedCategorySet.has(category)) return false

		if (chainSet.size > 0) {
			let matchesChain = row.chain ? chainSet.has(toInternalSlug(row.chain)) : false
			if (!matchesChain) {
				for (const chain of row.chains) {
					if (chainSet.has(toInternalSlug(chain))) {
						matchesChain = true
						break
					}
				}
			}
			if (!matchesChain) return false
		}

		if (oracleSet.size > 0) {
			let matchesOracle = false
			for (const oracle of row.oracles) {
				const normalizedOracle = normalize(oracle)
				if (normalizedOracle && oracleSet.has(normalizedOracle)) {
					matchesOracle = true
					break
				}
			}
			if (!matchesOracle && row.parentProtocolId) {
				for (const oracle of parentMetrics[row.parentProtocolId]?.oracles ?? []) {
					const normalizedOracle = normalize(oracle)
					if (normalizedOracle && oracleSet.has(normalizedOracle)) {
						matchesOracle = true
						break
					}
				}
			}
			if (!matchesOracle) return false
		}

		if (hasMetricFilters && !matchesMetricFilters(row, filters, SOURCE_RANGE_FILTERS, SOURCE_PRESENCE_FILTERS)) {
			return false
		}
		if (hasChainMetricFilters) {
			if (!row.chain) return false
			const canonical = chainMetrics[toInternalSlug(row.chain)]
			if (
				canonical?.availability !== 'available' ||
				!matchesMetricFilters(canonical, filters, CHAIN_RANGE_FILTERS, CHAIN_PRESENCE_FILTERS)
			) {
				return false
			}
		}
		return true
	})
}

export function filterReadModelRowsByConfig(
	rows: ProtocolTableRow[],
	filters?: UnifiedTableFilters
): ProtocolTableRow[] {
	if (!filters) return rows
	return applyMetricFilters(rows, filters, READ_MODEL_RANGE_FILTERS, [])
}
