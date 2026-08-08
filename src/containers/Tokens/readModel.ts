import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { TokenOverviewCurrentMetrics } from '~/containers/Token/tokenOverview'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { TokenDirectoryRecord } from '~/utils/tokenDirectory'

/**
 * Pure transforms over the token market universe, shared by the snapshot
 * builder (server/tableData.server.ts) and the source-rows assembly
 * (queries.server.ts). Nothing here fetches or caches.
 */

interface TokenDirectoryIndexes {
	byGeckoId: Map<string, TokenDirectoryRecord>
	protocolIdByGeckoId: Map<string, string>
}

export const EMPTY_MARKETS_LIST: TokenMarketsListResponse = {
	last_updated: '',
	tokens: []
}

function tokenRecordGeckoId(record: TokenDirectoryRecord): string | null {
	if (!record.token_nk?.startsWith('coingecko:')) return null
	const geckoId = record.token_nk.slice('coingecko:'.length).toLowerCase()
	return geckoId || null
}

export function buildTokenDirectoryIndexes(metadata: MetadataCache): TokenDirectoryIndexes {
	const byGeckoId = new Map<string, TokenDirectoryRecord>()
	const protocolIdByGeckoId = new Map<string, string>()

	for (const key in metadata.tokenDirectory) {
		const record = metadata.tokenDirectory[key]
		if (record === undefined) continue
		const geckoId = tokenRecordGeckoId(record)
		if (geckoId && !byGeckoId.has(geckoId)) byGeckoId.set(geckoId, record)
	}

	for (const protocolId in metadata.protocolMetadata) {
		const protocol = metadata.protocolMetadata[protocolId]
		if (protocol === undefined) continue
		const geckoId = protocol.gecko_id?.toLowerCase()
		if (!geckoId) continue
		const currentProtocolId = protocolIdByGeckoId.get(geckoId)
		if (!currentProtocolId || (!currentProtocolId.startsWith('parent#') && protocolId.startsWith('parent#'))) {
			protocolIdByGeckoId.set(geckoId, protocolId)
		}
	}

	return { byGeckoId, protocolIdByGeckoId }
}

export function buildUniqueTokenSymbols(tokens: IResponseCGTokenRankingsDatasetItem[]): Set<string> {
	const counts = new Map<string, number>()
	for (const token of tokens) {
		const symbol = token.symbol.toUpperCase()
		counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
	}

	const uniqueSymbols = new Set<string>()
	for (const [symbol, count] of counts) {
		if (count === 1) uniqueSymbols.add(symbol)
	}
	return uniqueSymbols
}

export function buildMarketsMap(
	markets: TokenMarketsListResponse,
	uniqueTokenSymbols: Set<string>
): Map<string, TokenMarketsListResponse['tokens'][number]> {
	const map = new Map<string, TokenMarketsListResponse['tokens'][number]>()
	for (const entry of markets.tokens) {
		const symbol = entry.symbol.toUpperCase()
		// The markets dataset is symbol-keyed, so duplicate CoinGecko symbols would otherwise inherit each other's metrics.
		if (uniqueTokenSymbols.has(symbol)) map.set(symbol, entry)
	}
	return map
}

export function resolveProtocolId(
	geckoId: string,
	record: TokenDirectoryRecord | undefined,
	indexes: TokenDirectoryIndexes
): string | null {
	return record?.protocolId ?? indexes.protocolIdByGeckoId.get(geckoId) ?? null
}

export function resolveEmissionsProtocolSlug(
	record: TokenDirectoryRecord | undefined,
	protocolId: string | null,
	protocolMetadata: MetadataCache['protocolMetadata'][string] | undefined,
	metadata: MetadataCache
): string | null {
	const candidates = [
		protocolId?.replace(/^parent#/, ''),
		protocolMetadata?.name,
		protocolMetadata?.displayName,
		record?.chainId
	]

	for (const candidate of candidates) {
		const candidateSlug = slug(candidate)
		if (candidateSlug && metadata.emissionsSupplyMetrics[candidateSlug]) return candidateSlug
	}

	return null
}

export function buildTokenOverviewCurrentMetricsById({
	tokens,
	markets,
	metadata
}: {
	tokens: IResponseCGTokenRankingsDatasetItem[]
	markets: TokenMarketsListResponse
	metadata: MetadataCache
}): Record<string, TokenOverviewCurrentMetrics> {
	const currentMetricsById: Record<string, TokenOverviewCurrentMetrics> = {}
	const indexes = buildTokenDirectoryIndexes(metadata)
	const marketsBySymbol = buildMarketsMap(markets, buildUniqueTokenSymbols(tokens))

	for (const token of tokens) {
		const geckoId = token.id.toLowerCase()
		const record = indexes.byGeckoId.get(geckoId)
		const protocolId = resolveProtocolId(geckoId, record, indexes)
		const protocolMetadata = protocolId ? metadata.protocolMetadata[protocolId] : undefined
		const emissionsProtocolSlug = resolveEmissionsProtocolSlug(record, protocolId, protocolMetadata, metadata)
		const adjustedSupply = emissionsProtocolSlug
			? (metadata.emissionsSupplyMetrics[emissionsProtocolSlug]?.supplyMetrics.adjustedSupply ?? null)
			: null
		const currentPrice =
			token.current_price ?? marketsBySymbol.get(token.symbol.toUpperCase())?.segments.spot?.price ?? null

		currentMetricsById[geckoId] = {
			currentPrice,
			percentChange24h: token.price_change_percentage_24h_in_currency ?? token.price_change_percentage_24h ?? null,
			circulatingSupply: token.circulating_supply ?? null,
			totalSupply: token.total_supply ?? null,
			maxSupply: token.max_supply ?? null,
			mcap: token.market_cap ?? null,
			fdv: token.fully_diluted_valuation ?? null,
			volume24h: token.total_volume ?? null,
			outstandingFDV:
				adjustedSupply != null && token.current_price != null ? adjustedSupply * token.current_price : null
		}
	}

	return currentMetricsById
}

export function buildTokenIndexById(tokens: IResponseCGTokenRankingsDatasetItem[]): Map<string, number> {
	const tokenIndexById = new Map<string, number>()
	let index = 0
	for (const token of tokens) {
		tokenIndexById.set(token.id.toLowerCase(), index)
		index++
	}
	return tokenIndexById
}
