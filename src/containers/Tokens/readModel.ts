import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
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
	metadata
}: {
	tokens: Array<IResponseCGTokenRankingsDatasetItem>
	metadata: MetadataCache
}): Record<string, TokenOverviewCurrentMetrics> {
	const currentMetricsById: Record<string, TokenOverviewCurrentMetrics> = {}
	const indexes = buildTokenDirectoryIndexes(metadata)

	for (const token of tokens) {
		const geckoId = token.id.toLowerCase()
		const record = indexes.byGeckoId.get(geckoId)
		const protocolId = resolveProtocolId(geckoId, record, indexes)
		const protocolMetadata = protocolId ? metadata.protocolMetadata[protocolId] : undefined
		const emissionsProtocolSlug = resolveEmissionsProtocolSlug(record, protocolId, protocolMetadata, metadata)
		const adjustedSupply = emissionsProtocolSlug
			? (metadata.emissionsSupplyMetrics[emissionsProtocolSlug]?.supplyMetrics.adjustedSupply ?? null)
			: null

		currentMetricsById[geckoId] = {
			currentPrice: token.current_price ?? null,
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

export function buildTokenIndexById(tokens: Array<IResponseCGTokenRankingsDatasetItem>): Map<string, number> {
	const tokenIndexById = new Map<string, number>()
	let index = 0
	for (const token of tokens) {
		tokenIndexById.set(token.id.toLowerCase(), index)
		index++
	}
	return tokenIndexById
}
