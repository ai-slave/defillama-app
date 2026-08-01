import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import type { IParentProtocol } from '~/containers/ProtocolLists/protocol-table.types'
import { getMarketCapToAnnualizedMetricRatio, getPercentChange } from '~/utils'
import type { ProtocolTableSourcePlan } from '../../protocolTableSourcePlan'
import type { TableFilters } from '../../types'
import type { IProtocolRow, ProtocolWithSubRows, ProTableDimensionProtocol } from './proTable.types'
import { formatProtocolsList } from './proTable.utils'

interface ProtocolFilterSets {
	protocols: Set<string> | null
	categories: Set<string> | null
	excludedCategories: Set<string> | null
	oracles: Set<string> | null
}

export type ProTableSearchIndex = WeakMap<IProtocolRow, string>

interface ProTableRowPreparationInput {
	protocols: IProtocolRow[]
	parentProtocols: IParentProtocol[]
	filters?: TableFilters
	sourcePlan: ProtocolTableSourcePlan
	volumeData?: ProTableDimensionProtocol[]
	feesData?: ProTableDimensionProtocol[]
	perpsData?: ProTableDimensionProtocol[]
	openInterestData?: ProTableDimensionProtocol[]
	earningsData?: DimensionDatasetProtocol[]
	aggregatorsData?: DimensionDatasetProtocol[]
	bridgeAggregatorsData?: DimensionDatasetProtocol[]
	optionsData?: DimensionDatasetProtocol[]
}

const hasSubRows = (protocol: IProtocolRow): protocol is ProtocolWithSubRows =>
	Array.isArray(protocol.subRows) && protocol.subRows.length > 0

const getProtocolOracles = (protocol: IProtocolRow): string[] => {
	if (protocol.oracles?.length) return protocol.oracles
	if (!protocol.oraclesByChain) return []

	const flattened = new Set<string>()
	for (const oracles of Object.values(protocol.oraclesByChain)) {
		for (const oracle of oracles) flattened.add(oracle)
	}
	return Array.from(flattened)
}

const matchesOracle = (protocol: IProtocolRow, oracleSet: Set<string>): boolean =>
	getProtocolOracles(protocol).some((oracle) => oracleSet.has(oracle))

const hasFeeAnnualizedContributor = (protocol: IProtocolRow): boolean =>
	protocol.fees_24h != null ||
	protocol.fees_7d != null ||
	protocol.fees_30d != null ||
	protocol.fees_1y != null ||
	protocol.cumulativeFees != null

const hasRevenueAnnualizedContributor = (protocol: IProtocolRow): boolean =>
	protocol.revenue_24h != null ||
	protocol.revenue_7d != null ||
	protocol.revenue_30d != null ||
	protocol.revenue_1y != null

const addChildTvl = (
	total: number | null,
	value: number | null,
	excludedValue: number | null | undefined
): number | null => {
	if (total === null || value === null || excludedValue === null) return null
	return total + value - (excludedValue ?? 0)
}

