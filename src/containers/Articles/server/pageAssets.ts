import { matchSorter } from 'match-sorter'
import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { geckoTokenIconUrl } from '~/utils/icons'
import metadataCache from '~/utils/metadata'
import type { PageAssetMarket, PageAssetSearchHit } from '../pageAssetMarket'

const TTL_MS = 5 * 60 * 1000

type Cache<T> = { value: T | null; expires: number; inflight: Promise<T> | null }

function makeCache<T>(loader: () => Promise<T>) {
	const cache: Cache<T> = { value: null, expires: 0, inflight: null }
	return async (): Promise<T> => {
		const now = Date.now()
		if (cache.value && cache.expires > now) return cache.value
		if (cache.inflight) return cache.inflight
		cache.inflight = loader()
			.then((v) => {
				cache.value = v
				cache.expires = now + TTL_MS
				cache.inflight = null
				return v
			})
			.catch((error) => {
				cache.inflight = null
				throw error
			})
		return cache.inflight
	}
}

const getTokenList = makeCache(() => fetchCoinGeckoTokensListFromDataset())

const getGeckoRouteMap = makeCache(() => {
	const map = new Map<string, string>()
	const directory = metadataCache.tokenDirectory ?? {}
	for (const key in directory) {
		const record = directory[key]
		const tokenNk = record?.token_nk?.toLowerCase()
		const route = record?.route
		if (!tokenNk || !route || !tokenNk.startsWith('coingecko:')) continue
		const geckoId = tokenNk.slice('coingecko:'.length)
		if (geckoId && !map.has(geckoId)) map.set(geckoId, route)
	}
	return Promise.resolve(map)
})

function toMarket(row: IResponseCGTokenRankingsDatasetItem, route: string | null): PageAssetMarket {
	return {
		geckoId: row.id,
		symbol: (row.symbol ?? '').toUpperCase(),
		name: row.name,
		image: geckoTokenIconUrl(row.id),
		price: typeof row.current_price === 'number' ? row.current_price : null,
		change24h: typeof row.price_change_percentage_24h === 'number' ? row.price_change_percentage_24h : null,
		route
	}
}

export async function lookupPageAssets(ids: Array<string>): Promise<Array<PageAssetMarket>> {
	const wanted = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
	if (wanted.length === 0) return []
	const [list, routeMap] = await Promise.all([getTokenList(), getGeckoRouteMap()])
	const byId = new Map<string, IResponseCGTokenRankingsDatasetItem>()
	for (const row of list) {
		if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
	}
	return wanted.map((id) => {
		const route = routeMap.get(id.toLowerCase()) ?? null
		const row = byId.get(id)
		return row
			? toMarket(row, route)
			: { geckoId: id, symbol: '', name: '', image: null, price: null, change24h: null, route }
	})
}

export async function searchPageAssets(query: string, limit = 25): Promise<Array<PageAssetSearchHit>> {
	const q = query.trim()
	if (!q) return []
	const list = await getTokenList()
	return matchSorter(list, q, {
		keys: ['symbol', 'name', 'id'],
		threshold: matchSorter.rankings.CONTAINS
	})
		.slice(0, limit)
		.map((row) => ({
			geckoId: row.id,
			symbol: (row.symbol ?? '').toUpperCase(),
			name: row.name,
			image: geckoTokenIconUrl(row.id)
		}))
}
