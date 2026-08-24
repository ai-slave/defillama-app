import type { BlockExplorersResponse } from '~/api/types'
import { getAliasGroup } from '~/constants/tokenAliases'
import { slug } from '~/utils'
import { findBlockExplorerChain } from '~/utils/blockExplorers'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import type {
	LiquidationsDistributionChartData,
	LiquidationsDistributionChartSeries,
	LiquidationsChainPageProps,
	LiquidationsChainRef,
	LiquidationsOverviewPageProps,
	LiquidationsProtocolPageProps,
	LiquidationsProtocolRef,
	LiquidationPosition,
	NavLink,
	OverviewChainRow,
	OverviewProtocolRow,
	ProtocolChainRow,
	RawAllLiquidationsResponse,
	RawLiquidationPosition,
	RawLiquidationsProtocolData,
	RawProtocolsResponse,
	TokenLiquidationsSectionData
} from './api.types'
import { createProtocolMetadataLookup } from './protocolMetadata'

export interface LiquidationsMetadataCache {
	chainMetadata: Record<string, IChainMetadata>
	protocolMetadata: Record<string, IProtocolMetadata>
}

type LiquidationsProtocolMetadata = IProtocolMetadata & { name?: string }

interface ChainAggregate {
	chain: LiquidationsChainRef
	positionCount: number
	protocolIds: Set<string>
	collaterals: Set<string>
	totalCollateralUsd: number
}

const LIQUIDATIONS_V2_TOTAL_BINS = 60
function getProtocolRef(
	protocolId: string,
	protocolMetadataLookup: Map<string, LiquidationsProtocolMetadata>
): LiquidationsProtocolRef {
	const name = protocolMetadataLookup.get(protocolId)?.displayName ?? protocolId

	return {
		id: protocolId,
		name,
		slug: slug(protocolId)
	}
}

function getChainRef(chainId: string, chainMetadata: Record<string, IChainMetadata>): LiquidationsChainRef {
	const name = chainMetadata[slug(chainId)]?.name ?? chainId

	return {
		id: chainId,
		name,
		slug: slug(chainId)
	}
}

function getProtocolLinks(
	protocolIds: string[],
	protocolMetadataLookup: Map<string, LiquidationsProtocolMetadata>
): NavLink[] {
	const protocolRefs = protocolIds.map((protocolId) => getProtocolRef(protocolId, protocolMetadataLookup))

	return [
		{ label: 'Overview', to: '/liquidations' },
		...protocolRefs.map((protocol) => ({ label: protocol.name, to: `/liquidations/${protocol.slug}` }))
	]
}

function getChainLinksFromRefs(protocol: LiquidationsProtocolRef, chainRefs: LiquidationsChainRef[]): NavLink[] {
	return [
		{ label: 'All Chains', to: `/liquidations/${protocol.slug}` },
		...chainRefs.map((chain) => ({ label: chain.name, to: `/liquidations/${protocol.slug}/${chain.slug}` }))
	]
}

function normalizePosition(
	protocol: LiquidationsProtocolRef,
	chain: LiquidationsChainRef,
	position: RawLiquidationPosition
): LiquidationPosition {
	return {
		protocolId: protocol.id,
		protocolName: protocol.name,
		protocolSlug: protocol.slug,
		chainId: chain.id,
		chainName: chain.name,
		chainSlug: chain.slug,
		owner: position.owner,
		liqPrice: position.liqPrice,
		collateral: position.collateral,
		collateralId: position.collateralId,
		collateralAmount: position.collateralAmount,
		collateralAmountUsd: position.collateralAmountUsd
	}
}

type LiquidationsChartPosition = Pick<
	LiquidationPosition,
	| 'liqPrice'
	| 'collateral'
	| 'collateralAmount'
	| 'collateralAmountUsd'
	| 'protocolId'
	| 'protocolName'
	| 'chainId'
	| 'chainName'
>

interface LiquidationsTokenGroup {
	label: string
	maxPrice: number
	totalUsd: number
	positions: LiquidationsChartPosition[]
}

const sortLiquidationsSeries = (series: LiquidationsDistributionChartSeries[]) =>
	series.sort((a, b) => {
		if (b.totalUsd !== a.totalUsd) return b.totalUsd - a.totalUsd
		return a.label.localeCompare(b.label)
	})

