import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAdapterProtocolChartData, fetchProtocolTvlChart } = vi.hoisted(() => ({
	fetchAdapterProtocolChartData: vi.fn(),
	fetchProtocolTvlChart: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({ fetchAdapterProtocolChartData }))

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolTreasuryChart: vi.fn(),
	fetchProtocolTvlChart
}))

import { fetchProProtocolChartData } from './ProtocolCharts'

describe('fetchProProtocolChartData focused TVL sources', () => {
	beforeEach(() => {
		fetchProtocolTvlChart.mockReset()
		fetchAdapterProtocolChartData.mockReset()
	})

	it('uses typed adapter contracts for protocol activity charts', async () => {
		fetchAdapterProtocolChartData.mockResolvedValue([[1_700_000_000, 10]])

		await expect(fetchProProtocolChartData('activeUsers', 'compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(fetchProProtocolChartData('newUsers', 'compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(fetchProProtocolChartData('txs', 'compound-v2')).resolves.toEqual([[1_700_000_000, 10]])
		await expect(fetchProProtocolChartData('gasUsed', 'compound-v2')).resolves.toEqual([[1_700_000_000, 10]])

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
			dataType: 'dailyGasUsedUsd'
		})
	})

	it('fetches total TVL from V2 and preserves the Pro seconds contract', async () => {
		fetchProtocolTvlChart.mockResolvedValue([
			[1_000, 10],
			[2_000, 20]
		])

		await expect(fetchProProtocolChartData('tvl', 'aave')).resolves.toEqual([
			[1, 10],
			[2, 20]
		])
		expect(fetchProtocolTvlChart).toHaveBeenCalledWith({ protocol: 'aave' })
	})

	it('requests the focused borrowed value series instead of reconstructing V1 chain TVLs', async () => {
		fetchProtocolTvlChart.mockResolvedValue([[3_000, 30]])

		await expect(fetchProProtocolChartData('borrowed', 'aave')).resolves.toEqual([[3, 30]])
		expect(fetchProtocolTvlChart).toHaveBeenCalledWith({ protocol: 'aave', key: 'borrowed' })
	})

	it('returns no points when the focused endpoint has no series', async () => {
		fetchProtocolTvlChart.mockResolvedValue(null)

		await expect(fetchProProtocolChartData('tvl', 'missing')).resolves.toEqual([])
	})
})
