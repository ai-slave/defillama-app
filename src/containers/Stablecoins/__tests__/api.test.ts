import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))

import {
	fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi,
	fetchStablecoinChainVolumeChartApi,
	fetchStablecoinPricesApi,
	fetchStablecoinTokenVolumeChartApi,
	fetchStablecoinVolumeChartApi
} from '../api'
import type { RawStablecoinDetailResponse, RawStablecoinPricesResponse, RawStablecoinsListResponse } from '../api.types'

const chainMetadata = {
	'zksync-era': { id: 'era', name: 'ZKsync Era' }
}

beforeEach(() => {
	vi.clearAllMocks()
	fetchJsonMock.mockResolvedValue([])
})

describe('stablecoin volume API fetchers', () => {
	it('resolves chain display names to metadata ids for scoped volume routes', async () => {
		await fetchStablecoinChainVolumeChartApi('zkSync Era', 'token', chainMetadata)

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('/chart/volume/chain/era/token-breakdown'))
	})

	it('uses global volume routes', async () => {
		await fetchStablecoinVolumeChartApi('currency')

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('/chart/volume/currency-breakdown'))
	})

	it('preserves token symbols for scoped token routes', async () => {
		await fetchStablecoinTokenVolumeChartApi('USDT', 'chain')

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('/chart/volume/token/USDT/chain-breakdown'))
	})
})

describe('stablecoin API normalization', () => {
	it('normalizes the producer peg-mechanism typo while preserving lifecycle metadata', async () => {
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
		fetchJsonMock.mockResolvedValue(response)

		await expect(fetchStablecoinAssetsApi()).resolves.toMatchObject({
			peggedAssets: [{ pegMechanism: 'crypto-backed', deadFrom: '2024-01-31' }]
		})
	})

	it('normalizes numeric price strings once while preserving explicit zero', async () => {
		const response = [
			{ date: 1, prices: { tether: '1.001', zero: '0', numeric: 2 } }
		] satisfies RawStablecoinPricesResponse
		fetchJsonMock.mockResolvedValue(response)

		await expect(fetchStablecoinPricesApi()).resolves.toEqual([
			{ date: 1, prices: { tether: 1.001, zero: 0, numeric: 2 } }
		])
	})

	it('normalizes detail metadata without copying its historical arrays', async () => {
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
		fetchJsonMock.mockResolvedValue(response)

		const result = await fetchStablecoinAssetApi('1')

		expect(result).toMatchObject({
			onCoinGecko: true,
			auditLinks: ['https://example.com/audit'],
			priceSource: null,
			wiki: null,
			module: 'test-usd'
		})
		expect(result.tokens).toBe(tokens)
		expect(result.chainBalances).toBe(chainBalances)
	})
})