export function buildLiquidationsDistributionChart(
	positions: LiquidationsChartPosition[],
	totalBins = LIQUIDATIONS_V2_TOTAL_BINS,
	tokenIdentity?: { key: string; label: string }
): LiquidationsDistributionChartData {
	const tokenGroups = new Map<string, LiquidationsTokenGroup>()
	for (const position of positions) {
		const tokenKey = tokenIdentity?.key ?? position.collateral
		const tokenLabel = tokenIdentity?.label ?? position.collateral
		const group = tokenGroups.get(tokenKey)
		if (group) {
			group.label = tokenLabel
			group.totalUsd += position.collateralAmountUsd
			if (position.liqPrice > group.maxPrice) group.maxPrice = position.liqPrice
			group.positions.push(position)
		} else {
			tokenGroups.set(tokenKey, {
				label: tokenLabel,
				maxPrice: position.liqPrice,
				totalUsd: position.collateralAmountUsd,
				positions: [position]
			})
		}
	}

	// The mapper materializes the final token array directly; raw positions still use one direct scan per group.
	const tokens = Array.from(tokenGroups, ([tokenKey, group]) => {
		const binCount = Math.max(1, totalBins)
		const priceCeiling = group.maxPrice > 0 ? group.maxPrice : 1
		const binSize = priceCeiling / binCount
		const bins = Array.from({ length: binCount }, (_, index) => index * binSize)
		const totalSeries: LiquidationsDistributionChartSeries = {
			key: tokenKey,
			label: group.label,
			usd: new Array(binCount).fill(0),
			amount: new Array(binCount).fill(0),
			totalUsd: 0
		}
		const protocolSeries = new Map<string, LiquidationsDistributionChartSeries>()
		const chainSeries = new Map<string, LiquidationsDistributionChartSeries>()

		// Bins depend on the first-stage max price, so all three views are populated together in this second scan.
		for (const position of group.positions) {
			const binIndex = Math.min(binCount - 1, Math.floor(position.liqPrice / binSize))
			totalSeries.usd[binIndex]! += position.collateralAmountUsd
			totalSeries.amount[binIndex]! += position.collateralAmount
			totalSeries.totalUsd += position.collateralAmountUsd

			let protocol = protocolSeries.get(position.protocolId)
			if (!protocol) {
				protocol = {
					key: position.protocolId,
					label: position.protocolName,
					usd: new Array(binCount).fill(0),
					amount: new Array(binCount).fill(0),
					totalUsd: 0
				}
				protocolSeries.set(position.protocolId, protocol)
			}
			protocol.usd[binIndex]! += position.collateralAmountUsd
			protocol.amount[binIndex]! += position.collateralAmount
			protocol.totalUsd += position.collateralAmountUsd

			let chain = chainSeries.get(position.chainId)
			if (!chain) {
				chain = {
					key: position.chainId,
					label: position.chainName,
					usd: new Array(binCount).fill(0),
					amount: new Array(binCount).fill(0),
					totalUsd: 0
				}
				chainSeries.set(position.chainId, chain)
			}
			chain.usd[binIndex]! += position.collateralAmountUsd
			chain.amount[binIndex]! += position.collateralAmount
			chain.totalUsd += position.collateralAmountUsd
		}

		return {
			key: tokenKey,
			label: group.label,
			totalUsd: group.totalUsd,
			breakdowns: {
				total: { bins, series: [totalSeries] },
				protocol: { bins, series: sortLiquidationsSeries(Array.from(protocolSeries.values())) },
				chain: { bins, series: sortLiquidationsSeries(Array.from(chainSeries.values())) }
			}
		}
	}).sort((a, b) => {
		if (b.totalUsd !== a.totalUsd) return b.totalUsd - a.totalUsd
		return a.label.localeCompare(b.label)
	})

	return {
		tokens
	}
}

function sortByCountAndName<T extends { positionCount: number; name: string }>(rows: T[]): T[] {
	return rows.sort((a, b) => {
		if (b.positionCount !== a.positionCount) return b.positionCount - a.positionCount
		return a.name.localeCompare(b.name)
	})
}

