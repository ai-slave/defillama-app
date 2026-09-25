import { describe, expect, test } from 'vitest'
import { STABLECOINS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
const http = installFixtureFetch()

import {
	fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi,
	fetchStablecoinChainVolumeChartApi,
	fetchStablecoinPricesApi,
	fetchStablecoinTokenVolumeChartApi
} from '../api'
import type { RawStablecoinDetailResponse, RawStablecoinPricesResponse, RawStablecoinsListResponse } from '../api.types'

const chainMetadata = {
	'zksync-era': { id: 'era', name: 'ZKsync Era' }
}

describe('stablecoin volume API fetchers', () => {
	test('resolves chain display names to metadata ids for scoped volume routes', async () => {
		http.serve({ [`${STABLECOINS_SERVER_URL}/chart/volume/chain/era/token-breakdown`]: [[1, { USDT: 25 }]] })
		await expect(fetchStablecoinChainVolumeChartApi('zkSync Era', 'token', chainMetadata)).resolves.toEqual([
			[1, { USDT: 25 }]
		])
	})
	test('preserves token symbols for scoped token routes', async () => {
		http.serve({ [`${STABLECOINS_SERVER_URL}/chart/volume/token/USDT/chain-breakdown`]: [[1, { Ethereum: 15 }]] })
		await expect(fetchStablecoinTokenVolumeChartApi('USDT', 'chain')).resolves.toEqual([[1, { Ethereum: 15 }]])
	})
})

describe('stablecoin API normalization', () => {
	test('normalizes the producer peg-mechanism typo while preserving lifecycle metadata', async () => {
		const response = {
			peggedAssets: [
				{
					id: '388',
					name: 'Initia iUSD',
					symbol: 'IUSD',
					gecko_id: null,
					chains: [],
					pegType: 'peggedUSD',
					pegMechanism: 'crytpo-backed',
					deadFrom: '2024-01-31',
					price: null,
					circulating: {},
					circulatingPrevDay: {},
					circulatingPrevWeek: {},
					circulatingPrevMonth: {},
					chainCirculating: {}
				}
			],
			chains: []
		} satisfies RawStablecoinsListResponse
		http.serve({ [`${STABLECOINS_SERVER_URL}/stablecoins`]: response })

		await expect(fetchStablecoinAssetsApi()).resolves.toMatchObject({
			peggedAssets: [{ pegMechanism: 'crypto-backed', deadFrom: '2024-01-31' }]
		})
	})

	test('normalizes numeric price strings once while preserving explicit zero', async () => {
		const response = [
			{ date: 1, prices: { tether: '1.001', zero: '0', numeric: 2 } }
		] satisfies RawStablecoinPricesResponse
		http.serve({ [`${STABLECOINS_SERVER_URL}/stablecoinprices`]: response })

		await expect(fetchStablecoinPricesApi()).resolves.toEqual([
			{ date: 1, prices: { tether: 1.001, zero: 0, numeric: 2 } }
		])
	})

	test('normalizes detail metadata and preserves its historical balances', async () => {
		const tokens: RawStablecoinDetailResponse['tokens'] = [{ date: 1, circulating: { peggedUSD: 10 } }]
		const chainBalances: RawStablecoinDetailResponse['chainBalances'] = { Ethereum: { tokens } }
		const response = {
			id: '1',
			name: 'Test USD',
			address: null,
			symbol: 'TUSD',
			url: 'https://example.com',
			description: 'Test asset',
			mintRedeemDescription: 'Mint and redeem',
			onCoinGecko: 'true',
			gecko_id: 'test-usd',
			cmcId: 1,
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			auditLinks: 'https://example.com/audit',
			twitter: null,
			price: 1,
			tokens,
			chainBalances,
			currentChainBalances: {}
		} satisfies RawStablecoinDetailResponse
		http.serve({ [`${STABLECOINS_SERVER_URL}/stablecoin/1`]: response })

		const result = await fetchStablecoinAssetApi('1')

		expect(result).toMatchObject({
			onCoinGecko: true,
			auditLinks: ['https://example.com/audit'],
			priceSource: null,
			wiki: null,
			module: 'test-usd'
		})
		expect(result.tokens).toEqual(tokens)
		expect(result.chainBalances).toEqual(chainBalances)
	})
})
