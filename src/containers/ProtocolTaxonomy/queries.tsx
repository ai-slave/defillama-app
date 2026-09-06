import { CHART_COLORS } from '~/constants/colors'
import {
	fetchAdapterChainChartData,
	fetchAdapterChainChartDataByChainBreakdown,
	fetchAdapterChainChartDataByProtocolBreakdown,
	fetchAdapterChainMetrics
} from '~/containers/AdapterMetrics/api'
import type { IAdapterBreakdownChartData, IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import {
	ADAPTER_DATA_TYPE_KEYS,
	ADAPTER_DATA_TYPES,
	ADAPTER_TYPES,
	ZERO_FEE_PERPS
} from '~/containers/AdapterMetrics/constants'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import {
	PROTOCOL_LIST_ADDITIVE_TVL_KEYS,
	isProtocolListTvlKey,
	type ParentProtocolLite,
	type ProtocolListAdditiveTvlKey,
	type ProtocolLite,
	type ProtocolsResponse
} from '~/containers/ProtocolLists/api.types'
import { getNDistinctColors, getPercentChange, slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import type { ICategoriesAndTags, ICategoriesAndTagsConfig, IChainMetadata } from '~/utils/metadata/types'
import { fetchCardBreakdownChart, fetchCategoriesSummary, fetchCategoryChart, fetchTagChart } from './api'
import type { CardBreakdownChartResponse, CategoriesSummaryResponse } from './api.types'
import {
	CARD_ISSUER_CATEGORY,
	HIDDEN_PARENT_TVL_BY_CATEGORY,
	PROTOCOL_TAXONOMY_BREAKDOWN_KEYS,
	getProtocolCategoryChartMetricLabel,
	getProtocolCategoryChartMetrics,
	protocolCategoryConfig,
	type ProtocolCategoryChartMetric,
	type ProtocolCategoryMetrics
} from './constants'
import type {
	IProtocolTaxonomyPageData,
	IProtocolsCategoriesChartData,
	IProtocolsCategoriesExtraTvlPoint,
	IProtocolsCategoriesPageData,
	IProtocolsCategoriesTableRow,
	ProtocolTaxonomyBreakdownKey,
	ProtocolTaxonomyChartRow,
	ProtocolTaxonomyCharts
} from './types'

type GetProtocolTaxonomyPageDataParams = {
	chain?: string
	categoriesAndTags: ICategoriesAndTags
	chainMetadata: Record<string, IChainMetadata>
} & (
	| {
			kind: 'category'
			category: string
			tag?: never
			tagCategory?: never
	  }
	| {
			kind: 'tag'
			tag: string
			tagCategory: string
			category?: never
	  }
)

const CHART_METRIC_SERIES_TYPE: Record<ProtocolCategoryChartMetric, 'line' | 'bar'> = {
	tvl: 'line',
	fees: 'bar',
	revenue: 'bar',
	dexVolume: 'bar',
	dexAggregatorsVolume: 'bar',
	perpVolume: 'bar',
	openInterest: 'line',
	optionsPremiumVolume: 'bar',
	optionsNotionalVolume: 'bar',
	borrowed: 'line',
	staking: 'line'
}

const CHART_METRIC_Y_AXIS_INDEX: Record<ProtocolCategoryChartMetric, number> = {
	tvl: 0,
	fees: 1,
	revenue: 1,
	dexVolume: 1,
	dexAggregatorsVolume: 1,
	perpVolume: 1,
	openInterest: 1,
	optionsPremiumVolume: 1,
	optionsNotionalVolume: 1,
	borrowed: 1,
	staking: 0
}

const FALLBACK_CHART_METRICS: Array<ProtocolCategoryChartMetric> = ['tvl']
const PROTOCOL_TAXONOMY_TVL_KEYS = [...PROTOCOL_LIST_ADDITIVE_TVL_KEYS, 'excludeParent'] as const
type AdapterMetricProtocol = IAdapterChainMetrics['protocols'][number]
type ProtocolTaxonomySource = {
	defillamaId: string
	name: string
	logo: string | null
	category?: string
	tags?: Array<string>
	chains: Array<string>
	chainTvls: Record<string, ChainTvlPoint>
	tvl?: number | null
	mcap: number | null
	parentProtocol?: string
	deprecated?: true
}
type ProtocolTaxonomyParent = Pick<ParentProtocolLite, 'id' | 'name' | 'logo' | 'chains' | 'mcap'>

const normalizeParentForTaxonomy = (parent: ParentProtocolLite): ProtocolTaxonomyParent => ({
	id: parent.id,
	name: parent.name,
	logo: parent.logo,
	chains: [...parent.chains],
	mcap: parent.mcap
})

const normalizeChartTimestamp = (timestamp: number) => (timestamp < 1e12 ? timestamp * 1e3 : timestamp)

const createTimeSeriesMap = (
	chartData: Array<[number, number | null]> | null | undefined
): Map<number, number | null> => {
	const chartMap = new Map<number, number | null>()

	for (const [timestamp, value] of chartData ?? []) {
		chartMap.set(normalizeChartTimestamp(timestamp), value ?? null)
	}

	return chartMap
}

const createTimeSeriesMapFromRecord = (
	chartData: Record<string | number, number | null> | undefined
): Map<number, number | null> => {
	const chartMap = new Map<number, number | null>()
	if (!chartData) return chartMap

	for (const timestamp in chartData) {
		const numericTimestamp = Number(timestamp)
		chartMap.set(normalizeChartTimestamp(numericTimestamp), chartData[timestamp] ?? null)
	}

	return chartMap
}

export const createFallbackProtocolFromAdapter = ({
	protocol,
	category,
	tag
}: {
	protocol: AdapterMetricProtocol
	category: string | undefined
	tag: string | undefined
}): ProtocolTaxonomySource => ({
	name: protocol.displayName,
	logo: protocol.logo,
	...(category ? { category } : protocol.category ? { category: protocol.category } : {}),
	...(tag ? { tags: [tag] } : {}),
	chains: protocol.chains,
	chainTvls: {},
	mcap: null,
	defillamaId: protocol.defillamaId,
	...(protocol.parentProtocol ? { parentProtocol: protocol.parentProtocol } : {})
})

export function mergeProtocolsWithAdapterFallback({
	protocols,
	parentProtocols,
	adapterProtocols,
	category,
	tag
}: {
	protocols: Array<ProtocolLite>
	parentProtocols: Array<ParentProtocolLite>
	adapterProtocols: Array<AdapterMetricProtocol>
	category: string | undefined
	tag: string | undefined
}): { protocols: Array<ProtocolTaxonomySource>; parentProtocols: Array<ProtocolTaxonomyParent> } {
	const mergedProtocols: Array<ProtocolTaxonomySource> = []
	for (const protocol of protocols) mergedProtocols.push(protocol)
	const protocolIds = new Set<string>()
	for (const protocol of protocols) protocolIds.add(protocol.defillamaId)
	const parentProtocolsMap = new Map<string, ProtocolTaxonomyParent>()
	for (const parentProtocol of parentProtocols) {
		parentProtocolsMap.set(parentProtocol.id, normalizeParentForTaxonomy(parentProtocol))
	}

	for (const protocol of adapterProtocols) {
		if (!protocolIds.has(protocol.defillamaId)) {
			mergedProtocols.push(createFallbackProtocolFromAdapter({ protocol, category, tag }))
			protocolIds.add(protocol.defillamaId)
		}

		if (!protocol.parentProtocol) continue

		const existingParentProtocol = parentProtocolsMap.get(protocol.parentProtocol)
		if (existingParentProtocol) {
			for (const chain of protocol.chains) {
				if (!existingParentProtocol.chains.includes(chain)) existingParentProtocol.chains.push(chain)
			}
			continue
		}
	}

	return {
		protocols: mergedProtocols,
		parentProtocols: Array.from(parentProtocolsMap.values())
	}
}

export const buildCategoryCharts = ({
	effectiveCategory,
	metrics,
	tvlChartData,
	feesChartData,
	revenueChartData,
	dexVolumeChartData,
	dexAggregatorsVolumeChartData,
	perpVolumeChartData,
	openInterestChartData,
	optionsPremiumVolumeChartData,
	optionsNotionalVolumeChartData,
	borrowedChartData,
	stakingChartData
}: {
	effectiveCategory: string | null
	metrics: Array<ProtocolCategoryChartMetric>
	tvlChartData: Array<[number, number | null]>
	feesChartData: Array<[number, number]> | null
	revenueChartData: Array<[number, number]> | null
	dexVolumeChartData: Array<[number, number]> | null
	dexAggregatorsVolumeChartData: Array<[number, number]> | null
	perpVolumeChartData: Array<[number, number]> | null
	openInterestChartData: Array<[number, number]> | null
	optionsPremiumVolumeChartData: Array<[number, number]> | null
	optionsNotionalVolumeChartData: Array<[number, number]> | null
	borrowedChartData: Record<string | number, number | null> | undefined
	stakingChartData: Record<string | number, number | null> | undefined
}): IProtocolTaxonomyPageData['charts'] => {
	const chartMapsByMetric: Record<ProtocolCategoryChartMetric, Map<number, number | null>> = {
		tvl: createTimeSeriesMap(tvlChartData),
		fees: createTimeSeriesMap(feesChartData),
		revenue: createTimeSeriesMap(revenueChartData),
		dexVolume: createTimeSeriesMap(dexVolumeChartData),
		dexAggregatorsVolume: createTimeSeriesMap(dexAggregatorsVolumeChartData),
		perpVolume: createTimeSeriesMap(perpVolumeChartData),
		openInterest: createTimeSeriesMap(openInterestChartData),
		optionsPremiumVolume: createTimeSeriesMap(optionsPremiumVolumeChartData),
		optionsNotionalVolume: createTimeSeriesMap(optionsNotionalVolumeChartData),
		borrowed: createTimeSeriesMapFromRecord(borrowedChartData),
		staking: createTimeSeriesMapFromRecord(stakingChartData)
	}

	const selectedMetrics = metrics.length > 0 ? metrics : FALLBACK_CHART_METRICS
	const activeMetrics = selectedMetrics.filter(
		(metric) => metric === 'tvl' || (chartMapsByMetric[metric]?.size ?? 0) > 0
	)
	const finalMetrics = activeMetrics

	const timestamps = new Set<number>()
	for (const metric of finalMetrics) {
		for (const timestamp of chartMapsByMetric[metric].keys()) {
			timestamps.add(timestamp)
		}
	}

	const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b)
	const metricLabels = finalMetrics.map((metric) => getProtocolCategoryChartMetricLabel(metric, effectiveCategory))
	const dimensions: IProtocolTaxonomyPageData['charts']['dataset']['dimensions'] = ['timestamp']
	dimensions.push(...metricLabels)
	const source: IProtocolTaxonomyPageData['charts']['dataset']['source'] = sortedTimestamps.map((timestamp) => {
		const row: IProtocolTaxonomyPageData['charts']['dataset']['source'][number] = [timestamp]
		for (const [index, metric] of finalMetrics.entries()) {
			row[index + 1] = chartMapsByMetric[metric].get(timestamp) ?? null
		}
		return row
	})

	return {
		dataset: {
			source,
			dimensions
		},
		charts: finalMetrics.map((metric, index) => {
			const dimension = getProtocolCategoryChartMetricLabel(metric, effectiveCategory)
			const color = CHART_COLORS[index]
			return {
				type: CHART_METRIC_SERIES_TYPE[metric],
				name: dimension,
				encode: { x: 0, y: index + 1 },
				...(color ? { color } : {}),
				yAxisIndex: CHART_METRIC_Y_AXIS_INDEX[metric],
				valueSymbol: '$'
			}
		})
	}
}

/**
 * Turns a `[timestamp, valueBySeriesName]` breakdown response into one stacked series per name,
 * ordered by all-time total so the largest contributors sit at the bottom of the stack.
 * Shared by the protocol, card-network, and custody breakdowns, which all use this shape.
 */
export const buildBreakdownCharts = (
	breakdownChartData: IAdapterBreakdownChartData | CardBreakdownChartResponse | null,
	stackId: string
): ProtocolTaxonomyCharts | null => {
	if (!breakdownChartData || breakdownChartData.length === 0) return null

	const totalByProtocol = new Map<string, number>()
	for (const [, valueByProtocol] of breakdownChartData) {
		for (const protocolName in valueByProtocol) {
			const value = valueByProtocol[protocolName] ?? 0
			totalByProtocol.set(protocolName, (totalByProtocol.get(protocolName) ?? 0) + value)
		}
	}

	const protocolNames: Array<string> = []
	for (const [protocolName, total] of Array.from(totalByProtocol.entries()).sort((a, b) => b[1] - a[1])) {
		if (total > 0) protocolNames.push(protocolName)
	}
	if (protocolNames.length === 0) return null

	const columnIndexByProtocol = new Map<string, number>()
	for (const [index, protocolName] of protocolNames.entries()) columnIndexByProtocol.set(protocolName, index + 1)

	const source: Array<ProtocolTaxonomyChartRow> = []
	for (const [timestamp, valueByProtocol] of breakdownChartData) {
		const row: ProtocolTaxonomyChartRow = [normalizeChartTimestamp(timestamp)]
		for (const _ of protocolNames) row.push(null)
		for (const protocolName in valueByProtocol) {
			const columnIndex = columnIndexByProtocol.get(protocolName)
			if (columnIndex === undefined) continue
			row[columnIndex] = (row[columnIndex] ?? 0) + (valueByProtocol[protocolName] ?? 0)
		}
		source.push(row)
	}
	source.sort((a, b) => a[0] - b[0])

	const colors = getNDistinctColors(protocolNames.length)

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...protocolNames]
		},
		charts: protocolNames.map((protocolName, index) => ({
			type: 'bar',
			name: protocolName,
			encode: { x: 0, y: index + 1 },
			stack: stackId,
			color: colors[index] ?? '#999999',
			valueSymbol: '$'
		}))
	}
}