type FamilyRowCounts = Map<string, Map<string, number>>

function incrementFamilyRowCount(counts: FamilyRowCounts, symbol: string, id: string): void {
	let symbolCounts = counts.get(symbol)
	if (!symbolCounts) {
		symbolCounts = new Map<string, number>()
		counts.set(symbol, symbolCounts)
	}
	symbolCounts.set(id, (symbolCounts.get(id) ?? 0) + 1)
}

function orderFamilyRows<T extends { id: string; name: string }>(
	rows: T[],
	familySymbolOrder: string[],
	counts: FamilyRowCounts
): T[] {
	const rowsById = new Map<string, T>()
	for (const row of rows) rowsById.set(row.id, row)
	const ordered: T[] = []
	const seen = new Set<string>()

	for (const symbol of familySymbolOrder) {
		const symbolCounts = counts.get(symbol)
		if (!symbolCounts) continue
		const ids = Array.from(symbolCounts, ([id, positionCount]) => ({ id, positionCount }))
		ids.sort((a, b) => {
			if (b.positionCount !== a.positionCount) return b.positionCount - a.positionCount
			const aName = rowsById.get(a.id)?.name ?? a.id
			const bName = rowsById.get(b.id)?.name ?? b.id
			return aName.localeCompare(bName)
		})
		for (const { id } of ids) {
			if (seen.has(id)) continue
			const row = rowsById.get(id)
			if (!row) continue
			seen.add(id)
			ordered.push(row)
		}
	}

	return ordered
}

function buildOverviewChainRows(chainAggregates: ChainAggregate[]): OverviewChainRow[] {
	const rows = new Array<OverviewChainRow>(chainAggregates.length)
	for (let index = 0; index < chainAggregates.length; index += 1) {
		const aggregate = chainAggregates[index]!
		rows[index] = {
			...aggregate.chain,
			positionCount: aggregate.positionCount,
			protocolCount: aggregate.protocolIds.size,
			collateralCount: aggregate.collaterals.size,
			totalCollateralUsd: aggregate.totalCollateralUsd
		}
	}
	return sortByCountAndName(rows)
}

export function resolveProtocolId(
	protocolParam: string,
	availableProtocolIds: string[],
	protocolMetadataLookup: Map<string, LiquidationsProtocolMetadata>
): string | null {
	const normalizedProtocolParam = slug(protocolParam)

	for (const protocolId of availableProtocolIds) {
		const protocol = getProtocolRef(protocolId, protocolMetadataLookup)
		if (protocol.slug === normalizedProtocolParam || slug(protocol.name) === normalizedProtocolParam) {
			return protocolId
		}
	}

	return null
}

export function resolveChainId(
	chainParam: string,
	availableChainIds: string[],
	chainMetadata: Record<string, IChainMetadata>
): string | null {
	const normalizedChainParam = slug(chainParam)

	for (const chainId of availableChainIds) {
		const chain = getChainRef(chainId, chainMetadata)
		if (chain.slug === normalizedChainParam || slug(chain.name) === normalizedChainParam) {
			return chainId
		}
	}

	return null
}

function filterBlockExplorersForChains({
	blockExplorers,
	chainIds,
	chainMetadata
}: {
	blockExplorers: BlockExplorersResponse
	chainIds: string[]
	chainMetadata: Record<string, IChainMetadata>
}): BlockExplorersResponse {
	return blockExplorers.filter((entry) =>
		chainIds.some(
			(chainId) =>
				findBlockExplorerChain([entry], {
					chainId,
					chainName: getChainRef(chainId, chainMetadata).name
				}) != null
		)
	)
}

