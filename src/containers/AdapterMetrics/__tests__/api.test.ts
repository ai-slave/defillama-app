import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchJsonMock, fetchCoinGeckoExchangesMock, fetchCoinGeckoSimplePriceMock } = vi.hoisted(() => ({
	fetchJsonMock: vi.fn(),
	fetchCoinGeckoExchangesMock: vi.fn(),
	fetchCoinGeckoSimplePriceMock: vi.fn()
}))

vi.mock('~/utils/async', () => ({
	fetchJson: fetchJsonMock
}))
vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoExchanges: fetchCoinGeckoExchangesMock,
	fetchCoinGeckoSimplePrice: fetchCoinGeckoSimplePriceMock
}))

import {
	fetchAdapterChainChartData,
	fetchAdapterChainMetrics,
	fetchAdapterChainProtocolTotals,
	fetchAdapterMetrics,
	fetchCexVolume
} from '../api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

describe('dimension adapter api telemetry', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
		fetchCoinGeckoExchangesMock.mockReset()
		fetchCoinGeckoSimplePriceMock.mockReset()
	})

	it('adds dimension context to chain metric fetch telemetry', async () => {
		fetchJsonMock.mockResolvedValue({ protocols: [], allChains: [] })

		await fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.DEXS,
			chain: 'Litecoin',
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			category: 'Dexes'
		})

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('/metrics/dexs/category/dexes/chain/litecoin'), {
			timeout: 30_000,
			telemetry: {
				attributes: {
					adapter_type: 'dexs',
					category: 'Dexes',
					chain: 'Litecoin',
					data_type: 'dailyVolume'
				}
			}
		})
	})

	it('omits absent optional request and telemetry attributes', async () => {
		fetchJsonMock.mockResolvedValue({ protocols: [], allChains: [] })

		await fetchAdapterChainMetrics({ adapterType: ADAPTER_TYPES.DEXS, chain: 'All' })

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.not.stringContaining('dataType='), {
			timeout: 30_000,
			telemetry: {
				attributes: {
					adapter_type: 'dexs',
					chain: 'All'
				}
			}
		})
	})

	it('fetches aggregate liquidations metrics by data type', async () => {
		fetchJsonMock.mockResolvedValue({ protocols: [], allChains: [] })

		await fetchAdapterMetrics({
			adapterType: ADAPTER_TYPES.LIQUIDATIONS,
			dataType: ADAPTER_DATA_TYPES.DAILY_COLLATERAL_LIQUIDATED
		})

		expect(fetchJsonMock).toHaveBeenCalledWith(
			expect.stringContaining('/metrics/liquidations?dataType=dailyCollateralLiquidated'),
			{
				timeout: 30_000,
				telemetry: {
					attributes: {
						adapter_type: 'liquidations',
						data_type: 'dailyCollateralLiquidated'
					}
				}
			}
		)
	})

	it('returns only the protocol totals needed by chain tables', async () => {
		fetchJsonMock.mockResolvedValue({
			allChains: ['Ethereum'],
			protocols: [
				{
					defillamaId: 'chain#ethereum',
					displayName: 'Ethereum',
					total24h: 1,
					total7d: 7,
					total30d: 30,
					methodology: { Fees: 'unused in this read model' }
				}
			]
		})

		await expect(fetchAdapterChainProtocolTotals({ adapterType: ADAPTER_TYPES.FEES, chain: 'All' })).resolves.toEqual({
			protocols: [
				{
					defillamaId: 'chain#ethereum',
					displayName: 'Ethereum',
					total24h: 1,
					total7d: 7,
					total30d: 30
				}
			]
		})
	})

	it('adds dimension context to chain chart fetch telemetry', async () => {
		fetchJsonMock.mockResolvedValue([])

		await fetchAdapterChainChartData({
			adapterType: ADAPTER_TYPES.PERPS,
			chain: 'XDC',
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
		})

		expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('/chart/derivatives/chain/xdc'), {
			timeout: 30_000,
			telemetry: {
				attributes: {
					adapter_type: 'derivatives',
					chain: 'XDC',
					data_type: 'dailyVolume'
				}
			}
		})
	})
})

describe('fetchCexVolume', () => {
	it('retains an explicit zero volume from a valid exchange', async () => {
		fetchCoinGeckoExchangesMock.mockResolvedValue([{ trust_score: 9, trade_volume_24h_btc: 0 }])
		fetchCoinGeckoSimplePriceMock.mockResolvedValue({ bitcoin: { usd: 50_000 } })

		await expect(fetchCexVolume()).resolves.toBe(0)
	})

	it('returns null when every exchange volume is absent', async () => {
		fetchCoinGeckoExchangesMock.mockResolvedValue([{ trust_score: 9 }])
		fetchCoinGeckoSimplePriceMock.mockResolvedValue({ bitcoin: { usd: 50_000 } })

		await expect(fetchCexVolume()).resolves.toBeNull()
	})
})
