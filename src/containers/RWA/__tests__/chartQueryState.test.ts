import { describe, expect, test } from 'vitest'
import { getRwaOverviewChartMetricOptions, resolveRwaChartQueryState } from '../chartQueryState'

const availability = { hasActiveMcapData: true }
const assetsView = { isPerpsView: false, isPlatformMode: false, groupBy: 'chain', availability } as const
const perpsView = { isPerpsView: true, isPlatformMode: false, groupBy: 'platform', availability } as const

const selection = (query: Record<string, string>, options: Parameters<typeof resolveRwaChartQueryState>[1]) => {
	const { selectedChartMetric, chartView } = resolveRwaChartQueryState(query, options)
	return { selectedChartMetric, chartView }
}

describe('resolveRwaChartQueryState', () => {
	test('reads the asset metric or the flows from chartType on the Assets view', () => {
		expect(selection({}, assetsView)).toEqual({ selectedChartMetric: 'activeMcap', chartView: 'timeSeries' })
		expect(selection({ chartType: 'flows' }, assetsView).selectedChartMetric).toBe('flows')
	})

	test('reads open interest or volume on the Perps view and never the flows', () => {
		expect(selection({}, perpsView).selectedChartMetric).toBe('openInterest')
		expect(selection({ chartType: 'volume' }, perpsView).selectedChartMetric).toBe('volume')
		expect(selection({ chartType: 'flows' }, perpsView).selectedChartMetric).toBe('openInterest')
		expect(resolveRwaChartQueryState({ chartType: 'flows' }, perpsView).flowQueryState.view).toBe(null)
		expect(resolveRwaChartQueryState({ chartType: 'flows' }, assetsView).flowQueryState.view).toBe('netFlows')
	})

	test('falls back to the time series when the metric has no such view', () => {
		expect(selection({ chartView: 'share' }, perpsView).chartView).toBe('share')
		expect(selection({ chartView: 'pie' }, perpsView).chartView).toBe('timeSeries')
		expect(selection({ chartType: 'volume', chartView: 'share' }, perpsView).chartView).toBe('timeSeries')
		expect(selection({ chartView: 'treemap' }, assetsView).chartView).toBe('treemap')
	})
})

describe('getRwaOverviewChartMetricOptions', () => {
	const labels = (options: Parameters<typeof getRwaOverviewChartMetricOptions>[0]) =>
		getRwaOverviewChartMetricOptions(options).map((option) => option.label)

	test('offers the tracked asset metrics and net flows, plus flow vs price on platform pages', () => {
		expect(labels({ isPerpsView: false, isPlatformMode: false, availability })).toEqual([
			'Active AUM',
			'Onchain AUM',
			'DeFi Active TVL',
			'Net Flows'
		])
		expect(labels({ isPerpsView: false, isPlatformMode: true, availability }).at(-1)).toBe('Flow vs price')
	})

	test('offers open interest and volume in the Perps view', () => {
		expect(
			getRwaOverviewChartMetricOptions({ isPerpsView: true, isPlatformMode: false, availability }).map(
				(option) => option.key
			)
		).toEqual(['openInterest', 'volume'])
	})
})