export function buildLiquidationsOverviewPageData(
	protocolsResponse: RawProtocolsResponse,
	allResponse: RawAllLiquidationsResponse,
	metadataCache: LiquidationsMetadataCache
): LiquidationsOverviewPageProps {
	const protocolIds = protocolsResponse.protocols
	const protocolMetadataLookup = createProtocolMetadataLookup(metadataCache.protocolMetadata)
	const protocolLinks = getProtocolLinks(protocolIds, protocolMetadataLookup)
	const protocolRows: OverviewProtocolRow[] = []
	const chainMap = new Map<string, ChainAggregate>()
	const chainAggregates: ChainAggregate[] = []
	const chartPositions: LiquidationPosition[] = []
	let positionCount = 0
	let totalCollateralUsd = 0

	for (const protocolId of protocolIds) {
		const protocol = getProtocolRef(protocolId, protocolMetadataLookup)
		const protocolData = allResponse.data[protocolId] ?? {}
		let protocolPositionCount = 0
		let protocolTotalCollateralUsd = 0
		const protocolCollaterals = new Set<string>()
		let protocolChainCount = 0

		for (const chainId in protocolData) {
			const positions = protocolData[chainId]
			if (!positions) continue
			protocolChainCount += 1
			const chain = getChainRef(chainId, metadataCache.chainMetadata)
			protocolPositionCount += positions.length
			positionCount += positions.length

			let chainAggregate = chainMap.get(chain.id)
			if (!chainAggregate) {
				chainAggregate = {
					chain,
					positionCount: 0,
					protocolIds: new Set<string>(),
					collaterals: new Set<string>(),
					totalCollateralUsd: 0
				}
				chainMap.set(chain.id, chainAggregate)
				chainAggregates.push(chainAggregate)
			}

			chainAggregate.positionCount += positions.length
			chainAggregate.protocolIds.add(protocol.id)

			let chainCollateralUsd = 0
			for (const position of positions) {
				const normalizedPosition = normalizePosition(protocol, chain, position)
				chartPositions.push(normalizedPosition)
				chainCollateralUsd += position.collateralAmountUsd
				protocolCollaterals.add(normalizedPosition.collateral)
				chainAggregate.collaterals.add(normalizedPosition.collateral)
			}
			protocolTotalCollateralUsd += chainCollateralUsd
			totalCollateralUsd += chainCollateralUsd
			chainAggregate.totalCollateralUsd += chainCollateralUsd
		}

		protocolRows.push({
			...protocol,
			positionCount: protocolPositionCount,
			chainCount: protocolChainCount,
			collateralCount: protocolCollaterals.size,
			totalCollateralUsd: protocolTotalCollateralUsd
		})
	}

	return {
		protocolLinks,
		timestamp: allResponse.timestamp,
		protocolCount: protocolIds.length,
		chainCount: chainMap.size,
		positionCount,
		totalCollateralUsd,
		distributionChart: buildLiquidationsDistributionChart(chartPositions),
		protocolRows: sortByCountAndName(protocolRows),
		chainRows: buildOverviewChainRows(chainAggregates)
	}
}

