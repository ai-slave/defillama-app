import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainChartLabels } from '../constants'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	useQuery: vi.fn(),
	lastResult: null as ReturnType<typeof import('../useFetchChainChartData').useFetchChainChartData> | null
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: mocks.useQuery
}))

vi.mock('~/containers/Bridges/queries.client', () => ({
	useGetBridgeChartDataByChain: () => ({ data: null, isLoading: false })
}))

vi.mock('~/containers/Stablecoins/queries.client', () => ({
	useGetStabelcoinsChartDataByChain: () => ({ data: null, isLoading: false })
}))

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson
}))

import { useFetchChainChartData } from '../useFetchChainChartData'

const feeRevenueChartRows: Array<{ label: ChainChartLabels; expectedUrl: string }> = [
	{
		label: 'Chain Fees',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=fees&protocol=Base'
	},
	{
		label: 'Chain Revenue',
		expectedUrl:
			'/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=fees&protocol=Base&dataType=dailyRevenue'
	},
	{
		label: 'App Fees',
		expectedUrl: '/api/public/chains/charts?kind=adapter-chain&adapterType=fees&chain=Base&dataType=dailyAppFees'
	},
	{
		label: 'App Revenue',
		expectedUrl: '/api/public/chains/charts?kind=adapter-chain&adapterType=fees&chain=Base&dataType=dailyAppRevenue'
	}
]

const activityChartRows: Array<{ label: ChainChartLabels; expectedUrl: string }> = [
	{
		label: 'Active Addresses',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=active-users&protocol=Base'
	},
	{
		label: 'New Addresses',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=new-users&protocol=Base'
	},
	{
		label: 'Transactions',
		expectedUrl:
			'/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=active-users&protocol=Base&dataType=dailyTransactionsCount'
	}
]

function Probe({ toggledCharts }: { toggledCharts: ChainChartLabels[] }) {
	mocks.lastResult = useFetchChainChartData({
		denomination: 'USD',
		selectedChain: 'Base',
		tvlChart: [],
		tvlChartSummary: {
			totalValueUSD: null,
			tvlPrevDay: null,
			valueChange24hUSD: null,
			change24h: null
		},
		extraTvlCharts: {},
		tvlSettings: {},
		toggledCharts,
		groupBy: 'daily'
	})

	return null
}

describe('ChainOverview chart metric semantics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchJson.mockResolvedValue([])
		mocks.useQuery.mockImplementation((options: { enabled?: boolean; queryFn: () => unknown }) => {
			if (options.enabled !== false) {
				options.queryFn()
			}
			return { data: null, isLoading: false }
		})
	})

	it.each(feeRevenueChartRows)('builds the current $label chart API URL', ({ label, expectedUrl }) => {
		renderToStaticMarkup(<Probe toggledCharts={[label]} />)

		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
		expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
	})

	it.each(activityChartRows)('builds the current $label chart API URL', ({ label, expectedUrl }) => {
		renderToStaticMarkup(<Probe toggledCharts={[label]} />)

		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
		expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
	})

	it('uses the chain fee series directly', () => {
		const timestamp = Date.UTC(2024, 0, 1) / 1e3
		mocks.useQuery.mockImplementation((options: { queryKey: unknown[] }) => {
			if (options.queryKey[1] === 'chain-fees') {
				return { data: [[timestamp, 100]], isLoading: false }
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe toggledCharts={['Chain Fees']} />)

		expect(mocks.lastResult?.finalCharts['Chain Fees']).toEqual([[timestamp * 1e3, 100]])
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})
})
