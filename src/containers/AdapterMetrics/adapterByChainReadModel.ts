import { slug, getMarketCapToAnnualizedMetricRatio } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import type { IAdapterChainMetrics } from './api.types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES, ZERO_FEE_PERPS } from './constants'
import { mergeParentEarningsMetricPeriods, mergeParentMetricPeriods } from './metricPeriods'
import type { IAdapterByChainPageData, IAdapterChainOverview, IProtocol } from './types'
import type { ActiveLiquidityData, NormalizedVolumeData, OpenInterestData } from './utils'

type AdapterChainProtocolMetric = IAdapterChainOverview['protocols'][number]
type NonEmptyArray<T> = [T, ...T[]]

type ProtocolMcapData = {
	protocols: Array<{ name: string; mcap: number | null }>
	parentProtocols: Array<{ name: string; mcap?: number | null }>
}

type AdapterByChainDataType = `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
type AdapterByChainRankBy = 'pfOrPs' | 'total24h'

type AdapterByChainReadModel = {
	protocols: IAdapterByChainPageData['protocols']
	categories: string[]
	openInterest: number | null
	activeLiquidity: number | null
}

function buildProtocolsMcap(protocolsData: ProtocolMcapData) {
	const protocolsMcap = new Map<string, number | null>()
	for (const protocol of protocolsData.protocols) {
		protocolsMcap.set(protocol.name, protocol.mcap ?? null)
	}
	for (const protocol of protocolsData.parentProtocols) {
		protocolsMcap.set(protocol.name, protocol.mcap ?? null)
	}
	return protocolsMcap
}

function getProtocolMethodology({
	adapterType,
	dataType,
	protocol
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: AdapterByChainDataType | undefined
	protocol: AdapterChainProtocolMetric
}) {
	if (adapterType !== 'fees') return null
	if (typeof protocol.methodology === 'string') return protocol.methodology
	if (protocol.methodology == null) return null
	if (dataType === 'dailyRevenue') {
		return protocol.methodology['Revenue']
	}
	if (dataType === 'dailyProtocolRevenue') {
		return protocol.methodology['ProtocolRevenue'] ?? protocol.methodology['Revenue']
	}
	if (dataType === 'dailyHoldersRevenue') {
		return protocol.methodology['HoldersRevenue']
	}
	return protocol.methodology['Fees']
}

function buildProtocolSummary({
	protocol,
	adapterType,
	dataType,
	protocolMcap,
	openInterestProtocols,
	activeLiquidityProtocols,
	normalizedVolumeProtocols,
	cantonIncentivesWarning
}: {
	protocol: AdapterChainProtocolMetric
	adapterType: `${ADAPTER_TYPES}`
	dataType: AdapterByChainDataType | undefined
	protocolMcap: number | null | undefined
	openInterestProtocols: Map<string, OpenInterestData>
	activeLiquidityProtocols: Map<string, ActiveLiquidityData>
	normalizedVolumeProtocols: Map<string, NormalizedVolumeData>
	cantonIncentivesWarning: string | null
}): IProtocol {
	const warning = protocol.slug === 'canton' ? cantonIncentivesWarning : null
	const methodology = getProtocolMethodology({ adapterType, dataType, protocol })
	const pfOrPs =
		protocolMcap != null && protocol.annualized1y != null
			? getMarketCapToAnnualizedMetricRatio(protocolMcap, protocol.annualized1y)
			: null
	const openInterest = openInterestProtocols.get(protocol.name)?.total24h
	const activeLiquidity = activeLiquidityProtocols.get(protocol.name)?.total24h
	const rawNormalizedVolume24h = normalizedVolumeProtocols.get(protocol.name)?.total24h
	// Reported USD volume is the upper bound for the alternate normalized calculation on perp pages.
	const normalizedVolume24h =
		adapterType !== ADAPTER_TYPES.PERPS
			? rawNormalizedVolume24h
			: rawNormalizedVolume24h != null && protocol.total24h != null
				? Math.min(rawNormalizedVolume24h, protocol.total24h)
				: null

	return {
		name: protocol.displayName,
		slug: protocol.slug,
		logo: protocol.protocolType === 'chain' ? chainIconUrl(protocol.slug) : tokenIconUrl(protocol.slug),
		chains: protocol.chains,
		category: protocol.category ?? null,
		total24h: protocol.total24h ?? null,
		total48hto24h: protocol.total48hto24h ?? null,
		total7d: protocol.total7d ?? null,
		total14dto7d: protocol.total14dto7d ?? null,
		total30d: protocol.total30d ?? null,
		total60dto30d: protocol.total60dto30d ?? null,
		total7DaysAgo: protocol.total7DaysAgo ?? null,
		total30DaysAgo: protocol.total30DaysAgo ?? null,
		total1y: protocol.total1y ?? null,
		annualized1y: protocol.annualized1y ?? null,
		totalAllTime: protocol.totalAllTime ?? null,
		change_1d: protocol.change_1d ?? null,
		change_7d: protocol.change_7d ?? null,
		change_1m: protocol.change_1m ?? null,
		change_7dover7d: protocol.change_7dover7d ?? null,
		change_30dover30d: protocol.change_30dover30d ?? null,
		mcap: protocolMcap ?? null,
		...(pfOrPs != null ? { pfOrPs } : {}),
		...(methodology ? { methodology: methodology.endsWith('.') ? methodology.slice(0, -1) : methodology } : {}),
		...(protocol.doublecounted ? { doublecounted: protocol.doublecounted } : {}),
		...(ZERO_FEE_PERPS.has(protocol.displayName) ? { zeroFeePerp: true } : {}),
		...(warning ? { warning } : {}),
		...(openInterest != null ? { openInterest } : {}),
		...(activeLiquidity != null ? { activeLiquidity } : {}),
		...(normalizedVolume24h != null ? { normalizedVolume24h } : {}),
		...(protocol.displayName !== protocol.name ? { breakdownAliases: [protocol.name] } : {})
	}
}

function buildSingleChildParentSummary(protocol: string, childProtocol: IProtocol): IProtocol {
	const breakdownAliases = new Set([childProtocol.name, ...(childProtocol.breakdownAliases ?? [])])
	breakdownAliases.delete(protocol)
	return {
		...childProtocol,
		name: protocol,
		slug: slug(protocol),
		breakdownAliases: Array.from(breakdownAliases)
	}
}

function buildParentProtocolSummary({
	protocol,
	childProtocols,
	protocolsMcap,
	dataType
}: {
	protocol: string
	childProtocols: NonEmptyArray<IProtocol>
	protocolsMcap: Map<string, number | null>
	dataType: AdapterByChainDataType | undefined
}): IProtocol {
	const [firstChildProtocol] = childProtocols
	const periodTotals =
		dataType === ADAPTER_DATA_TYPES.DAILY_EARNINGS
			? mergeParentEarningsMetricPeriods(childProtocols)
			: mergeParentMetricPeriods(childProtocols)
	let doublecounted = false
	let zeroFeePerp = false
	let warning: string | null = null
	let openInterest: number | null = null
	let activeLiquidity: number | null = null
	let normalizedVolume24h: number | null = null
	const methodologySet = new Set<string>()
	const methodologyChildrenByMethod = new Map<string, string[]>()
	let topProtocol = firstChildProtocol
	const breakdownAliasSet = new Set<string>()
	const chainSet = new Set<string>()

	for (const childProtocol of childProtocols) {
		if (childProtocol.doublecounted) doublecounted = true
		if (childProtocol.zeroFeePerp) zeroFeePerp = true
		if (!warning && childProtocol.warning) warning = childProtocol.warning
		if (childProtocol.openInterest != null) {
			openInterest = (openInterest ?? 0) + childProtocol.openInterest
		}
		if (childProtocol.activeLiquidity != null) {
			activeLiquidity = (activeLiquidity ?? 0) + childProtocol.activeLiquidity
		}
		if (childProtocol.normalizedVolume24h != null) {
			normalizedVolume24h = (normalizedVolume24h ?? 0) + childProtocol.normalizedVolume24h
		}
		if (childProtocol.methodology) {
			methodologySet.add(childProtocol.methodology)
			let children = methodologyChildrenByMethod.get(childProtocol.methodology)
			if (!children) {
				children = []
				methodologyChildrenByMethod.set(childProtocol.methodology, children)
			}
			children.push(
				childProtocol.name.startsWith(protocol) ? childProtocol.name.replace(protocol, '').trim() : childProtocol.name
			)
		}
		if ((childProtocol.total24h ?? 0) > (topProtocol.total24h ?? 0)) {
			topProtocol = childProtocol
		}
		if (childProtocol.name !== protocol) breakdownAliasSet.add(childProtocol.name)
		for (const alias of childProtocol.breakdownAliases ?? []) {
			if (alias !== protocol) breakdownAliasSet.add(alias)
		}
		for (const childChain of childProtocol.chains ?? []) {
			chainSet.add(childChain)
		}
	}

	const methodology = Array.from(methodologySet)
	let methodologyText: string | null = null
	const [onlyMethodology] = methodology
	if (methodology.length === 1 && onlyMethodology !== undefined) {
		methodologyText = onlyMethodology
	} else if (methodology.length > 1) {
		const methodologyParts: string[] = []
		for (const method of methodology) {
			methodologyParts.push(`${(methodologyChildrenByMethod.get(method) ?? []).join(', ')}: ${method}`)
		}
		methodologyText = methodologyParts.join('. ')
	}

	const protocolMcap = protocolsMcap.get(protocol)
	const pfOrPs =
		protocolMcap != null && periodTotals.annualized1y != null
			? getMarketCapToAnnualizedMetricRatio(protocolMcap, periodTotals.annualized1y)
			: null

	return {
		name: protocol,
		slug: slug(protocol),
		logo: tokenIconUrl(protocol),
		category: topProtocol.category ?? null,
		chains: Array.from(chainSet),
		total24h: periodTotals.total24h ?? null,
		total48hto24h: periodTotals.total48hto24h ?? null,
		total7d: periodTotals.total7d ?? null,
		total14dto7d: periodTotals.total14dto7d ?? null,
		total30d: periodTotals.total30d ?? null,
		total60dto30d: periodTotals.total60dto30d ?? null,
		total7DaysAgo: periodTotals.total7DaysAgo ?? null,
		total30DaysAgo: periodTotals.total30DaysAgo ?? null,
		total1y: periodTotals.total1y ?? null,
		annualized1y: periodTotals.annualized1y ?? null,
		totalAllTime: periodTotals.totalAllTime ?? null,
		change_1d: periodTotals.change_1d ?? null,
		change_7d: periodTotals.change_7d ?? null,
		change_1m: periodTotals.change_1m ?? null,
		change_7dover7d: periodTotals.change_7dover7d ?? null,
		change_30dover30d: periodTotals.change_30dover30d ?? null,
		mcap: protocolMcap ?? null,
		breakdownAliases: Array.from(breakdownAliasSet),
		childProtocols,
		...(pfOrPs != null ? { pfOrPs } : {}),
		...(methodologyText ? { methodology: methodologyText } : {}),
		...(doublecounted ? { doublecounted } : {}),
		...(zeroFeePerp ? { zeroFeePerp } : {}),
		...(warning ? { warning } : {}),
		...(openInterest != null ? { openInterest } : {}),
		...(activeLiquidity != null ? { activeLiquidity } : {}),
		...(normalizedVolume24h != null ? { normalizedVolume24h } : {})
	}
}

function sortFinalProtocols({
	protocols,
	rankBy
}: {
	protocols: Map<string, IProtocol>
	rankBy: AdapterByChainRankBy
}): IAdapterByChainPageData['protocols'] {
	const finalProtocols: IAdapterByChainPageData['protocols'] = []
	if (rankBy === 'pfOrPs') {
		for (const protocol of protocols.values()) {
			if (protocol.pfOrPs != null) {
				finalProtocols.push(protocol)
			}
		}
		finalProtocols.sort((a, b) => (b.pfOrPs ?? 0) - (a.pfOrPs ?? 0))
	} else {
		for (const protocol of protocols.values()) {
			finalProtocols.push(protocol)
		}
		finalProtocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
	}

	return finalProtocols
}

export function buildAdapterByChainReadModel({
	data,
	protocolsData,
	openInterestData,
	activeLiquidityData,
	normalizedVolumeData,
	adapterType,
	dataType,
	rankBy,
	cantonIncentivesWarning
}: {
	data: IAdapterChainOverview
	protocolsData: ProtocolMcapData
	openInterestData: IAdapterChainOverview | null
	activeLiquidityData: IAdapterChainOverview | null
	normalizedVolumeData: IAdapterChainMetrics | null
	adapterType: `${ADAPTER_TYPES}`
	dataType: AdapterByChainDataType | undefined
	rankBy: AdapterByChainRankBy
	cantonIncentivesWarning: string | null
}): AdapterByChainReadModel {
	const protocolsMcap = buildProtocolsMcap(protocolsData)
	const openInterestProtocols = new Map<string, OpenInterestData>()
	const activeLiquidityProtocols = new Map<string, ActiveLiquidityData>()
	const normalizedVolumeProtocols = new Map<string, NormalizedVolumeData>()

	if (openInterestData) {
		for (const protocol of openInterestData.protocols) {
			openInterestProtocols.set(protocol.name, {
				total24h: protocol.total24h ?? null,
				doublecounted: !!protocol.doublecounted
			})
		}
	}

	if (activeLiquidityData) {
		for (const protocol of activeLiquidityData.protocols) {
			activeLiquidityProtocols.set(protocol.name, {
				total24h: protocol.total24h ?? null,
				doublecounted: !!protocol.doublecounted
			})
		}
	}

	if (normalizedVolumeData) {
		for (const protocol of normalizedVolumeData.protocols) {
			normalizedVolumeProtocols.set(protocol.name, {
				total24h: protocol.total24h ?? null
			})
		}
	}

	const protocols = new Map<string, IProtocol>()
	const parentProtocols = new Map<string, NonEmptyArray<IProtocol>>()
	const categories = new Set<string>()

	for (const protocol of data.protocols) {
		const summary = buildProtocolSummary({
			protocol,
			adapterType,
			dataType,
			protocolMcap: protocolsMcap.get(protocol.name),
			openInterestProtocols,
			activeLiquidityProtocols,
			normalizedVolumeProtocols,
			cantonIncentivesWarning
		})

		const parentProtocol = protocol.linkedProtocols?.[0]
		if (protocol.linkedProtocols && protocol.linkedProtocols.length > 1 && parentProtocol !== undefined) {
			const children = parentProtocols.get(parentProtocol)
			if (children) {
				children.push(summary)
			} else {
				parentProtocols.set(parentProtocol, [summary])
			}
		} else {
			protocols.set(protocol.displayName, summary)
		}
		if (protocol.category) {
			categories.add(protocol.category)
		}
	}

	for (const [protocol, childProtocols] of parentProtocols) {
		if (childProtocols.length === 1) {
			protocols.set(protocol, buildSingleChildParentSummary(protocol, childProtocols[0]))
			continue
		}
		protocols.set(protocol, buildParentProtocolSummary({ protocol, childProtocols, protocolsMcap, dataType }))
	}

	return {
		protocols: sortFinalProtocols({ protocols, rankBy }),
		categories: adapterType === 'fees' ? Array.from(categories).sort() : [],
		openInterest: openInterestData?.total24h ?? null,
		activeLiquidity: activeLiquidityData?.total24h ?? null
	}
}