/** Builds each present breakdown, dropping the keys whose upstream response was empty or unavailable. */
export const buildBreakdownChartsByKey = (
	responsesByKey: Partial<
		Record<ProtocolTaxonomyBreakdownKey, IAdapterBreakdownChartData | CardBreakdownChartResponse | null>
	>
): IProtocolTaxonomyPageData['breakdownCharts'] => {
	const breakdownCharts: IProtocolTaxonomyPageData['breakdownCharts'] = {}
	for (const key of PROTOCOL_TAXONOMY_BREAKDOWN_KEYS) {
		const built = buildBreakdownCharts(responsesByKey[key] ?? null, `${key}Breakdown`)
		if (built) breakdownCharts[key] = built
	}
	return breakdownCharts
}

type ProtocolTableRow = IProtocolTaxonomyPageData['protocols'][number]

type ProtocolMetricTotals = {
	total24h: number | null
	total7d: number | null
	total30d: number | null
}

type PerpMetricTotals = ProtocolMetricTotals & {
	doublecounted?: boolean
	zeroFeePerp?: boolean
}

type OpenInterestTotals = {
	total24h: number | null
}

const ZERO_PROTOCOL_METRIC_TOTALS: ProtocolMetricTotals = { total24h: 0, total7d: 0, total30d: 0 }
const ZERO_OPEN_INTEREST_TOTALS: OpenInterestTotals = { total24h: 0 }

