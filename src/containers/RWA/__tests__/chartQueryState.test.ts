import { describe, expect, test } from 'vitest'
import { getRwaOverviewChartMetricOptions, resolveRwaChartQueryState } from '../chartQueryState'
import { getChartMetricQueryValue } from '../chartState'

const availability = { hasActiveMcapData: true }
const assetsView = {
	isPlatformMode: false,
	groupBy: 'chain',
	availability
} as const

const selection = (query: Record<string, string>, options: Parameters<typeof resolveRwaChartQueryState>[1]) => {
	const { selectedChartMetric, chartView } = resolveRwaChartQueryState(query, options)
	return { selectedChartMetric, chartView }
}

describe('resolveRwaChartQueryState', () => {
	test('reads the asset metric or the flows from chartType', () => {
		expect(selection({}, assetsView)).toEqual({
			selectedChartMetric: 'activeMcap',
			chartView: 'timeSeries'
		})
		expect(selection({ chartType: 'flows' }, assetsView).selectedChartMetric).toBe('flows')
		expect(resolveRwaChartQueryState({ chartType: 'flows' }, assetsView).flowQueryState.view).toBe('netFlows')
	})

	test('draws the Total line of the picked asset metric', () => {
		expect(resolveRwaChartQueryState({}, assetsView).chartTotalLabel).toBe('Total Active AUM')
		expect(
			resolveRwaChartQueryState({ chartType: getChartMetricQueryValue('onChainMcap', availability) ?? '' }, assetsView)
				.chartTotalLabel
		).toBe('Total Onchain AUM')
	})

	test('falls back to the time series when the metric has no such view', () => {
		expect(selection({ chartType: 'flows', chartView: 'pie' }, assetsView).chartView).toBe('timeSeries')
		expect(selection({ chartView: 'treemap' }, assetsView).chartView).toBe('treemap')
		expect(selection({ chartView: 'share' }, assetsView).chartView).toBe('share')
	})
})

describe('getRwaOverviewChartMetricOptions', () => {
	const labels = (options: Parameters<typeof getRwaOverviewChartMetricOptions>[0]) =>
		getRwaOverviewChartMetricOptions(options).map((option) => option.label)

	test('offers the tracked asset metrics and net flows, plus flow vs price on platform pages', () => {
		expect(labels({ isPlatformMode: false, availability })).toEqual([
			'Active AUM',
			'Onchain AUM',
			'DeFi Active TVL',
			'Net Flows'
		])
		expect(labels({ isPlatformMode: true, availability }).at(-1)).toBe('Flow vs price')
	})
})
