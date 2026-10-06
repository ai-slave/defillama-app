import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import {
	fetchCompareChainAdapterMetric,
	getCompareChainAdapterMetrics,
	getCompareChainFailedSources,
	mergeCompareChainSources
} from '../requestPlan'

const fixtureFetch = installFixtureFetch()

describe('CompareChains request planning', () => {
	test('fetches each selected adapter metric from its own endpoint and never requests TVL there', async () => {
		const dexChart = [[1_700_000_000, 1]]
		const feesChart = [[1_700_000_000, 2]]
		const revenueChart = [[1_700_000_000, 3]]
		fixtureFetch.serve({
			[`${V2_SERVER_URL}/chart/dexs/chain/arbitrum-one`]: dexChart,
			[`${V2_SERVER_URL}/chart/fees/protocol/arbitrum-one`]: feesChart,
			[`${V2_SERVER_URL}/chart/fees/protocol/arbitrum-one?dataType=dailyRevenue`]: revenueChart
		})

		const metrics = getCompareChainAdapterMetrics(['chainRevenueChart', 'tvlChart', 'dexVolumeChart', 'chainFeesChart'])
		const data = await Promise.all(metrics.map((metric) => fetchCompareChainAdapterMetric('Arbitrum One', metric)))

		// Each metric's fixture differs and TVL has none, so the data proves which endpoint each metric used.
		expect(data).toEqual([dexChart, feesChart, revenueChart])
	})

	test('preserves overview data when one adapter source fails', () => {
		const overview = {
			chain: 'Ethereum',
			dexVolumeChart: null,
			chainFeesChart: null,
			chainRevenueChart: null
		}
		const adapterMetrics = getCompareChainAdapterMetrics(['tvlChart', 'dexVolumeChart', 'chainFeesChart'])

		expect(
			mergeCompareChainSources({
				overview,
				adapterMetrics,
				metricData: [[[1_700_000_000, 5]], undefined]
			})
		).toEqual({
			...overview,
			dexVolumeChart: [[1_700_000_000, 5]]
		})
		// Errors are flattened chain-major: [Ethereum dex, Ethereum fees, Solana dex, Solana fees].
		expect(
			getCompareChainFailedSources({
				chains: ['Ethereum', 'Solana'],
				adapterMetrics,
				overviewErrors: [null, null],
				metricErrors: [null, null, null, new Error('fees failed')],
				metricLabels: {
					dexVolumeChart: 'DEXs Volume',
					chainFeesChart: 'Chain Fees',
					chainRevenueChart: 'Chain Revenue'
				}
			})
		).toEqual(['Solana - Chain Fees'])
	})
})