type AdapterProtocolData = {
	chains: Array<string>
	fees?: ProtocolMetricTotals
	revenue?: ProtocolMetricTotals
	dexVolume?: ProtocolMetricTotals
	perpVolume?: PerpMetricTotals
	openInterest?: OpenInterestTotals
	optionsPremium?: ProtocolMetricTotals
	optionsNotional?: ProtocolMetricTotals
}

type ChainTvlPoint = {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

function getCategoryOrTagConfig({
	categoriesAndTags,
	category,
	tag,
	tagCategory
}: {
	categoriesAndTags: ICategoriesAndTags
	category: string | null | undefined
	tag: string | null | undefined
	tagCategory?: string | null
}): ICategoriesAndTagsConfig | null {
	if (category) return categoriesAndTags.configs[category] ?? null
	if (!tag) return null
	return categoriesAndTags.configs[tag] ?? (tagCategory ? (categoriesAndTags.configs[tagCategory] ?? null) : null)
}

function hasCategoryMetric({
	config,
	chain,
	chainMetadata,
	adapterType,
	dataType
}: {
	config: ICategoriesAndTagsConfig | null
	chain: string | undefined
	chainMetadata: IChainMetadata
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
}): boolean {
	if (chain && config?.chains != null && !config.chains.includes(chainMetadata.id)) return false

	const dataKey = ADAPTER_DATA_TYPE_KEYS[dataType]
	if (config?.dimAgg == null || dataKey == null) return true

	return config.dimAgg[adapterType]?.[dataKey] != null
}

export async function getProtocolTaxonomyPageData(
	params: GetProtocolTaxonomyPageDataParams
): Promise<IProtocolTaxonomyPageData | null> {
	const { chain, chainMetadata, categoriesAndTags } = params
	const category = params.kind === 'category' ? params.category : undefined
	const tag = params.kind === 'tag' ? params.tag : undefined
	const taxonomyName = params.kind === 'category' ? params.category : params.tag
	// For tag pages, we use the tag's parent category for category-specific logic.
	const effectiveCategory = params.kind === 'category' ? params.category : params.tagCategory
	const hiddenParentTvls = category ? HIDDEN_PARENT_TVL_BY_CATEGORY[category] : undefined
	const dimensionCategory = slug(taxonomyName)
	const config = effectiveCategory ? protocolCategoryConfig[effectiveCategory] : null
	const categoryMetrics: ProtocolCategoryMetrics | undefined = config?.metrics
	const chartMetrics = getProtocolCategoryChartMetrics(effectiveCategory)
	const hasCardBreakdowns = effectiveCategory === CARD_ISSUER_CATEGORY && !chain
	const categoryOrTagConfig = getCategoryOrTagConfig({
		categoriesAndTags,
		category,
		tag,
		tagCategory: params.kind === 'tag' ? params.tagCategory : null
	})

	const currentChainMetadata = chain
		? chainMetadata[slug(chain)]
		: {
				name: 'All',
				fees: true,
				dexs: true,
				dexAggregators: true,
				perps: true,
				openInterest: true,
				optionsPremiumVolume: true,
				optionsNotionalVolume: true,
				id: 'all'
			}

	if (!currentChainMetadata) {
		return null
	}

	const hasFees = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_FEES
	})
	const hasRevenue = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
	})
	const hasDexVolume = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.DEXS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
	})
	const hasDexAggregatorsVolume = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.AGGREGATORS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
	})
	const hasPerpVolume = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.PERPS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
	})
	const hasOpenInterest = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.OPEN_INTEREST,
		dataType: ADAPTER_DATA_TYPES.OPEN_INTEREST_AT_END
	})
	const hasOptionsPremiumVolume = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME
	})
	const hasOptionsNotionalVolume = hasCategoryMetric({
		config: categoryOrTagConfig,
		chain,
		chainMetadata: currentChainMetadata,
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_NOTIONAL_VOLUME
	})

	const [
		{ protocols, parentProtocols },
		feesData,
		revenueData,
		dexVolumeData,
		perpVolumeData,
		openInterestData,
		optionsPremiumData,
		optionsNotionalData,
		chartData,
		feesChartData,
		revenueChartData,
		dexVolumeChartData,
		dexAggregatorsVolumeChartData,
		perpVolumeChartData,
		openInterestChartData,
		optionsPremiumVolumeChartData,
		optionsNotionalVolumeChartData,
		dexVolumeProtocolBreakdownChartData,
		dexVolumeChainBreakdownChartData,
		cardNetworkBreakdownChartData,
		cardCustodyBreakdownChartData,
		chainsByCategoriesOrTags
	] = await Promise.all([
		fetchProtocols(),
		hasFees && currentChainMetadata.fees
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'fees',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasRevenue && currentChainMetadata.fees
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'fees',
					dataType: 'dailyRevenue',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasDexVolume && categoryMetrics?.dexVolume && currentChainMetadata.dexs
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'dexs',
					category: dimensionCategory
				}).catch(() => null)
			: hasDexAggregatorsVolume && categoryMetrics?.dexAggregatorsVolume && currentChainMetadata.dexAggregators
				? fetchAdapterChainMetrics({
						chain: chain ?? 'All',
						adapterType: 'aggregators',
						category: dimensionCategory
					}).catch(() => null)
				: null,
		hasPerpVolume && categoryMetrics?.perpVolume && currentChainMetadata.perps
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'derivatives',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOpenInterest && categoryMetrics?.openInterest && currentChainMetadata.openInterest
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'open-interest',
					dataType: 'openInterestAtEnd',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOptionsPremiumVolume && categoryMetrics?.optionsPremiumVolume && currentChainMetadata.optionsPremiumVolume
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'options',
					dataType: 'dailyPremiumVolume',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOptionsNotionalVolume && categoryMetrics?.optionsNotionalVolume && currentChainMetadata.optionsNotionalVolume
			? fetchAdapterChainMetrics({
					chain: chain ?? 'All',
					adapterType: 'options',
					dataType: 'dailyNotionalVolume',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		params.kind === 'tag'
			? fetchTagChart({ tag: params.tag, ...(chain ? { chain } : {}) })
			: fetchCategoryChart({ category: params.category, ...(chain ? { chain } : {}) }),
		hasFees && categoryMetrics?.fees && currentChainMetadata.fees
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'fees',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasRevenue && categoryMetrics?.revenue && currentChainMetadata.fees
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'fees',
					dataType: 'dailyRevenue',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasDexVolume && categoryMetrics?.dexVolume && currentChainMetadata.dexs
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'dexs',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasDexAggregatorsVolume && categoryMetrics?.dexAggregatorsVolume && currentChainMetadata.dexAggregators
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'aggregators',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasPerpVolume && categoryMetrics?.perpVolume && currentChainMetadata.perps
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'derivatives',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOpenInterest && categoryMetrics?.openInterest && currentChainMetadata.openInterest
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'open-interest',
					dataType: 'openInterestAtEnd',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOptionsPremiumVolume && categoryMetrics?.optionsPremiumVolume && currentChainMetadata.optionsPremiumVolume
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'options',
					dataType: 'dailyPremiumVolume',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasOptionsNotionalVolume && categoryMetrics?.optionsNotionalVolume && currentChainMetadata.optionsNotionalVolume
			? fetchAdapterChainChartData({
					chain: chain ?? 'All',
					adapterType: 'options',
					dataType: 'dailyNotionalVolume',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		hasDexVolume && categoryMetrics?.dexVolume && categoryMetrics?.dexVolumeBreakdowns && currentChainMetadata.dexs
			? fetchAdapterChainChartDataByProtocolBreakdown({
					chain: chain ?? 'All',
					adapterType: 'dexs',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		// A chain split only says something on the all-chains page
		!chain && hasDexVolume && categoryMetrics?.dexVolume && categoryMetrics?.dexVolumeBreakdowns
			? fetchAdapterChainChartDataByChainBreakdown({
					adapterType: 'dexs',
					category: dimensionCategory
				}).catch(() => null)
			: null,
		// Card network/custody charts are all-chains only upstream, so they are omitted on chain pages
		hasCardBreakdowns ? fetchCardBreakdownChart('network').catch(() => null) : null,
		hasCardBreakdowns ? fetchCardBreakdownChart('custody').catch(() => null) : null,
		tag
			? fetchJson<Record<string, Array<string>>>('https://api.llama.fi/lite/chains-by-tags').catch(() => null)
			: fetchJson<Record<string, Array<string>>>('https://api.llama.fi/lite/chains-by-categories').catch(() => null)
	])

	const chainsLookupKey = tag ?? category
	const chains = chainsLookupKey ? (chainsByCategoriesOrTags?.[chainsLookupKey] ?? []) : []
	const adapterProtocols = [
		...(feesData?.protocols ?? []),
		...(revenueData?.protocols ?? []),
		...(dexVolumeData?.protocols ?? []),
		...(perpVolumeData?.protocols ?? []),
		...(openInterestData?.protocols ?? []),
		...(optionsPremiumData?.protocols ?? []),
		...(optionsNotionalData?.protocols ?? [])
	]
	const { protocols: mergedProtocols, parentProtocols: mergedParentProtocols } = mergeProtocolsWithAdapterFallback({
		protocols,
		parentProtocols,
		adapterProtocols,
		category,
		tag
	})

	const adapterDataStore: Record<string, AdapterProtocolData> = {}
	const getOrCreateAdapterProtocolData = ({
		protocolId,
		protocolChains
	}: {
		protocolId: string
		protocolChains: Array<string>
	}): AdapterProtocolData => {
		const existingData = adapterDataStore[protocolId]
		if (existingData != null) {
			existingData.chains = Array.from(new Set([...existingData.chains, ...protocolChains]))
			return existingData
		}

		const newData: AdapterProtocolData = {
			chains: Array.from(new Set(protocolChains))
		}
		adapterDataStore[protocolId] = newData
		return newData
	}

	for (const protocol of feesData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.fees = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0
		}
	}

	for (const protocol of revenueData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.revenue = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0
		}
	}

	for (const protocol of dexVolumeData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.dexVolume = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0
		}
	}

	for (const protocol of perpVolumeData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.perpVolume = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0,
			...(protocol.doublecounted ? { doublecounted: protocol.doublecounted } : {}),
			...(ZERO_FEE_PERPS.has(protocol.displayName) ? { zeroFeePerp: true } : {})
		}
	}

	for (const protocol of openInterestData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.openInterest = {
			total24h: protocol.total24h ?? 0
		}
	}

	for (const protocol of optionsPremiumData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.optionsPremium = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0
		}
	}

	for (const protocol of optionsNotionalData?.protocols ?? []) {
		const adapterData = getOrCreateAdapterProtocolData({
			protocolId: protocol.defillamaId,
			protocolChains: protocol.chains
		})
		adapterData.optionsNotional = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0
		}
	}

	const protocolsStore: Record<string, ProtocolTableRow> = {}
	type StoredParentChild = { row: ProtocolTableRow; contributesDefaultTvl: boolean }
	const parentProtocolsStore: Record<string, Array<StoredParentChild>> = {}
	const canonicalParentIds = new Set<string>()
	for (const parentProtocol of mergedParentProtocols) canonicalParentIds.add(parentProtocol.id)

	for (const protocol of mergedProtocols) {
		const isProtocolInCategoryOrTag = tag ? (protocol.tags ?? []).includes(tag) : protocol.category === category
		if (!isProtocolInCategoryOrTag) continue

		let tvl: number | null = null
		const extraTvls: Partial<Record<ProtocolListAdditiveTvlKey | 'excludeParent', number | null>> = {}
		if (chain) {
			for (const chainTvlKey in protocol.chainTvls) {
				const chainTvlData = protocol.chainTvls[chainTvlKey]
				if (!chainTvlData) continue
				const chainTvlValue = chainTvlData.tvl
				if (chainTvlKey === currentChainMetadata.name) {
					tvl = chainTvlValue
					continue
				}

				const chainPrefix = `${currentChainMetadata.name}-`
				if (!chainTvlKey.startsWith(chainPrefix)) continue
				const extraKey = chainTvlKey.slice(chainPrefix.length)
				if (extraKey === 'excludeParent') {
					extraTvls.excludeParent = chainTvlValue
					continue
				}

				if (isProtocolListTvlKey(extraKey)) {
					extraTvls[extraKey] = chainTvlValue
				}
			}
		} else {
			if (Object.hasOwn(protocol, 'tvl')) {
				tvl = protocol.tvl ?? null
			}

			for (const extraKey of PROTOCOL_TAXONOMY_TVL_KEYS) {
				const chainTvlEntry = protocol.chainTvls[extraKey]
				if (chainTvlEntry !== undefined) extraTvls[extraKey] = chainTvlEntry.tvl
			}
		}

		const borrowed = extraTvls.borrowed ?? null
		const supplied = borrowed != null && tvl != null ? borrowed + tvl : null
		const suppliedTvl = supplied != null && tvl != null && tvl > 0 ? supplied / tvl : null
		const adapterProtocolData = adapterDataStore[protocol.defillamaId]

		const finalData: ProtocolTableRow = {
			name: protocol.name,
			slug: slug(protocol.name),
			logo: protocol.logo,
			chains: Array.from(new Set([...(adapterProtocolData?.chains ?? []), ...protocol.chains])),
			...(protocol.deprecated ? { deprecated: true } : {}),
			tvl,
			extraTvls,
			mcap: protocol.mcap,
			...(effectiveCategory && ['Lending'].includes(effectiveCategory) ? { borrowed, supplied, suppliedTvl } : {}),
			fees: feesData === null ? null : (adapterProtocolData?.fees ?? ZERO_PROTOCOL_METRIC_TOTALS),
			revenue: revenueData === null ? null : (adapterProtocolData?.revenue ?? ZERO_PROTOCOL_METRIC_TOTALS),
			dexVolume: dexVolumeData === null ? null : (adapterProtocolData?.dexVolume ?? ZERO_PROTOCOL_METRIC_TOTALS),
			perpVolume: perpVolumeData === null ? null : (adapterProtocolData?.perpVolume ?? ZERO_PROTOCOL_METRIC_TOTALS),
			openInterest: openInterestData === null ? null : (adapterProtocolData?.openInterest ?? ZERO_OPEN_INTEREST_TOTALS),
			optionsPremium:
				optionsPremiumData === null ? null : (adapterProtocolData?.optionsPremium ?? ZERO_PROTOCOL_METRIC_TOTALS),
			optionsNotional:
				optionsNotionalData === null ? null : (adapterProtocolData?.optionsNotional ?? ZERO_PROTOCOL_METRIC_TOTALS),
			tags: protocol.tags ?? []
		}

		const canonicalParentId =
			protocol.parentProtocol && canonicalParentIds.has(protocol.parentProtocol) ? protocol.parentProtocol : null
		if (chain && !protocol.chains.includes(currentChainMetadata.name)) continue

		if (canonicalParentId) {
			const siblings = parentProtocolsStore[canonicalParentId]
			// Chain-specific extras can exist without an exact base entry, so they do not make the parent base unknown.
			const storedChild = {
				row: finalData,
				contributesDefaultTvl: protocol.tvl !== null && tvl !== null
			}
			if (siblings) siblings.push(storedChild)
			else parentProtocolsStore[canonicalParentId] = [storedChild]
		} else {
			protocolsStore[protocol.defillamaId] = finalData
		}
	}

	const sumMetricTotals = ({
		rows,
		selector
	}: {
		rows: Array<ProtocolTableRow>
		selector: (row: ProtocolTableRow) => ProtocolMetricTotals | null | undefined
	}): ProtocolMetricTotals => {
		let total24h = 0
		let total7d = 0
		let total30d = 0
		for (const row of rows) {
			const metric = selector(row)
			total24h += metric?.total24h ?? 0
			total7d += metric?.total7d ?? 0
			total30d += metric?.total30d ?? 0
		}
		return { total24h, total7d, total30d }
	}

	const finalProtocols: Array<ProtocolTableRow> = Object.values(protocolsStore)
	for (const parentProtocol of mergedParentProtocols) {
		const childProtocols = parentProtocolsStore[parentProtocol.id]
		if (childProtocols == null) continue

		if (childProtocols.length === 1) {
			for (const childProtocol of childProtocols) finalProtocols.push(childProtocol.row)
			continue
		}

		let tvl: number | null = null
		for (const childProtocol of childProtocols) {
			if (!childProtocol.contributesDefaultTvl || childProtocol.row.tvl === null) continue
			tvl = (tvl ?? 0) + childProtocol.row.tvl
		}
		const extraTvls: Partial<Record<ProtocolListAdditiveTvlKey | 'excludeParent', number | null>> = {}
		const childRows = childProtocols.map((childProtocol) => childProtocol.row)
		for (const childProtocol of childRows) {
			for (const extraTvlKey of PROTOCOL_TAXONOMY_TVL_KEYS) {
				if (!Object.hasOwn(childProtocol.extraTvls, extraTvlKey)) continue
				const incoming = childProtocol.extraTvls[extraTvlKey] ?? null
				if (!Object.hasOwn(extraTvls, extraTvlKey)) {
					extraTvls[extraTvlKey] = incoming
					continue
				}
				const current = extraTvls[extraTvlKey] ?? null
				extraTvls[extraTvlKey] = current === null || incoming === null ? null : current + incoming
			}
		}

		const borrowed = extraTvls.borrowed ?? null
		const supplied = borrowed != null && tvl != null ? borrowed + tvl : null
		const suppliedTvl = supplied != null && tvl != null && tvl > 0 ? supplied / tvl : null
		const fees = feesData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.fees })
		const revenue = revenueData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.revenue })
		const dexVolume =
			dexVolumeData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.dexVolume })
		const perpVolume =
			perpVolumeData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.perpVolume })
		let openInterestTotal24h = 0
		for (const row of childRows) openInterestTotal24h += row.openInterest?.total24h ?? 0
		const openInterest: OpenInterestTotals | null =
			openInterestData === null ? null : { total24h: openInterestTotal24h }
		const optionsPremium =
			optionsPremiumData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.optionsPremium })
		const optionsNotional =
			optionsNotionalData === null ? null : sumMetricTotals({ rows: childRows, selector: (row) => row.optionsNotional })

		const tags = new Set<string>()
		for (const childProtocol of childRows) {
			for (const childTag of childProtocol.tags) tags.add(childTag)
		}
		const parentSlug = slug(parentProtocol.name)
		finalProtocols.push({
			name: parentProtocol.name,
			slug: parentSlug,
			logo: parentProtocol.logo,
			chains: parentProtocol.chains,
			mcap: parentProtocol.mcap,
			tvl: hiddenParentTvls?.has(parentSlug) ? null : tvl,
			...(effectiveCategory && ['Lending'].includes(effectiveCategory) ? { borrowed, supplied, suppliedTvl } : {}),
			extraTvls,
			fees,
			revenue,
			dexVolume,
			perpVolume,
			openInterest,
			optionsPremium,
			optionsNotional,
			subRows: childRows.toSorted((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0)),
			tags: Array.from(tags)
		})
	}

	const tvlChart: Array<[number, number | null]> = []
	const extraTvlCharts: IProtocolTaxonomyPageData['extraTvlCharts'] = {}
	const baseTvlChart = chartData.tvl
	if (baseTvlChart) {
		for (const date in baseTvlChart) {
			tvlChart.push([+date * 1e3, baseTvlChart[date] ?? null])
		}
	}
	for (const chartType of PROTOCOL_LIST_ADDITIVE_TVL_KEYS) {
		const chart = chartData[chartType]
		if (!chart) continue
		const extraTvlChart: Record<number, number | null> = {}
		extraTvlCharts[chartType] = extraTvlChart
		for (const date in chart) {
			extraTvlChart[+date * 1e3] = chart[date] ?? null
		}
	}

	const startIndex = tvlChart.findIndex(([, tvl]) => tvl != null)
	const filteredTvlChart = startIndex >= 0 ? tvlChart.slice(startIndex) : tvlChart
	const categoryCharts = buildCategoryCharts({
		effectiveCategory,
		metrics: chartMetrics,
		tvlChartData: filteredTvlChart,
		feesChartData,
		revenueChartData,
		dexVolumeChartData,
		dexAggregatorsVolumeChartData,
		perpVolumeChartData,
		openInterestChartData,
		optionsPremiumVolumeChartData,
		optionsNotionalVolumeChartData,
		borrowedChartData: extraTvlCharts.borrowed,
		stakingChartData: extraTvlCharts.staking
	})

	const sumAvailableSummary = (
		available: boolean,
		selector: (protocol: ProtocolTableRow) => number | null | undefined
	): number | null => {
		if (!available) return null
		let total = 0
		for (const protocol of finalProtocols) total += selector(protocol) ?? 0
		return total
	}
	const fees7d = sumAvailableSummary(feesData !== null, (protocol) => protocol.fees?.total7d)
	const revenue7d = sumAvailableSummary(revenueData !== null, (protocol) => protocol.revenue?.total7d)
	const dexVolume7d = sumAvailableSummary(dexVolumeData !== null, (protocol) => protocol.dexVolume?.total7d)
	const perpVolume7d = sumAvailableSummary(perpVolumeData !== null, (protocol) => protocol.perpVolume?.total7d)
	const openInterest = sumAvailableSummary(openInterestData !== null, (protocol) => protocol.openInterest?.total24h)
	const optionsPremium7d = sumAvailableSummary(
		optionsPremiumData !== null,
		(protocol) => protocol.optionsPremium?.total7d
	)
	const optionsNotional7d = sumAvailableSummary(
		optionsNotionalData !== null,
		(protocol) => protocol.optionsNotional?.total7d
	)

	return {
		charts: categoryCharts,
		breakdownCharts: buildBreakdownChartsByKey({
			protocol: dexVolumeProtocolBreakdownChartData,
			chain: dexVolumeChainBreakdownChartData,
			network: cardNetworkBreakdownChartData,
			custody: cardCustodyBreakdownChartData
		}),
		chain: currentChainMetadata.name,
		protocols: (chain
			? finalProtocols.filter((p) => p.chains.includes(currentChainMetadata.name))
			: finalProtocols
		).sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0)),
		category: category ?? null,
		tag: tag ?? null,
		effectiveCategory,
		chains: [
			{ label: 'All', to: `/protocols/${slug(taxonomyName)}` },
			...chains.map((c) => ({ label: c, to: `/protocols/${slug(taxonomyName)}/${slug(c)}` }))
		],
		fees7d,
		revenue7d,
		dexVolume7d,
		perpVolume7d,
		openInterest,
		optionsPremium7d,
		optionsNotional7d,
		extraTvlCharts
	}
}