export function buildTokenLiquidationsSectionData(
	tokenSymbol: string,
	protocolsResponse: RawProtocolsResponse,
	allResponse: RawAllLiquidationsResponse,
	metadataCache: LiquidationsMetadataCache
): TokenLiquidationsSectionData | null {
	if (!tokenSymbol) return null
	const aliases = getAliasGroup(tokenSymbol)
	const hasAliasFamily = aliases.length > 1
	const familySymbols = hasAliasFamily ? new Set(aliases) : null
	const familySymbolOrder = hasAliasFamily ? aliases : [tokenSymbol]
	const familySymbolByProducerSymbol = new Map<string, string | null>()

	const protocolMetadataLookup = createProtocolMetadataLookup(metadataCache.protocolMetadata)
	const protocolRows: OverviewProtocolRow[] = []
	const chainMap = new Map<string, ChainAggregate>()
	const chainAggregates: ChainAggregate[] = []
	const chartPositionsBySymbol = new Map<string, LiquidationPosition[]>()
	const protocolCountsBySymbol: FamilyRowCounts = new Map()
	const chainCountsBySymbol: FamilyRowCounts = new Map()
	const chainProtocolIdsBySymbol = new Map<string, Map<string, Set<string>>>()
	const chainMaxProtocolCount = new Map<string, number>()
	let hasExactToken = false
	let positionCount = 0
	let totalCollateralUsd = 0

	for (const protocolId of protocolsResponse.protocols) {
		const protocol = getProtocolRef(protocolId, protocolMetadataLookup)
		const protocolData = allResponse.data[protocolId] ?? {}
		let protocolPositionCount = 0
		let protocolTotalCollateralUsd = 0
		const protocolChainIdsBySymbol = new Map<string, Set<string>>()
		const protocolCollaterals = new Set<string>()

		for (const chainId in protocolData) {
			const rawPositions = protocolData[chainId]
			if (!rawPositions) continue
			let chainPositionCount = 0
			let chainCollateralUsd = 0
			let chainAggregate = chainMap.get(chainId)
			const matchedSymbols = new Set<string>()

			for (const position of rawPositions) {
				let familySymbol = familySymbolByProducerSymbol.get(position.collateral)
				if (familySymbol === undefined) {
					if (position.collateral === tokenSymbol) {
						familySymbol = hasAliasFamily ? position.collateral.toLowerCase() : position.collateral
					} else if (familySymbols) {
						const alias = position.collateral.toLowerCase()
						familySymbol = familySymbols.has(alias) ? alias : null
					} else {
						familySymbol = null
					}
					familySymbolByProducerSymbol.set(position.collateral, familySymbol)
				}
				if (!familySymbol) continue
				if (position.collateral === tokenSymbol) hasExactToken = true

				if (!chainAggregate) {
					const chain = getChainRef(chainId, metadataCache.chainMetadata)
					chainAggregate = {
						chain,
						positionCount: 0,
						protocolIds: new Set<string>(),
						collaterals: new Set<string>(),
						totalCollateralUsd: 0
					}
					chainMap.set(chain.id, chainAggregate)
					chainAggregates.push(chainAggregate)
				}

				const normalizedPosition = normalizePosition(protocol, chainAggregate.chain, position)
				const symbolPositions = chartPositionsBySymbol.get(position.collateral)
				if (symbolPositions) {
					symbolPositions.push(normalizedPosition)
				} else {
					chartPositionsBySymbol.set(position.collateral, [normalizedPosition])
				}
				chainPositionCount += 1
				chainCollateralUsd += position.collateralAmountUsd
				chainAggregate.collaterals.add(position.collateral)
				protocolCollaterals.add(position.collateral)
				matchedSymbols.add(familySymbol)
				incrementFamilyRowCount(protocolCountsBySymbol, familySymbol, protocol.id)
				incrementFamilyRowCount(chainCountsBySymbol, familySymbol, chainAggregate.chain.id)
			}

			if (chainPositionCount === 0 || !chainAggregate) continue

			protocolPositionCount += chainPositionCount
			protocolTotalCollateralUsd += chainCollateralUsd
			positionCount += chainPositionCount
			totalCollateralUsd += chainCollateralUsd
			chainAggregate.positionCount += chainPositionCount
			chainAggregate.protocolIds.add(protocol.id)
			chainAggregate.totalCollateralUsd += chainCollateralUsd
			for (const symbol of matchedSymbols) {
				let protocolChainIds = protocolChainIdsBySymbol.get(symbol)
				if (!protocolChainIds) {
					protocolChainIds = new Set<string>()
					protocolChainIdsBySymbol.set(symbol, protocolChainIds)
				}
				protocolChainIds.add(chainAggregate.chain.id)

				let protocolIdsBySymbol = chainProtocolIdsBySymbol.get(chainAggregate.chain.id)
				if (!protocolIdsBySymbol) {
					protocolIdsBySymbol = new Map<string, Set<string>>()
					chainProtocolIdsBySymbol.set(chainAggregate.chain.id, protocolIdsBySymbol)
				}
				let protocolIds = protocolIdsBySymbol.get(symbol)
				if (!protocolIds) {
					protocolIds = new Set<string>()
					protocolIdsBySymbol.set(symbol, protocolIds)
				}
				protocolIds.add(protocol.id)
				const previousMax = chainMaxProtocolCount.get(chainAggregate.chain.id) ?? 0
				if (protocolIds.size > previousMax) chainMaxProtocolCount.set(chainAggregate.chain.id, protocolIds.size)
			}
		}

		if (protocolPositionCount > 0) {
			let chainCount = 0
			for (const chainIds of protocolChainIdsBySymbol.values()) {
				if (chainIds.size > chainCount) chainCount = chainIds.size
			}
			protocolRows.push({
				...protocol,
				positionCount: protocolPositionCount,
				chainCount,
				collateralCount: protocolCollaterals.size,
				totalCollateralUsd: protocolTotalCollateralUsd
			})
		}
	}

	if (!hasExactToken) return null
	const distributionTokens: LiquidationsDistributionChartData['tokens'] = []
	for (const [symbol, symbolPositions] of chartPositionsBySymbol) {
		const chart = buildLiquidationsDistributionChart(symbolPositions, LIQUIDATIONS_V2_TOTAL_BINS, {
			key: symbol,
			label: symbol
		})
		for (const token of chart.tokens) distributionTokens.push(token)
	}
	distributionTokens.sort((a, b) => {
		if (b.totalUsd !== a.totalUsd) return b.totalUsd - a.totalUsd
		return a.label.localeCompare(b.label)
	})
	const chainRows = buildOverviewChainRows(chainAggregates)
	for (const row of chainRows) row.protocolCount = chainMaxProtocolCount.get(row.id)!

	return {
		tokenSymbol,
		timestamp: allResponse.timestamp,
		positionCount,
		protocolCount: protocolRows.length,
		chainCount: chainMap.size,
		totalCollateralUsd,
		distributionChart: { tokens: distributionTokens },
		protocolRows: orderFamilyRows(protocolRows, familySymbolOrder, protocolCountsBySymbol),
		chainRows: orderFamilyRows(chainRows, familySymbolOrder, chainCountsBySymbol)
	}
}

