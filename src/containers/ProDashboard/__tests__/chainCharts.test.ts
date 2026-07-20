import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
	fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartDataMock,
	fetchChainAssetsChartMock,
	fetchStablecoinChartApiMock
} = vi.hoisted(() => ({
	fetchAdapterChainChartDataMock: vi.fn(),
	fetchAdapterProtocolChartDataMock: vi.fn(),
	fetchChainAssetsChartMock: vi.fn(),
	fetchStablecoinChartApiMock: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainChartData: fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartData: fetchAdapterProtocolChartDataMock
}))

vi.mock('~/containers/BridgedTVL/api', () => ({
	fetchChainAssetsChart: fetchChainAssetsChartMock
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinChartApi: fetchStablecoinChartApiMock
}))

import ChainCharts from '../services/ChainCharts'

describe('ChainCharts Bridged TVL', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		fetchAdapterProtocolChartDataMock.mockResolvedValue([])
		fetchChainAssetsChartMock.mockResolvedValue([{ timestamp: 1_700_000_000, data: { total: '42' } }])
	})

	it('queries chain asset charts with slugged display names', async () => {
		await expect(ChainCharts.bridgedTvl('Hyperliquid L1')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('hyperliquid-l1')
	})

	it('dedupes equivalent chain asset slugs before fetching', async () => {
		await expect(ChainCharts.bridgedTvl('hyperliquid-l1')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('hyperliquid-l1')
	})

	it('fetches once per unique slug when an alias maps to a distinct display name', async () => {
		fetchChainAssetsChartMock.mockImplementation(async (chainSlug: string) => {
			if (chainSlug === 'hyperliquid') return [{ timestamp: 1_700_000_000, data: { total: '10' } }]
			if (chainSlug === 'hyperliquid-l1') return [{ timestamp: 1_700_086_400, data: { total: '20' } }]
			return []
		})

		await expect(ChainCharts.bridgedTvl('Hyperliquid')).resolves.toEqual([
			[1_700_000_000, 10],
			[1_700_086_400, 20]
		])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(2)
		expect(fetchChainAssetsChartMock).toHaveBeenNthCalledWith(1, 'hyperliquid')
		expect(fetchChainAssetsChartMock).toHaveBeenNthCalledWith(2, 'hyperliquid-l1')
	})

	it('returns an empty chart when the chain assets fetch fails', async () => {
		fetchChainAssetsChartMock.mockRejectedValue(new Error('missing chart'))

		await expect(ChainCharts.bridgedTvl('Base')).resolves.toEqual([])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('base')
	})

	it('ignores failed alias fetches and keeps successful chain asset responses', async () => {
		fetchChainAssetsChartMock.mockImplementation(async (chainSlug: string) => {
			if (chainSlug === 'hyperliquid') throw new Error('missing alias chart')
			return [{ timestamp: 1_700_086_400, data: { total: '20' } }]
		})

		await expect(ChainCharts.bridgedTvl('Hyperliquid')).resolves.toEqual([[1_700_086_400, 20]])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(2)
		expect(fetchChainAssetsChartMock).toHaveBeenNthCalledWith(1, 'hyperliquid')
		expect(fetchChainAssetsChartMock).toHaveBeenNthCalledWith(2, 'hyperliquid-l1')
	})

	it('returns an empty chart for empty chain inputs without fetching', async () => {
		await expect(ChainCharts.bridgedTvl('')).resolves.toEqual([])
		await expect(ChainCharts.bridgedTvl(null as unknown as string)).resolves.toEqual([])

		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
	})

	it('slugifies unknown chain names before fetching', async () => {
		await expect(ChainCharts.bridgedTvl('Unknown Chain')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchChainAssetsChartMock).toHaveBeenCalledTimes(1)
		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('unknown-chain')
	})
})

describe('ChainCharts adapter metrics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchAdapterChainChartDataMock.mockResolvedValue([[1_700_000_000, 42]])
		fetchAdapterProtocolChartDataMock.mockResolvedValue([[1_700_000_000, 7]])
	})

	it('uses the focused chain adapter chart for options premium volume', async () => {
		await expect(ChainCharts.options('Ethereum')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'options',
			chain: 'Ethereum',
			dataType: 'dailyPremiumVolume'
		})
	})

	it('uses the focused chain adapter chart for options notional volume', async () => {
		await expect(ChainCharts.getData('optionsNotional', 'Ethereum')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'options',
			chain: 'Ethereum',
			dataType: 'dailyNotionalVolume'
		})
	})

	it('uses chain pseudo-protocol activity instead of retired userData endpoints', async () => {
		await expect(ChainCharts.users('Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
		await expect(ChainCharts.activeUsers('Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
		await expect(ChainCharts.newUsers('Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
		await expect(ChainCharts.txs('Ethereum')).resolves.toEqual([[1_700_000_000, 7]])

		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(1, {
			adapterType: 'active-users',
			protocol: 'Ethereum',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(2, {
			adapterType: 'active-users',
			protocol: 'Ethereum',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(3, {
			adapterType: 'new-users',
			protocol: 'Ethereum',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenNthCalledWith(4, {
			adapterType: 'active-users',
			protocol: 'Ethereum',
			dataType: 'dailyTransactionsCount'
		})
	})

	it('uses the chain aggregate endpoint for gas used', async () => {
		await expect(ChainCharts.gasUsed('Avalanche')).resolves.toEqual([[1_700_000_000, 42]])

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({
			adapterType: 'active-users',
			chain: 'Avalanche',
			dataType: 'dailyGasUsed'
		})
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
	})
})

describe('ChainCharts stablecoins', () => {
	it('shares one raw chain response between concurrent supply and inflow charts', async () => {
		fetchStablecoinChartApiMock.mockResolvedValue({
			aggregated: [
				{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } },
				{ date: '2', totalCirculatingUSD: { peggedUSD: 15 } }
			]
		})

		await expect(
			Promise.all([
				ChainCharts.getData('stablecoins', 'Ethereum'),
				ChainCharts.getData('stablecoinInflows', 'Ethereum')
			])
		).resolves.toEqual([
			[
				[1, 10],
				[2, 15]
			],
			[[2, 5]]
		])

		expect(fetchStablecoinChartApiMock).toHaveBeenCalledTimes(1)
		expect(fetchStablecoinChartApiMock).toHaveBeenCalledWith('Ethereum')
	})
})