type CategoryAggregateRow = {
	name: string
	protocols: number
	tvl: number
	tvlPrevDay: number
	tvlPrevWeek: number
	tvlPrevMonth: number
	revenue: number | null
	extraTvls: Record<string, IProtocolsCategoriesExtraTvlPoint>
}

const CATEGORIES_PAGE_INCLUDED_EXTRA_TVL_KEYS = PROTOCOL_LIST_ADDITIVE_TVL_KEYS

function createEmptyExtraTvlPoint(): IProtocolsCategoriesExtraTvlPoint {
	return {
		tvl: 0,
		tvlPrevDay: 0,
		tvlPrevWeek: 0,
		tvlPrevMonth: 0
	}
}

function createEmptyExtraTvls(): Record<string, IProtocolsCategoriesExtraTvlPoint> {
	const extraTvls: Record<string, IProtocolsCategoriesExtraTvlPoint> = {}
	for (const key of CATEGORIES_PAGE_INCLUDED_EXTRA_TVL_KEYS) {
		extraTvls[key] = createEmptyExtraTvlPoint()
	}
	return extraTvls
}

function createCategoryAggregateRow(name: string, revenueAvailable: boolean): CategoryAggregateRow {
	return {
		name,
		protocols: 0,
		tvl: 0,
		tvlPrevDay: 0,
		tvlPrevWeek: 0,
		tvlPrevMonth: 0,
		revenue: revenueAvailable ? 0 : null,
		extraTvls: createEmptyExtraTvls()
	}
}

