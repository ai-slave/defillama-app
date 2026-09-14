import { describe, expect, test } from 'vitest'
import {
	getRwaChartFilterNote,
	getRwaChartGroupLabel,
	getRwaChartViewOptions,
	getRwaFlowSplitBy,
	getRwaPerpsChartMetricOptions,
	getRwaPerpsChartMetricQueryValue,
	getRwaPerpsChartSource,
	getRwaSpotChartSource,
	getRwaTreemapParentGrouping,
	parseRwaPerpsChartMetric,
	RWA_CHART_FILTER_NOTE
} from '../chartBreakdown'
import { RWA_GROUP_BY_OPTIONS } from '../table/groupBy'

describe('getRwaSpotChartSource', () => {
	test('maps every Group by to a chart source', () => {
		expect(RWA_GROUP_BY_OPTIONS.map((groupBy) => [groupBy, getRwaSpotChartSource(groupBy)])).toEqual([
			['platform', { kind: 'assets', mode: 'platform' }],
			['chain', { kind: 'chains' }],
			['assetGroup', { kind: 'assets', mode: 'assetGroup' }],
			['category', { kind: 'assets', mode: 'category' }],
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
			'assetName'
		])
	})
})

describe('getRwaChartGroupLabel', () => {
	test('names the axis the way the table does, with None reading as the asset', () => {
		expect(RWA_GROUP_BY_OPTIONS.map(getRwaChartGroupLabel)).toEqual([
			'Platform',
			'Chain',
			'Asset Group',
			'Category',
			'Asset',
			'Asset'
		])
	})
})

describe('getRwaChartFilterNote', () => {
	test('notes a server split under attribute filters and nothing else', () => {
		expect(getRwaChartFilterNote('split', true)).toBe(RWA_CHART_FILTER_NOTE)
		expect(getRwaChartFilterNote('split', false)).toBeNull()
		expect(getRwaChartFilterNote('fold', true)).toBeNull()
		expect(getRwaChartFilterNote('fold', false)).toBeNull()
	})
})

describe('getRwaChartViewOptions', () => {
	test('offers the five views for a spot metric', () => {
		expect(getRwaChartViewOptions('activeMcap').map((option) => option.key)).toEqual([
			'timeSeries',
			'share',
			'pie',
			'treemap',
			'hbar'
		])
		expect(getRwaChartViewOptions('onChainMcap').map((option) => option.key)).toEqual(
			getRwaChartViewOptions('defiActiveTvl').map((option) => option.key)
		)
	})

	test('hides Share for flows and volume', () => {
		expect(getRwaChartViewOptions('flows').map((option) => option.key)).toEqual(['timeSeries'])
		expect(getRwaChartViewOptions('flowVsPrice').map((option) => option.key)).toEqual(['timeSeries'])
		expect(getRwaChartViewOptions('volume').map((option) => option.key)).toEqual(['timeSeries'])
	})

	test('offers the time series and Share for open interest', () => {
		expect(getRwaChartViewOptions('openInterest').map((option) => option.key)).toEqual(['timeSeries', 'share'])
	})
})

describe('getRwaPerpsChartSource', () => {
	test('maps the Perps view Group by to a split and None to the contracts', () => {
		expect(RWA_GROUP_BY_OPTIONS.map((groupBy) => [groupBy, getRwaPerpsChartSource(groupBy)])).toEqual([
			['platform', { kind: 'split', breakdown: 'venue' }],
			['chain', { kind: 'split', breakdown: 'venue' }],
			['assetGroup', { kind: 'split', breakdown: 'assetGroup' }],
			['category', { kind: 'split', breakdown: 'venue' }],
			['asset', { kind: 'split', breakdown: 'baseAsset' }],
			['none', { kind: 'contracts' }]
		])
	})
})

describe('perps chart metric', () => {
	test('offers open interest and volume, defaults to open interest and omits it from the url', () => {
		expect(getRwaPerpsChartMetricOptions().map((option) => option.key)).toEqual(['openInterest', 'volume'])
		expect(parseRwaPerpsChartMetric(undefined)).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('activeMcap')).toBe('openInterest')
		expect(parseRwaPerpsChartMetric('volume')).toBe('volume')
		expect(getRwaPerpsChartMetricQueryValue('openInterest')).toBeUndefined()
		expect(getRwaPerpsChartMetricQueryValue('volume')).toBe('volume')
	})
})

describe('getRwaFlowSplitBy', () => {
	test('maps the four splits and reads the total for None and Asset', () => {
		expect(RWA_GROUP_BY_OPTIONS.map(getRwaFlowSplitBy)).toEqual([
			'platform',
			'chain',
			'assetGroup',
			'category',
			null,
			null
		])
	})
})