const recalculateParentMetrics = (
	parent: ProtocolWithSubRows,
	filteredSubRows: IProtocolRow[],
	oracleMetadataRows: IProtocolRow[]
): ProtocolWithSubRows => {
	let tvl: number | null = 0
	let tvlPrevDay: number | null = 0
	let tvlPrevWeek: number | null = 0
	let tvlPrevMonth: number | null = 0
	let mcap = 0
	let volume24h = 0
	let volume7d = 0
	let volume30d = 0
	let fees24h = 0
	let fees7d = 0
	let fees30d = 0
	let fees1y = 0
	let feesAnnualized1y = 0
	let hasFeesAnnualized1y = false
	let isFeesAnnualized1yIncomplete = false
	let average1y = 0
	let revenue24h = 0
	let revenue7d = 0
	let revenue30d = 0
	let revenue1y = 0
	let revenueAnnualized1y = 0
	let hasRevenueAnnualized1y = false
	let isRevenueAnnualized1yIncomplete = false
	let perpsVolume24h = 0
	let perpsVolume7d = 0
	let perpsVolume30d = 0
	let openInterest = 0
	let weightedVolumeChange = 0
	let totalVolumeWeight = 0
	let weightedPerpsVolumeChange = 0
	let totalPerpsVolumeWeight = 0
	let hasTvlContributor = false

	for (const child of filteredSubRows) {
		if (child.contributesTvl) {
			hasTvlContributor = true
			const excludedTvl = child.extraTvl?.excludeParent
			tvl = addChildTvl(tvl, child.tvl, excludedTvl?.tvl)
			tvlPrevDay = addChildTvl(tvlPrevDay, child.tvlPrevDay, excludedTvl?.tvlPrevDay)
			tvlPrevWeek = addChildTvl(tvlPrevWeek, child.tvlPrevWeek, excludedTvl?.tvlPrevWeek)
			tvlPrevMonth = addChildTvl(tvlPrevMonth, child.tvlPrevMonth, excludedTvl?.tvlPrevMonth)
		}
		mcap += child.mcap ?? 0
		volume24h += child.volume_24h ?? 0
		volume7d += child.volume_7d ?? 0
		volume30d += child.volume_30d ?? 0

		if (child.volume_7d != null && child.volumeChange_7d != null) {
			weightedVolumeChange += child.volumeChange_7d * child.volume_7d
			totalVolumeWeight += child.volume_7d
		}

		fees24h += child.fees_24h ?? 0
		fees7d += child.fees_7d ?? 0
		fees30d += child.fees_30d ?? 0
		fees1y += child.fees_1y ?? 0
		if (child.feesAnnualized1y != null) {
			feesAnnualized1y += child.feesAnnualized1y
			hasFeesAnnualized1y = true
		} else if (hasFeeAnnualizedContributor(child)) {
			isFeesAnnualized1yIncomplete = true
		}
		average1y += child.average_1y ?? 0

		revenue24h += child.revenue_24h ?? 0
		revenue7d += child.revenue_7d ?? 0
		revenue30d += child.revenue_30d ?? 0
		revenue1y += child.revenue_1y ?? 0
		if (child.revenueAnnualized1y != null) {
			revenueAnnualized1y += child.revenueAnnualized1y
			hasRevenueAnnualized1y = true
		} else if (hasRevenueAnnualizedContributor(child)) {
			isRevenueAnnualized1yIncomplete = true
		}

		perpsVolume24h += child.perps_volume_24h ?? 0
		perpsVolume7d += child.perps_volume_7d ?? 0
		perpsVolume30d += child.perps_volume_30d ?? 0
		if (child.perps_volume_7d != null && child.perps_volume_change_7d != null) {
			weightedPerpsVolumeChange += child.perps_volume_change_7d * child.perps_volume_7d
			totalPerpsVolumeWeight += child.perps_volume_7d
		}
		openInterest += child.openInterest ?? 0
	}
	if (!hasTvlContributor) {
		tvl = null
		tvlPrevDay = null
		tvlPrevWeek = null
		tvlPrevMonth = null
	}

	const finalMcap = mcap > 0 ? mcap : (parent.mcap ?? 0)
	const finalFeesAnnualized1y = hasFeesAnnualized1y && !isFeesAnnualized1yIncomplete ? feesAnnualized1y : null
	const finalRevenueAnnualized1y =
		hasRevenueAnnualized1y && !isRevenueAnnualized1yIncomplete ? revenueAnnualized1y : null
	const parentMcapTvl = tvl != null && tvl > 0 ? finalMcap / tvl : null

	const oracleSet = new Set<string>()
	const oraclesByChain = new Map<string, Set<string>>()
	const addOracles = (protocol: IProtocolRow) => {
		for (const oracle of protocol.oracles ?? []) oracleSet.add(oracle)
		for (const [chain, chainOracles] of Object.entries(protocol.oraclesByChain ?? {})) {
			const existing = oraclesByChain.get(chain) ?? new Set<string>()
			for (const oracle of chainOracles) existing.add(oracle)
			oraclesByChain.set(chain, existing)
		}
	}
	addOracles(parent)
	for (const child of oracleMetadataRows) addOracles(child)

	const aggregatedOraclesByChain: Record<string, string[]> = {}
	for (const [chain, chainOracles] of oraclesByChain) {
		aggregatedOraclesByChain[chain] = Array.from(chainOracles).sort((a, b) => a.localeCompare(b))
	}
	const finalOraclesByChain =
		Object.keys(aggregatedOraclesByChain).length > 0 ? aggregatedOraclesByChain : parent.oraclesByChain

	return {
		...parent,
		contributesTvl: hasTvlContributor,
		tvl,
		tvlPrevDay,
		tvlPrevWeek,
		tvlPrevMonth,
		mcap: finalMcap,
		volume_24h: volume24h,
		volume_7d: volume7d,
		volume_30d: volume30d,
		volumeChange_7d: totalVolumeWeight > 0 ? weightedVolumeChange / totalVolumeWeight : null,
		fees_24h: fees24h,
		fees_7d: fees7d,
		fees_30d: fees30d,
		fees_1y: fees1y,
		feesAnnualized1y: finalFeesAnnualized1y,
		average_1y: average1y,
		revenue_24h: revenue24h,
		revenue_7d: revenue7d,
		revenue_30d: revenue30d,
		revenue_1y: revenue1y,
		revenueAnnualized1y: finalRevenueAnnualized1y,
		perps_volume_24h: perpsVolume24h,
		perps_volume_7d: perpsVolume7d,
		perps_volume_30d: perpsVolume30d,
		perps_volume_change_7d: totalPerpsVolumeWeight > 0 ? weightedPerpsVolumeChange / totalPerpsVolumeWeight : null,
		openInterest,
		change_1d: getPercentChange(tvl, tvlPrevDay),
		change_7d: getPercentChange(tvl, tvlPrevWeek),
		change_1m: getPercentChange(tvl, tvlPrevMonth),
		mcaptvl: parentMcapTvl !== null && Number.isFinite(parentMcapTvl) ? parentMcapTvl : null,
		pf: getMarketCapToAnnualizedMetricRatio(finalMcap, finalFeesAnnualized1y),
		ps: getMarketCapToAnnualizedMetricRatio(finalMcap, finalRevenueAnnualized1y),
		subRows: filteredSubRows,
		oracles: Array.from(oracleSet).sort((a, b) => a.localeCompare(b)),
		...(finalOraclesByChain !== undefined ? { oraclesByChain: finalOraclesByChain } : {})
	}
}