export function hasTokenLiquidationsData(
	tokenSymbol: string,
	protocolsResponse: RawProtocolsResponse,
	allResponse: RawAllLiquidationsResponse
): boolean {
	if (!tokenSymbol) return false

	for (const protocolId of protocolsResponse.protocols) {
		const protocolData = allResponse.data[protocolId]
		if (!protocolData) {
			continue
		}

		for (const chainId in protocolData) {
			const positions = protocolData[chainId]
			if (!positions) continue

			for (const position of positions) {
				if (position.collateral === tokenSymbol) return true
			}
		}
	}

	return false
}

export function buildLiquidationsProtocolPageData(
	protocolId: string,
	protocolIds: string[],
	protocolData: RawLiquidationsProtocolData,
	timestamp: number,
	blockExplorers: BlockExplorersResponse,
	metadataCache: LiquidationsMetadataCache
): LiquidationsProtocolPageProps {
	const protocolMetadataLookup = createProtocolMetadataLookup(metadataCache.protocolMetadata)
	const protocol = getProtocolRef(protocolId, protocolMetadataLookup)
	const protocolLinks = getProtocolLinks(protocolIds, protocolMetadataLookup)
	const chainIds: string[] = []
	const chainRefs: LiquidationsChainRef[] = []
	for (const chainId in protocolData) {
		chainIds.push(chainId)
		chainRefs.push(getChainRef(chainId, metadataCache.chainMetadata))
	}
	chainRefs.sort((a, b) => a.name.localeCompare(b.name))
	const chainLinks = getChainLinksFromRefs(protocol, chainRefs)
	const ownerBlockExplorers = filterBlockExplorersForChains({
		blockExplorers,
		chainIds,
		chainMetadata: metadataCache.chainMetadata
	})
	let totalPositionCount = 0
	for (const chainId in protocolData) {
		const chainPositions = protocolData[chainId]
		if (chainPositions) totalPositionCount += chainPositions.length
	}
	const positions = new Array<LiquidationPosition>(totalPositionCount)
	let positionIndex = 0
	const chainRows: ProtocolChainRow[] = []
	const allCollaterals = new Set<string>()
	let totalCollateralUsd = 0

	for (const chain of chainRefs) {
		const rawPositions = protocolData[chain.id]
		if (!rawPositions) continue
		const chainCollaterals = new Set<string>()
		let chainCollateralUsd = 0
		for (const rawPosition of rawPositions) {
			const position = normalizePosition(protocol, chain, rawPosition)
			positions[positionIndex] = position
			positionIndex += 1
			chainCollateralUsd += position.collateralAmountUsd
			chainCollaterals.add(position.collateral)
			allCollaterals.add(position.collateral)
		}
		totalCollateralUsd += chainCollateralUsd
		chainRows.push({
			...chain,
			protocolId: protocol.id,
			protocolName: protocol.name,
			protocolSlug: protocol.slug,
			positionCount: rawPositions.length,
			collateralCount: chainCollaterals.size,
			totalCollateralUsd: chainCollateralUsd
		})
	}

	return {
		protocolLinks,
		chainLinks,
		protocolId: protocol.id,
		protocolName: protocol.name,
		protocolSlug: protocol.slug,
		timestamp,
		chainCount: chainIds.length,
		positionCount: positions.length,
		collateralCount: allCollaterals.size,
		totalCollateralUsd,
		distributionChart: buildLiquidationsDistributionChart(positions),
		chainRows: sortByCountAndName(chainRows),
		ownerBlockExplorers,
		positions
	}
}

