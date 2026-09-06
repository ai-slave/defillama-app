import { describe, expect, test } from 'vitest'
import {
	buildCompareChainAdapterQueryKey,
	buildCompareChainAdapterRequest,
	buildCompareChainOverviewQueryKey,
	getCompareChainFailedSources,
	hasPendingCompareChainSources,
	mergeCompareChainSources,
	getCompareChainAdapterMetrics
} from '../requestPlan'

describe('CompareChains request planning', () => {
	test('keeps the overview identity stable as selected metrics change', () => {
		expect(buildCompareChainOverviewQueryKey('Ethereum')).toEqual(['compare-chains', 'overview', 'Ethereum'])
		expect(buildCompareChainOverviewQueryKey('Ethereum')).toEqual(['compare-chains', 'overview', 'Ethereum'])
	})

	test('uses one canonical source identity for every selected metric', () => {
		expect(getCompareChainAdapterMetrics(['chainRevenueChart', 'tvlChart', 'dexVolumeChart'])).toEqual([
			'dexVolumeChart',
			'chainRevenueChart'
		])
		expect(buildCompareChainAdapterQueryKey('Arbitrum One', 'dexVolumeChart')).toEqual([
			'compare-chains',
			'adapter',
			'Arbitrum One',
			'dexVolumeChart'
		])
		expect(buildCompareChainAdapterQueryKey('Arbitrum One', 'chainRevenueChart')).toEqual([
			'compare-chains',
			'adapter',
			'Arbitrum One',
			'chainRevenueChart'
		])
	})

	test('maps each metric to its only compatible endpoint contract', () => {
		expect(buildCompareChainAdapterRequest('Arbitrum One', 'dexVolumeChart')).toEqual({
			metric: 'dexVolumeChart',
			endpoint: 'chain',
			params: { adapterType: 'dexs', chain: 'Arbitrum One' }
		})
		expect(buildCompareChainAdapterRequest('Arbitrum One', 'chainFeesChart')).toEqual({
			metric: 'chainFeesChart',
			endpoint: 'protocol',
			params: { adapterType: 'fees', protocol: 'Arbitrum One' }
		})
		expect(buildCompareChainAdapterRequest('Arbitrum One', 'chainRevenueChart')).toEqual({
			metric: 'chainRevenueChart',
			endpoint: 'protocol',
			params: { adapterType: 'fees', protocol: 'Arbitrum One', dataType: 'dailyRevenue' }
		})
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
		expect(
			getCompareChainFailedSources({
				chains: ['Ethereum'],
				adapterMetrics,
				overviewErrors: [null],
				metricErrors: [null, new Error('fees failed')],
				metricLabels: {
					dexVolumeChart: 'DEXs Volume',
					chainFeesChart: 'Chain Fees',
					chainRevenueChart: 'Chain Revenue'
				}
			})
		).toEqual(['Ethereum - Chain Fees'])
	})

	test('stays loading while any selected metric or fee detail source is pending', () => {
		const completedOverview = [{ isLoading: false }, { isLoading: false }]

		expect(hasPendingCompareChainSources(completedOverview, [{ isLoading: true }], [])).toBe(true)
		expect(hasPendingCompareChainSources(completedOverview, [{ isLoading: false }], [{ isLoading: true }])).toBe(true)
		expect(hasPendingCompareChainSources(completedOverview, [{ isLoading: false }], [{ isLoading: false }])).toBe(false)
	})
})