const createFilterSets = (filters?: TableFilters): ProtocolFilterSets => ({
	protocols: filters?.protocols?.length ? new Set(filters.protocols) : null,
	categories: filters?.categories?.length ? new Set(filters.categories) : null,
	excludedCategories: filters?.excludedCategories?.length ? new Set(filters.excludedCategories) : null,
	oracles: filters?.oracles?.length ? new Set(filters.oracles) : null
})

const matchesLeafFilters = (protocol: IProtocolRow, filters: ProtocolFilterSets): boolean => {
	if (protocol.category && filters.excludedCategories?.has(protocol.category)) return false
	if (filters.protocols && !filters.protocols.has(protocol.name)) return false
	if (filters.oracles && !matchesOracle(protocol, filters.oracles)) return false
	if (filters.categories && (!protocol.category || !filters.categories.has(protocol.category))) return false
	return true
}

export const filterProTableProtocols = (protocols: IProtocolRow[], filters?: TableFilters): IProtocolRow[] => {
	const filterSets = createFilterSets(filters)
	if (!filterSets.protocols && !filterSets.categories && !filterSets.excludedCategories && !filterSets.oracles) {
		return protocols
	}

	const filtered: IProtocolRow[] = []
	for (const protocol of protocols) {
		if (!hasSubRows(protocol)) {
			if (matchesLeafFilters(protocol, filterSets)) filtered.push(protocol)
			continue
		}
		if (protocol.category && filterSets.excludedCategories?.has(protocol.category)) continue

		const parentMatchesProtocol = !filterSets.protocols || filterSets.protocols.has(protocol.name)
		const parentMatchesCategory =
			!filterSets.categories || (!!protocol.category && filterSets.categories.has(protocol.category))
		const parentMatchesOriginalOracle = !filterSets.oracles || matchesOracle(protocol, filterSets.oracles)
		const filtersExcludedChildren = filterSets.excludedCategories !== null
		const protocolFilter = filterSets.protocols
		const filtersProtocolChildren = protocolFilter !== null && !parentMatchesProtocol
		const baseRows: IProtocolRow[] = filtersExcludedChildren ? [] : protocol.subRows
		const protocolRows: IProtocolRow[] = filtersProtocolChildren ? [] : baseRows
		const protocolOracleRows: IProtocolRow[] = []
		const protocolCategoryRows: IProtocolRow[] = []
		const protocolOracleCategoryRows: IProtocolRow[] = []
		let baseHasMatchingOracle = false
		let protocolRowsHaveMatchingOracle = false

		for (const child of protocol.subRows) {
			if (child.category && filterSets.excludedCategories?.has(child.category)) continue
			if (filtersExcludedChildren) baseRows.push(child)
			const childMatchesOracle = !filterSets.oracles || matchesOracle(child, filterSets.oracles)
			if (filtersExcludedChildren && childMatchesOracle) baseHasMatchingOracle = true
			if (protocolFilter && !parentMatchesProtocol && !protocolFilter.has(child.name)) continue

			if (filtersProtocolChildren) protocolRows.push(child)
			if (childMatchesOracle) {
				protocolRowsHaveMatchingOracle = true
				protocolOracleRows.push(child)
			}
			const childMatchesCategory =
				parentMatchesCategory ||
				!filterSets.categories ||
				(!!child.category && filterSets.categories.has(child.category))
			if (childMatchesCategory) {
				protocolCategoryRows.push(child)
				if (childMatchesOracle) protocolOracleCategoryRows.push(child)
			}
		}

		if (baseRows.length === 0 || protocolRows.length === 0) continue
		const parentMatchesOracle =
			parentMatchesOriginalOracle ||
			(filterSets.excludedCategories !== null
				? baseHasMatchingOracle
				: filterSets.protocols !== null && !parentMatchesProtocol
					? protocolRowsHaveMatchingOracle
					: false)
		const oracleRows = parentMatchesOracle ? protocolRows : protocolOracleRows
		if (oracleRows.length === 0) continue
		const finalRows = parentMatchesCategory
			? oracleRows
			: parentMatchesOracle
				? protocolCategoryRows
				: protocolOracleCategoryRows
		if (finalRows.length === 0) continue

		let oracleMetadataRows: IProtocolRow[] | null = null
		if (filterSets.excludedCategories) oracleMetadataRows = baseRows
		else if (filterSets.protocols && !parentMatchesProtocol) oracleMetadataRows = protocolRows
		else if (filterSets.oracles && !parentMatchesOracle) oracleMetadataRows = oracleRows
		else if (filterSets.categories && !parentMatchesCategory) oracleMetadataRows = finalRows

		filtered.push(oracleMetadataRows ? recalculateParentMetrics(protocol, finalRows, oracleMetadataRows) : protocol)
	}

	return filtered
}

