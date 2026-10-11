import { describe, expect, test } from 'vitest'
import {
	getChartMetricOptions,
	getChartMetricQueryValue,
	getChartViewOptions,
	getChartViewQueryValue,
	getTreemapNestedByQueryValue,
	parseRwaChartState,
	setTreemapNestedBy
} from '../chartState'

const chain = { treemapParentGrouping: 'chain' as const }

describe('parseRwaChartState', () => {
	test('normalizes legacy hbar query values', () => {
		expect(parseRwaChartState({ chartView: 'bar' }, chain).view).toBe('hbar')
	})

	test('accepts the share view and falls back to the time series for an unknown view', () => {
		expect(parseRwaChartState({ chartView: 'share' }, chain).view).toBe('share')
		expect(parseRwaChartState({ chartView: 'donut' }, chain).view).toBe('timeSeries')
	})

	test('accepts asset-group treemap nesting by category', () => {
		const state = parseRwaChartState(
			{ chartView: 'treemap', treemapNestedBy: 'category' },
			{ treemapParentGrouping: 'assetGroup' }
		)
		expect(state).toMatchObject({ view: 'treemap', treemapNestedBy: 'category' })
	})

	test('falls back to the parent grouping default when the nesting is not allowed', () => {
		expect(
			parseRwaChartState({ treemapNestedBy: 'category' }, { treemapParentGrouping: 'platform' }).treemapNestedBy
		).toBe('none')
		expect(parseRwaChartState({}, { treemapParentGrouping: 'category' }).treemapNestedBy).toBe('assetClass')
	})
})

describe('chartState options', () => {
	test('lists the five views with the time series first and Share second', () => {
		expect(getChartViewOptions().map(({ key }) => key)).toEqual(['timeSeries', 'share', 'pie', 'treemap', 'hbar'])
		expect(getChartViewQueryValue('timeSeries')).toBeUndefined()
		expect(getChartViewQueryValue('share')).toBe('share')
	})

	test('sets an allowed nesting and rejects one the parent does not support', () => {
		const state = parseRwaChartState({}, { treemapParentGrouping: 'assetGroup' })
		expect(setTreemapNestedBy(state, 'assetGroup', 'category').treemapNestedBy).toBe('category')
		expect(() => setTreemapNestedBy(state, 'platform', 'category')).toThrow(
			'Invalid treemap nested-by category for platform'
		)
	})

	test('omits the default nesting from the url', () => {
		const state = parseRwaChartState({}, { treemapParentGrouping: 'category' })
		expect(getTreemapNestedByQueryValue(state, 'category')).toBeUndefined()
		expect(getTreemapNestedByQueryValue({ ...state, treemapNestedBy: 'none' }, 'category')).toBe('none')
	})
})

describe('chart metric availability', () => {
	const noActiveMcap = { hasActiveMcapData: false }

	test('offers all three metrics and defaults to active mcap when it is tracked', () => {
		expect(getChartMetricOptions().map(({ key }) => key)).toEqual(['activeMcap', 'onChainMcap', 'defiActiveTvl'])
		expect(parseRwaChartState({}, chain).metric).toBe('activeMcap')
	})

	test('drops active mcap and normalizes its default and stale query value to onchain mcap', () => {
		expect(getChartMetricOptions(noActiveMcap).map(({ key }) => key)).toEqual(['onChainMcap', 'defiActiveTvl'])
		expect(parseRwaChartState({}, { ...chain, availability: noActiveMcap }).metric).toBe('onChainMcap')
		expect(parseRwaChartState({ chartType: 'activeMcap' }, { ...chain, availability: noActiveMcap }).metric).toBe(
			'onChainMcap'
		)
	})

	test('still honors the other metrics from the query string', () => {
		expect(parseRwaChartState({ chartType: 'defiActiveTvl' }, { ...chain, availability: noActiveMcap }).metric).toBe(
			'defiActiveTvl'
		)
	})

	test('omits the effective default from the url and keeps non-defaults explicit', () => {
		expect(getChartMetricQueryValue('activeMcap')).toBeUndefined()
		expect(getChartMetricQueryValue('onChainMcap')).toBe('onChainMcap')
		expect(getChartMetricQueryValue('onChainMcap', noActiveMcap)).toBeUndefined()
		expect(getChartMetricQueryValue('defiActiveTvl', noActiveMcap)).toBe('defiActiveTvl')
	})
})