function toCategoryTableRow({
	row,
	description,
	subRows
}: {
	row: CategoryAggregateRow
	description: string
	subRows?: Array<IProtocolsCategoriesTableRow>
}): IProtocolsCategoriesTableRow {
	const categoryRow: IProtocolsCategoriesTableRow = {
		...row,
		change_1d: getPercentChange(row.tvl, row.tvlPrevDay),
		change_7d: getPercentChange(row.tvl, row.tvlPrevWeek),
		change_1m: getPercentChange(row.tvl, row.tvlPrevMonth),
		description
	}

	if (subRows != null && subRows.length > 0) {
		categoryRow.subRows = subRows
	}

	return categoryRow
}

function buildProtocolsCategoriesChartData({
	chart,
	categoryKeys,
	extraTvlTypes = []
}: {
	chart: CategoriesSummaryResponse['chart']
	categoryKeys: Array<string>
	extraTvlTypes?: ReadonlyArray<string>
}): IProtocolsCategoriesChartData {
	const includedExtraTvlKeys = CATEGORIES_PAGE_INCLUDED_EXTRA_TVL_KEYS.filter((key) => extraTvlTypes.includes(key))
	const extraTvlCharts: IProtocolsCategoriesChartData['extraTvlCharts'] = {}
	if (includedExtraTvlKeys.length > 0) {
		for (const categoryName of categoryKeys) {
			extraTvlCharts[categoryName] = {}
			for (const extraTvlKey of includedExtraTvlKeys) {
				const categoryExtraTvlCharts = extraTvlCharts[categoryName]
				if (categoryExtraTvlCharts) categoryExtraTvlCharts[extraTvlKey] = {}
			}
		}
	}

	const chartSource: IProtocolsCategoriesChartData['chartSource'] = []
	for (const date in chart) {
		const chartByCategory = chart[date]
		if (!chartByCategory) continue
		const timestamp = Number(date) * 1e3

		const chartRow: IProtocolsCategoriesChartData['chartSource'][number] = { timestamp }
		for (const categoryName of categoryKeys) {
			const categoryChartMetrics = chartByCategory[categoryName]
			const tvlValue = categoryChartMetrics?.tvl
			chartRow[categoryName] = tvlValue ?? null

			for (const extraTvlKey of includedExtraTvlKeys) {
				const extraValue = categoryChartMetrics?.[extraTvlKey] ?? 0
				const categoryExtraTvlCharts = extraTvlCharts[categoryName]
				const extraTvlChart = categoryExtraTvlCharts?.[extraTvlKey]
				if (!extraTvlChart) continue
				const currentValue = extraTvlChart[timestamp] ?? 0
				extraTvlChart[timestamp] = currentValue + extraValue
			}
		}
		chartSource.push(chartRow)
	}
	chartSource.sort((a, b) => a.timestamp - b.timestamp)

	return { chartSource, extraTvlCharts }
}

