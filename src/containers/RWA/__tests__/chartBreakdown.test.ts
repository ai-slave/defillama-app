import { describe, expect, test } from 'vitest'
import {
	getRwaChartViewOptions,
	getRwaFlowSplitBy,
	getRwaPerpsChartMetricOptions,
	getRwaPerpsChartMetricQueryValue,
	getRwaPerpsChartMetricSpec,
	getRwaPerpsChartPlan,
	getRwaPerpsChartSource,
	getRwaPerpsGroupLabels,
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
		expect(getRwaPerpsChartPlan({ scope: all, groupBy: 'platform', isFiltered: false })).toEqual({
			kind: 'split',
			groupBy: 'venue'
		})
		expect(getRwaPerpsChartPlan({ scope: all, groupBy: 'asset', isFiltered: true })).toEqual({
			kind: 'fold',
			groupBy: 'baseAsset'
		})
		expect(getRwaPerpsChartPlan({ scope: gold, groupBy: 'platform', isFiltered: false })).toEqual({
			kind: 'fold',
			groupBy: 'venue'
		})
		expect(getRwaPerpsChartPlan({ scope: gold, groupBy: 'none', isFiltered: false })).toEqual({
			kind: 'split',
			groupBy: null
		})
	})

	test('names the members as the perps table does: Venue, never Platform, and Market under None', () => {
		expect(getRwaPerpsGroupLabels('venue')).toEqual({ one: 'Venue', many: 'Venues' })
		expect(getRwaPerpsGroupLabels('assetClass')).toEqual({ one: 'Asset Class', many: 'Asset Classes' })
		expect(getRwaPerpsGroupLabels('baseAsset')).toEqual({ one: 'Asset', many: 'Assets' })
		expect(getRwaPerpsGroupLabels(null)).toEqual({ one: 'Market', many: 'Markets' })
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
	test('offers open interest, volume and markets, defaults to open interest and omits it from the url', () => {
		expect(getRwaPerpsChartMetricOptions().map((option) => option.label)).toEqual([
			'Open Interest',
			'Volume',
			'Markets'
		])
		expect(parseRwaPerpsChartMetric(undefined)).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('activeMcap')).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('volume')).toBe('volume')
		expect(parseRwaPerpsChartMetric('markets')).toBe('markets')
		expect(getRwaPerpsChartMetricQueryValue('openInterest')).toBeUndefined()
		expect(getRwaPerpsChartMetricQueryValue('volume')).toBe('volume')
		expect(getRwaPerpsChartMetricQueryValue('markets')).toBe('markets')
	})

	test('markets is a count: no dollar sign and a Total Markets line', () => {
		expect(getRwaPerpsChartMetricSpec('markets')).toEqual({
			valueSymbol: '',
			totalLabel: 'Total Markets'
		})
		expect(getRwaPerpsChartMetricSpec('openInterest')).toEqual({
			valueSymbol: '$',
			totalLabel: 'Total Open Interest'
		})
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
