import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
	fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartDataMock,
	fetchChainAssetsChartMock,
	resolveChainAssetIdMock,
	fetchStablecoinChartApiMock,
	fetchChainChartMock
} = vi.hoisted(() => ({
	fetchAdapterChainChartDataMock: vi.fn(),
	fetchAdapterProtocolChartDataMock: vi.fn(),
	fetchChainAssetsChartMock: vi.fn(),
	resolveChainAssetIdMock: vi.fn(),
	fetchStablecoinChartApiMock: vi.fn(),
	fetchChainChartMock: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainChartData: fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartData: fetchAdapterProtocolChartDataMock
}))

vi.mock('~/containers/BridgedTVL/api', () => ({
	fetchChainAssetsChart: fetchChainAssetsChartMock
}))

vi.mock('~/containers/BridgedTVL/chainAssetIds', () => ({
	resolveChainAssetId: resolveChainAssetIdMock
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinChartApi: fetchStablecoinChartApiMock
}))

vi.mock('~/containers/Chains/api', () => ({
	fetchChainChart: fetchChainChartMock
}))

import { fetchProChainChartData } from '../services/ChainCharts'

describe('fetchProChainChartData TVL', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('rejects a failed chain source instead of returning a cacheable empty chart', async () => {
		fetchChainChartMock.mockRejectedValue(new Error('chain TVL unavailable'))

		await expect(fetchProChainChartData('tvl', 'Ethereum')).rejects.toThrow('chain TVL unavailable')
	})
})

describe('fetchProChainChartData Bridged TVL', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		fetchAdapterProtocolChartDataMock.mockResolvedValue([])
		fetchChainAssetsChartMock.mockResolvedValue([{ timestamp: 1_700_000_000, data: { total: 42 } }])
		resolveChainAssetIdMock.mockResolvedValue('hyperliquid')
	})

	it('resolves saved chain names to the producer metadata ID', async () => {
		await expect(fetchProChainChartData('bridgedTvl', 'Hyperliquid L1')).resolves.toEqual([[1_700_000_000, 42]])

		expect(resolveChainAssetIdMock).toHaveBeenCalledWith('Hyperliquid L1')
		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('hyperliquid')
	})

	it('rejects when the chain assets fetch fails so callers do not cache a fake empty chart', async () => {
		fetchChainAssetsChartMock.mockRejectedValue(new Error('missing chart'))

		resolveChainAssetIdMock.mockResolvedValue('base')
		await expect(fetchProChainChartData('bridgedTvl', 'Base')).rejects.toThrow('missing chart')

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('base')
	})

	it('rejects when chain metadata resolution fails', async () => {
		resolveChainAssetIdMock.mockRejectedValue(new Error('metadata unavailable'))

		await expect(fetchProChainChartData('bridgedTvl', 'Base')).rejects.toThrow('metadata unavailable')
		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
	})

	it('returns an empty chart for empty chain inputs without fetching', async () => {
		await expect(fetchProChainChartData('bridgedTvl', '')).resolves.toEqual([])

		expect(resolveChainAssetIdMock).not.toHaveBeenCalled()
		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
	})

	it('uses an already-resolved producer ID without another metadata lookup', async () => {
		await expect(fetchProChainChartData('bridgedTvl', 'OP Mainnet', undefined, 'optimism')).resolves.toEqual([
			[1_700_000_000, 42]
		])

		expect(resolveChainAssetIdMock).not.toHaveBeenCalled()
		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('optimism')
	})

	it('does not fetch charts for chains without the metadata capability', async () => {
		resolveChainAssetIdMock.mockResolvedValue(null)

		await expect(fetchProChainChartData('bridgedTvl', 'Unknown')).resolves.toEqual([])

		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
	})
})

describe('fetchProChainChartData adapter metrics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchAdapterChainChartDataMock.mockResolvedValue([[1_700_000_000, 42]])
		fetchAdapterProtocolChartDataMock.mockResolvedValue([[1_700_000_000, 7]])
	})

	it('uses the focused chain adapter chart for options premium volume', async () => {
		await expect(fetchProChainChartData('optionsPremium', 'Ethereum')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'options',
			chain: 'Ethereum',
			dataType: 'dailyPremiumVolume'
		})
	})

	it('uses the focused chain adapter chart for options notional volume', async () => {
		await expect(fetchProChainChartData('optionsNotional', 'Ethereum')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'options',
			chain: 'Ethereum',
			dataType: 'dailyNotionalVolume'
		})
	})

	it('uses the focused chain adapter chart for open interest', async () => {
		await expect(fetchProChainChartData('openInterest', 'Hyperliquid L1')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'open-interest',
			chain: 'Hyperliquid L1',
			dataType: 'openInterestAtEnd'
		})
	})

	it('uses chain pseudo-protocol activity instead of retired userData endpoints', async () => {
		await expect(fetchProChainChartData('activeUsers', 'Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
		await expect(fetchProChainChartData('newUsers', 'Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
		await expect(fetchProChainChartData('txs', 'Ethereum')).resolves.toEqual([[1_700_000_000, 7]])

		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(1, {
			adapterType: 'active-users',
			protocol: 'Ethereum',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(2, {
			adapterType: 'new-users',
			protocol: 'Ethereum',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(3, {
			adapterType: 'active-users',
			protocol: 'Ethereum',
			dataType: 'dailyTransactionsCount'
		})
	})

	it('uses the chain aggregate endpoint for gas used in USD', async () => {
		await expect(fetchProChainChartData('gasUsed', 'Avalanche')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'active-users',
			chain: 'Avalanche',
			dataType: 'dailyGasUsedUsd'
		})
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
	})
})

describe('fetchProChainChartData stablecoins', () => {
	it('shares one raw chain response between concurrent supply and inflow charts', async () => {
		fetchStablecoinChartApiMock.mockResolvedValue({
			aggregated: [
				{ date: '1', totalCirculatingUSD: { peggedUSD: 10, peggedEUR: 5 } },
				{ date: '2', totalCirculatingUSD: { peggedUSD: 15, peggedEUR: 10 } }
			],
			breakdown: {
				double: [
					{ date: '1', totalCirculatingUSD: { peggedUSD: 2, peggedEUR: 1 } },
					{ date: '2', totalCirculatingUSD: { peggedUSD: 4, peggedEUR: 1 } }
				]
			},
			doublecountedIds: ['double']
		})

		await expect(
			Promise.all([
				fetchProChainChartData('stablecoins', 'Ethereum'),
				fetchProChainChartData('stablecoinInflows', 'Ethereum')
			])
		).resolves.toEqual([
			[
				[1, 12],
				[2, 20]
			],
			[[2, 8]]
		])

		expect(fetchStablecoinChartApiMock).toHaveBeenCalledTimes(1)
		expect(fetchStablecoinChartApiMock).toHaveBeenCalledWith('Ethereum')
	})
})
