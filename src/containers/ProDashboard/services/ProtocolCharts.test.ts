import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
	fetchAdapterProtocolChartData,
	fetchLiquidityTokensDataset,
	fetchProtocolTokenLiquidityChart,
	fetchProtocolTvlChart
} = vi.hoisted(() => ({
	fetchAdapterProtocolChartData: vi.fn(),
	fetchLiquidityTokensDataset: vi.fn(),
	fetchProtocolTokenLiquidityChart: vi.fn(),
	fetchProtocolTvlChart: vi.fn()
}))

vi.mock('~/api', () => ({ fetchLiquidityTokensDataset, fetchProtocolTokenLiquidityChart }))

vi.mock('~/containers/AdapterMetrics/api', () => ({ fetchAdapterProtocolChartData }))

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolTreasuryChart: vi.fn(),
	fetchProtocolTvlChart
}))

import ProtocolCharts from './ProtocolCharts'

describe('ProtocolCharts focused TVL sources', () => {
	beforeEach(() => {
		fetchProtocolTvlChart.mockReset()
		fetchAdapterProtocolChartData.mockReset()
		fetchLiquidityTokensDataset.mockReset()
		fetchProtocolTokenLiquidityChart.mockReset()
	})

	it('uses typed adapter contracts for protocol activity charts', async () => {
		fetchAdapterProtocolChartData.mockResolvedValue([[1_700_000_000, 10]])

		await expect(ProtocolCharts.activeUsers('compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(ProtocolCharts.newUsers('compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(ProtocolCharts.txs('compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(ProtocolCharts.gasUsed('compound-v2')).resolves.toEqual([[1_700_000_000, 10]])

		expect(fetchAdapterProtocolChartData).toHaveBeenNthCalledWith(1, {
			adapterType: 'active-users',
			protocol: 'compound-v2',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartData).toHaveBeenNthCalledWith(2, {
			adapterType: 'new-users',
			protocol: 'compound-v2',
			dataType: undefined
		})
		expect(fetchAdapterProtocolChartData).toHaveBeenNthCalledWith(3, {
			adapterType: 'active-users',
			protocol: 'compound-v2',
			dataType: 'dailyTransactionsCount'
		})
		expect(fetchAdapterProtocolChartData).toHaveBeenNthCalledWith(4, {
			adapterType: 'active-users',
			protocol: 'compound-v2',
			dataType: 'dailyGasUsed'
		})
	})

	it('fetches total TVL from V2 and preserves the Pro seconds contract', async () => {
		fetchProtocolTvlChart.mockResolvedValue([
			[1_000, 10],
			[2_000, 20]
		])

		await expect(ProtocolCharts.tvl('aave')).resolves.toEqual([
			[1, 10],
			[2, 20]
		])
		expect(fetchProtocolTvlChart).toHaveBeenCalledWith({ protocol: 'aave' })
	})

	it('requests the focused borrowed value series instead of reconstructing V1 chain TVLs', async () => {
		fetchProtocolTvlChart.mockResolvedValue([[3_000, 30]])

		await expect(ProtocolCharts.borrowed('aave')).resolves.toEqual([[3, 30]])
		expect(fetchProtocolTvlChart).toHaveBeenCalledWith({ protocol: 'aave', key: 'borrowed' })
	})

	it('returns no points when the focused endpoint has no series', async () => {
		fetchProtocolTvlChart.mockResolvedValue(null)

		await expect(ProtocolCharts.tvl('missing')).resolves.toEqual([])
	})

	it('resolves liquidity from the lite-catalog symbol without fetching full protocol data', async () => {
		fetchLiquidityTokensDataset.mockResolvedValue([{ id: '6621', symbol: 'AAVE' }])
		fetchProtocolTokenLiquidityChart.mockResolvedValue([
			['1', 10],
			['2', 20]
		])

		await expect(ProtocolCharts.liquidity('aave-v3', 'AAVE')).resolves.toEqual([
			[1, 10],
			[2, 20]
		])
		expect(fetchProtocolTokenLiquidityChart).toHaveBeenCalledWith('6621')
	})
})