export async function getProtocolsCategoriesChartData({
	extraTvlTypes = []
}: {
	extraTvlTypes?: ReadonlyArray<string>
} = {}): Promise<IProtocolsCategoriesChartData> {
	const { chart, categories } = await fetchCategoriesSummary()
	const categoryKeys: Array<string> = []
	for (const categoryName in categories) categoryKeys.push(categoryName)

	return buildProtocolsCategoriesChartData({ chart, categoryKeys, extraTvlTypes })
}

export async function getProtocolsCategoriesPageData(): Promise<IProtocolsCategoriesPageData> {
	const [{ protocols }, revenueData]: [ProtocolsResponse, IAdapterChainMetrics | null] = await Promise.all([
		fetchProtocols(),
		fetchAdapterChainMetrics({
			adapterType: 'fees',
			chain: 'All',
			dataType: 'dailyRevenue'
		}).catch(() => null)
	])

	const revenueByProtocol: Record<string, number> = {}
	for (const protocol of revenueData?.protocols ?? []) {
		revenueByProtocol[protocol.defillamaId] = protocol.total24h ?? 0
	}

	const categoryRows = new Map<string, CategoryAggregateRow>()
	const tagRowsByCategory = new Map<string, Map<string, CategoryAggregateRow>>()

	const getOrCreateCategoryRow = (categoryName: string): CategoryAggregateRow => {
		const existingRow = categoryRows.get(categoryName)
		if (existingRow != null) return existingRow

		const newRow = createCategoryAggregateRow(categoryName, revenueData !== null)
		categoryRows.set(categoryName, newRow)
		return newRow
	}

	const getOrCreateTagRow = ({
		categoryName,
		tagName
	}: {
		categoryName: string
		tagName: string
	}): CategoryAggregateRow => {
		const tagsByName = tagRowsByCategory.get(categoryName) ?? new Map<string, CategoryAggregateRow>()
		if (!tagRowsByCategory.has(categoryName)) {
			tagRowsByCategory.set(categoryName, tagsByName)
		}

		const existingRow = tagsByName.get(tagName)
		if (existingRow != null) return existingRow

		const newRow = createCategoryAggregateRow(tagName, revenueData !== null)
		tagsByName.set(tagName, newRow)
		return newRow
	}

	for (const protocol of protocols) {
		const categoryName = protocol.category
		if (!categoryName) continue
		const protocolRevenue = revenueData === null ? null : (revenueByProtocol[protocol.defillamaId] ?? 0)
		const protocolTvl = protocol.tvl ?? 0
		const protocolTvlPrevDay = protocol.tvlPrevDay ?? 0
		const protocolTvlPrevWeek = protocol.tvlPrevWeek ?? 0
		const protocolTvlPrevMonth = protocol.tvlPrevMonth ?? 0

		const categoryRow = getOrCreateCategoryRow(categoryName)
		categoryRow.protocols += 1
		categoryRow.tvl += protocolTvl
		categoryRow.tvlPrevDay += protocolTvlPrevDay
		categoryRow.tvlPrevWeek += protocolTvlPrevWeek
		categoryRow.tvlPrevMonth += protocolTvlPrevMonth
		categoryRow.revenue =
			categoryRow.revenue === null || protocolRevenue === null ? null : categoryRow.revenue + protocolRevenue

		const protocolTags = protocol.tags ?? []
		for (const tagName of protocolTags) {
			const tagRow = getOrCreateTagRow({ categoryName, tagName })
			tagRow.protocols += 1
			tagRow.tvl += protocolTvl
			tagRow.tvlPrevDay += protocolTvlPrevDay
			tagRow.tvlPrevWeek += protocolTvlPrevWeek
			tagRow.tvlPrevMonth += protocolTvlPrevMonth
			tagRow.revenue = tagRow.revenue === null || protocolRevenue === null ? null : tagRow.revenue + protocolRevenue
		}

		for (const extraTvlKey of CATEGORIES_PAGE_INCLUDED_EXTRA_TVL_KEYS) {
			const protocolExtraTvl = protocol.chainTvls[extraTvlKey]
			if (protocolExtraTvl == null) continue

			const categoryExtraTvl = categoryRow.extraTvls[extraTvlKey]
			if (!categoryExtraTvl) continue
			categoryExtraTvl.tvl =
				categoryExtraTvl.tvl === null || protocolExtraTvl.tvl === null
					? null
					: categoryExtraTvl.tvl + protocolExtraTvl.tvl
			categoryExtraTvl.tvlPrevDay =
				categoryExtraTvl.tvlPrevDay === null || protocolExtraTvl.tvlPrevDay === null
					? null
					: categoryExtraTvl.tvlPrevDay + protocolExtraTvl.tvlPrevDay
			categoryExtraTvl.tvlPrevWeek =
				categoryExtraTvl.tvlPrevWeek === null || protocolExtraTvl.tvlPrevWeek === null
					? null
					: categoryExtraTvl.tvlPrevWeek + protocolExtraTvl.tvlPrevWeek
			categoryExtraTvl.tvlPrevMonth =
				categoryExtraTvl.tvlPrevMonth === null || protocolExtraTvl.tvlPrevMonth === null
					? null
					: categoryExtraTvl.tvlPrevMonth + protocolExtraTvl.tvlPrevMonth

			for (const tagName of protocolTags) {
				const tagRow = getOrCreateTagRow({ categoryName, tagName })
				const tagExtraTvl = tagRow.extraTvls[extraTvlKey]
				if (!tagExtraTvl) continue
				tagExtraTvl.tvl =
					tagExtraTvl.tvl === null || protocolExtraTvl.tvl === null ? null : tagExtraTvl.tvl + protocolExtraTvl.tvl
				tagExtraTvl.tvlPrevDay =
					tagExtraTvl.tvlPrevDay === null || protocolExtraTvl.tvlPrevDay === null
						? null
						: tagExtraTvl.tvlPrevDay + protocolExtraTvl.tvlPrevDay
				tagExtraTvl.tvlPrevWeek =
					tagExtraTvl.tvlPrevWeek === null || protocolExtraTvl.tvlPrevWeek === null
						? null
						: tagExtraTvl.tvlPrevWeek + protocolExtraTvl.tvlPrevWeek
				tagExtraTvl.tvlPrevMonth =
					tagExtraTvl.tvlPrevMonth === null || protocolExtraTvl.tvlPrevMonth === null
						? null
						: tagExtraTvl.tvlPrevMonth + protocolExtraTvl.tvlPrevMonth
			}
		}
	}

	const categoryKeys = Array.from(categoryRows.keys()).sort(
		(a, b) => (categoryRows.get(b)?.tvl ?? 0) - (categoryRows.get(a)?.tvl ?? 0)
	)

	const allColors = getNDistinctColors(categoryKeys.length)
	const categoryColors: Record<string, string> = {}
	for (const [index, categoryName] of categoryKeys.entries()) {
		categoryColors[categoryName] = allColors[index] ?? '#999999'
	}

	const tableData: Array<IProtocolsCategoriesTableRow> = []
	for (const categoryName of categoryKeys) {
		const categoryRow = categoryRows.get(categoryName)
		if (categoryRow == null) continue

		const tagRows = tagRowsByCategory.get(categoryName)
		const subRows: Array<IProtocolsCategoriesTableRow> = []
		for (const [tagName, tagRow] of tagRows?.entries() ?? []) {
			subRows.push(
				toCategoryTableRow({
					row: tagRow,
					description: protocolCategoryConfig[tagName]?.description ?? ''
				})
			)
		}

		tableData.push(
			toCategoryTableRow({
				row: categoryRow,
				description: protocolCategoryConfig[categoryName]?.description ?? '',
				subRows
			})
		)
	}

	return {
		categories: categoryKeys,
		tableData: tableData.toSorted((a, b) => {
			if (a.tvl === null) return b.tvl === null ? 0 : 1
			if (b.tvl === null) return -1
			return b.tvl - a.tvl
		}),
		chartSource: [],
		categoryColors,
		extraTvlCharts: {}
	}
}