export function buildLiquidationsChainPageData(
	protocolId: string,
	chainId: string,
	protocolIds: string[],
	protocolData: RawLiquidationsProtocolData,
	timestamp: number,
	blockExplorers: BlockExplorersResponse,
	metadataCache: LiquidationsMetadataCache
): LiquidationsChainPageProps {
	const protocolMetadataLookup = createProtocolMetadataLookup(metadataCache.protocolMetadata)
	const protocol = getProtocolRef(protocolId, protocolMetadataLookup)
	const chainIds: string[] = []
	const sortedChainRefs: LiquidationsChainRef[] = []
	for (const currentChainId in protocolData) {
		chainIds.push(currentChainId)
		sortedChainRefs.push(getChainRef(currentChainId, metadataCache.chainMetadata))
	}
	sortedChainRefs.sort((a, b) => a.name.localeCompare(b.name))
	const chain = getChainRef(chainId, metadataCache.chainMetadata)
	const protocolLinks = getProtocolLinks(protocolIds, protocolMetadataLookup)
	const chainLinks = getChainLinksFromRefs(protocol, sortedChainRefs)
	const ownerBlockExplorers = filterBlockExplorersForChains({
		blockExplorers,
		chainIds: [chainId],
		chainMetadata: metadataCache.chainMetadata
	})
	const chainPositions = protocolData[chainId] ?? []
	const positions = new Array<LiquidationPosition>(chainPositions.length)
	const chainRows: ProtocolChainRow[] = []
	const selectedCollaterals = new Set<string>()
	let selectedCollateralUsd = 0
	let selectedPositionIndex = 0

	for (const currentChain of sortedChainRefs) {
		const currentChainPositions = protocolData[currentChain.id]
		if (!currentChainPositions) continue
		const currentCollaterals = new Set<string>()
		let currentCollateralUsd = 0
		for (const rawPosition of currentChainPositions) {
			currentCollateralUsd += rawPosition.collateralAmountUsd
			if (currentChain.id === chainId) {
				const position = normalizePosition(protocol, chain, rawPosition)
				positions[selectedPositionIndex] = position
				selectedPositionIndex += 1
				selectedCollaterals.add(position.collateral)
				currentCollaterals.add(position.collateral)
			} else {
				currentCollaterals.add(rawPosition.collateral)
			}
		}
		if (currentChain.id === chainId) selectedCollateralUsd = currentCollateralUsd
		chainRows.push({
			...currentChain,
			protocolId: protocol.id,
			protocolName: protocol.name,
			protocolSlug: protocol.slug,
			positionCount: currentChainPositions.length,
			collateralCount: currentCollaterals.size,
			totalCollateralUsd: currentCollateralUsd
		})
	}

	return {
		protocolLinks,
		chainLinks,
		protocolId: protocol.id,
		protocolName: protocol.name,
		protocolSlug: protocol.slug,
		chainId: chain.id,
		chainName: chain.name,
		chainSlug: chain.slug,
		timestamp,
		positionCount: positions.length,
		collateralCount: selectedCollaterals.size,
		totalCollateralUsd: selectedCollateralUsd,
		distributionChart: buildLiquidationsDistributionChart(positions),
		chainRows: sortByCountAndName(chainRows),
		ownerBlockExplorers,
		positions
	}
}
