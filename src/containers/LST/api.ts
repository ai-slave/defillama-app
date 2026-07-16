import { fetchCoinPrices } from '~/api/pricing'
import { YIELDS_SERVER_URL } from '~/constants'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { fetchJson } from '~/utils/async'
import type { ILsdRateApiItem, IYieldPoolApiItem } from './api.types'

/**
 * Fetch yield pools available to the LST dashboard.
 */
export async function fetchYieldPools(snapshot: YieldsSnapshot): Promise<{ data: IYieldPoolApiItem[] }> {
	const { getEntityEarn } = await import('~/containers/Yields/data/enrich.server')
	const rows = await getEntityEarn(snapshot)
	return {
		data: rows
			.slice()
			.sort((left, right) => {
				if (left.tvl_usd == null) return right.tvl_usd == null ? 0 : 1
				if (right.tvl_usd == null) return -1
				return right.tvl_usd - left.tvl_usd
			})
			.map((pool) => ({
				project: pool.protocolSlug ?? pool.protocol,
				chain: pool.chain,
				symbol: pool.display.label ?? '',
				apy: pool.apy.current.total
			}))
	}
}

/** Fetch the legacy LST peg, symbol, and fee metadata. */
export async function fetchLsdRates(): Promise<ILsdRateApiItem[]> {
	return fetchJson<ILsdRateApiItem[]>(`${YIELDS_SERVER_URL}/lsdRates`)
}

/**
 * Fetch the current ETH price in USD.
 */
export async function fetchEthPrice(): Promise<number | null> {
	return fetchCoinPrices(['ethereum:0x0000000000000000000000000000000000000000'])
		.then((data) => data['ethereum:0x0000000000000000000000000000000000000000']?.price ?? null)
		.catch(() => null)
}
