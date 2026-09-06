import { NFT_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	RawCollectionDetail,
	RawCollectionStats,
	RawFloorHistoryEntry,
	RawNftCollection,
	RawNftMarketplaceStats,
	RawNftMarketplaceVolume,
	RawNftVolume,
	RawOrderbookEntry,
	RawParentCompany,
	RawRoyalty
} from './api.types'

const encodeSlug = (slug: string): string => encodeURIComponent(slug)

/**
 * Fetch all tracked NFT collections.
 */
export async function fetchNftCollections(): Promise<Array<RawNftCollection>> {
	return fetchJson<Array<RawNftCollection>>(`${NFT_SERVER_URL}/collections`, { timeout: 60_000 })
}

/**
 * Fetch aggregate NFT volume data.
 */
export async function fetchNftVolumes(): Promise<Array<RawNftVolume>> {
	return fetchJson<Array<RawNftVolume>>(`${NFT_SERVER_URL}/volume`, { timeout: 60_000 })
}

/**
 * Fetch metadata for a single NFT collection.
 */
export async function fetchNftCollection(slug: string): Promise<Array<RawCollectionDetail>> {
	return fetchJson<Array<RawCollectionDetail>>(`${NFT_SERVER_URL}/collection/${encodeSlug(slug)}`)
}

/**
 * Fetch sales history for a single NFT collection.
 */
export async function fetchNftCollectionSales(slug: string): Promise<Array<[number, number]>> {
	const data = await fetchJson<Array<[number, number]> | null>(
		`${NFT_SERVER_URL}/sales?collectionId=${encodeSlug(slug)}`
	)
	return data != null && Array.isArray(data) ? data.map((i) => [i[0] * 1000, i[1]] as [number, number]) : []
}

/**
 * Fetch current stats for a single NFT collection.
 */
export async function fetchNftCollectionStats(slug: string): Promise<Array<RawCollectionStats>> {
	return fetchJson<Array<RawCollectionStats>>(`${NFT_SERVER_URL}/stats/${encodeSlug(slug)}`)
}

/**
 * Fetch floor-price history for a single NFT collection.
 */
export async function fetchNftCollectionFloorHistory(slug: string): Promise<Array<RawFloorHistoryEntry>> {
	return fetchJson<Array<RawFloorHistoryEntry>>(`${NFT_SERVER_URL}/floorHistory/${encodeSlug(slug)}`)
}

/**
 * Fetch orderbook entries for a single NFT collection.
 */
export async function fetchNftCollectionOrderbook(slug: string): Promise<Array<RawOrderbookEntry>> {
	return fetchJson<Array<RawOrderbookEntry>>(`${NFT_SERVER_URL}/orderbook/${encodeSlug(slug)}`)
}

/**
 * Fetch aggregate stats for NFT marketplaces.
 */
export async function fetchNftMarketplaceStats(): Promise<Array<RawNftMarketplaceStats>> {
	return fetchJson<Array<RawNftMarketplaceStats>>(`${NFT_SERVER_URL}/exchangeStats`)
}

/**
 * Fetch trading volume data for NFT marketplaces.
 */
export async function fetchNftMarketplaceVolumes(): Promise<Array<RawNftMarketplaceVolume>> {
	return fetchJson<Array<RawNftMarketplaceVolume>>(`${NFT_SERVER_URL}/exchangeVolume`, { timeout: 60_000 })
}

/**
 * Fetch royalty rates across NFT collections.
 */
export async function fetchNftRoyalties(): Promise<Array<RawRoyalty>> {
	return fetchJson<Array<RawRoyalty>>(`${NFT_SERVER_URL}/royalties`)
}

/**
 * Fetch royalty history for a single NFT collection.
 */
export async function fetchNftRoyaltyHistory(slug: string): Promise<Array<[number, number]>> {
	return fetchJson<Array<[number, number]>>(`${NFT_SERVER_URL}/royaltyHistory/${encodeSlug(slug)}`)
}

/**
 * Fetch royalty details for a single NFT collection.
 */
export async function fetchNftRoyalty(slug: string): Promise<Array<RawRoyalty>> {
	return fetchJson<Array<RawRoyalty>>(`${NFT_SERVER_URL}/royalty/${encodeSlug(slug)}`)
}

/**
 * Fetch parent-company mappings for NFT projects.
 */
export async function fetchParentCompanies(): Promise<Array<RawParentCompany>> {
	return fetchJson<Array<RawParentCompany>>('https://api.llama.fi/_internal/nfts/parent-companies')
}
