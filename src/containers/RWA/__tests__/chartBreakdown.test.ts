import { describe, expect, test } from 'vitest'
import {
	getRwaChartViewOptions,
	getRwaFlowSplitBy,
	getRwaPerpsChartMetricQueryValue,
	getRwaPerpsChartPlan,
	getRwaPerpsChartSource,
	getRwaSpotChartSource,
	getRwaTreemapParentGrouping,
	parseRwaPerpsChartMetric,
	parseRwaPerpsChartView
} from '../chartBreakdown'
import { RWA_GROUP_BY_OPTIONS } from '../table/groupBy'

describe('getRwaSpotChartSource', () => {
	test('maps every Group by to a chart source', () => {
		expect(RWA_GROUP_BY_OPTIONS.map((groupBy) => [groupBy, getRwaSpotChartSource(groupBy)])).toEqual([
			['platform', { kind: 'assets', mode: 'platform' }],
			['chain', { kind: 'chains' }],
			['assetGroup', { kind: 'assets', mode: 'assetGroup' }],
			['category', { kind: 'assets', mode: 'category' }],
			['assetClass', { kind: 'assets', mode: 'assetName' }],
			['asset', { kind: 'assets', mode: 'assetName' }],
			['none', { kind: 'assets', mode: 'assetName' }]
		])
	})
})

describe('getRwaTreemapParentGrouping', () => {
	test('maps every Group by to a treemap parent grouping', () => {
		expect(RWA_GROUP_BY_OPTIONS.map(getRwaTreemapParentGrouping)).toEqual([
			'platform',
			'chain',
			'assetGroup',
			'category',
			'assetName',
			'assetName',
			'assetName'
		])
	})
})

describe('the perps chart plan', () => {
	test('folds the per-market history when a filter narrows the markets, or when an underlying page groups its markets', () => {
		const all = { kind: 'all' } as const
		const gold = { kind: 'baseAsset', slug: 'Gold' } as const
		expect(getRwaPerpsChartPlan({ scope: all, groupBy: 'platform', isFiltered: false })).toBe('split')
		expect(getRwaPerpsChartPlan({ scope: all, groupBy: 'asset', isFiltered: true })).toBe('fold')
		expect(getRwaPerpsChartPlan({ scope: gold, groupBy: 'platform', isFiltered: false })).toBe('fold')
		expect(getRwaPerpsChartPlan({ scope: gold, groupBy: 'none', isFiltered: false })).toBe('split')
	})
})

describe('getRwaChartViewOptions', () => {
	test('every tracked metric offers the pie, treemap and bar views; the flows offer only the time series', () => {
		for (const metric of ['activeMcap', 'onChainMcap', 'defiActiveTvl', 'openInterest', 'volume', 'markets'] as const) {
			expect(getRwaChartViewOptions(metric).map((option) => option.key)).toEqual(
				expect.arrayContaining(['timeSeries', 'pie', 'treemap', 'hbar'])
			)
		}
		expect(getRwaChartViewOptions('flows').map((option) => option.key)).toEqual(['timeSeries'])
		expect(getRwaChartViewOptions('flowVsPrice').map((option) => option.key)).toEqual(['timeSeries'])
	})
})

describe('parseRwaPerpsChartView', () => {
	test('reads a view the metric offers and falls back to the time series', () => {
		expect(parseRwaPerpsChartView('volume', 'pie')).toBe('pie')
		expect(parseRwaPerpsChartView('openInterest', 'bar')).toBe('hbar')
		expect(parseRwaPerpsChartView('markets', 'treemap')).toBe('treemap')
		expect(parseRwaPerpsChartView('openInterest', 'flows')).toBe('timeSeries')
		expect(parseRwaPerpsChartView('openInterest', undefined)).toBe('timeSeries')
	})
})

describe('getRwaPerpsChartSource', () => {
	test('maps the Perps view Group by to a split and None to the contracts', () => {
		expect(RWA_GROUP_BY_OPTIONS.map((groupBy) => [groupBy, getRwaPerpsChartSource(groupBy)])).toEqual([
			['platform', { kind: 'split', breakdown: 'venue' }],
			['chain', { kind: 'split', breakdown: 'venue' }],
			['assetGroup', { kind: 'split', breakdown: 'assetGroup' }],
			['category', { kind: 'split', breakdown: 'venue' }],
			['assetClass', { kind: 'split', breakdown: 'assetClass' }],
			['asset', { kind: 'split', breakdown: 'baseAsset' }],
			['none', { kind: 'contracts' }]
		])
	})
})

describe('perps chart metric', () => {
	test('defaults to open interest and omits it from the url', () => {
		expect(parseRwaPerpsChartMetric(undefined)).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('activeMcap')).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('volume')).toBe('volume')
		expect(parseRwaPerpsChartMetric('markets')).toBe('markets')
		expect(getRwaPerpsChartMetricQueryValue('openInterest')).toBeUndefined()
		expect(getRwaPerpsChartMetricQueryValue('volume')).toBe('volume')
		expect(getRwaPerpsChartMetricQueryValue('markets')).toBe('markets')
	})
})

describe('getRwaFlowSplitBy', () => {
	test('maps the four splits and reads the total for Asset Class, Asset and None', () => {
		expect(RWA_GROUP_BY_OPTIONS.map(getRwaFlowSplitBy)).toEqual([
			'platform',
			'chain',
			'assetGroup',
			'category',
			null,
			null,
			null
		])
	})
})