const normalizeSearchValue = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? ''

const normalizeSearchList = (values: string[] | undefined): string => {
	let normalizedList = ''
	for (const value of values ?? []) {
		const normalized = normalizeSearchValue(value)
		if (!normalized) continue
		normalizedList += normalizedList ? ` ${normalized}` : normalized
	}
	return normalizedList
}

export const createProTableSearchIndex = (protocols: IProtocolRow[]): ProTableSearchIndex => {
	const index: ProTableSearchIndex = new WeakMap()
	const addRows = (rows: IProtocolRow[]) => {
		for (const protocol of rows) {
			const searchText = [
				normalizeSearchValue(protocol.name),
				normalizeSearchValue(protocol.category),
				normalizeSearchValue(protocol.symbol),
				normalizeSearchList(protocol.chains),
				normalizeSearchList(protocol.oracles)
			].join('\0')
			index.set(protocol, searchText)
			if (protocol.subRows?.length) addRows(protocol.subRows)
		}
	}
	addRows(protocols)
	return index
}

export const matchesProTableSearch = (
	protocol: IProtocolRow,
	normalizedQuery: string,
	searchIndex: ProTableSearchIndex
): boolean => !normalizedQuery || (searchIndex.get(protocol)?.includes(normalizedQuery) ?? false)

export const normalizeProTableSearchQuery = (query: unknown): string =>
	typeof query === 'string' ? query.trim().toLowerCase() : ''

export const prepareProTableRows = ({
	protocols,
	parentProtocols,
	filters,
	sourcePlan,
	volumeData,
	feesData,
	perpsData,
	openInterestData,
	earningsData,
	aggregatorsData,
	bridgeAggregatorsData,
	optionsData
}: ProTableRowPreparationInput): IProtocolRow[] =>
	filterProTableProtocols(
		formatProtocolsList({
			extraTvlsEnabled: {},
			protocols,
			parentProtocols,
			...(sourcePlan.enabled.volume && volumeData !== undefined ? { volumeData } : {}),
			...(sourcePlan.enabled.fees && feesData !== undefined ? { feesData } : {}),
			...(sourcePlan.enabled.perps && perpsData !== undefined ? { perpsData } : {}),
			...(sourcePlan.enabled.openInterest && openInterestData !== undefined ? { openInterestData } : {}),
			...(sourcePlan.enabled.earnings && earningsData !== undefined ? { earningsData } : {}),
			...(sourcePlan.enabled.aggregators && aggregatorsData !== undefined ? { aggregatorsData } : {}),
			...(sourcePlan.enabled.bridgeAggregators && bridgeAggregatorsData !== undefined ? { bridgeAggregatorsData } : {}),
			...(sourcePlan.enabled.options && optionsData !== undefined ? { optionsData } : {})
		}),
		filters
	)
