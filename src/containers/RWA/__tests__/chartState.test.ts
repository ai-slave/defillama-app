import { describe, expect, it } from 'vitest'
import {
	createRwaChartModeState,
	getChartBreakdownOptions,
	getChartBreakdownQueryValue,
	getChartMetricOptions,
	getChartMetricQueryValue,
	getDefaultChartBreakdown,
	getTreemapNestedByOptions,
	parseRwaChartState
} from '../chartState'

describe('parseRwaChartState', () => {
	it('normalizes legacy hbar query values', () => {
		const state = parseRwaChartState({ chartView: 'bar' }, createRwaChartModeState('chain', false, null))
		expect(state.view).toBe('hbar')
	})

	it('falls back to the chain time-series default when the query value is invalid', () => {
		const state = parseRwaChartState(
			{ timeSeriesChartBreakdown: 'assetName' },
			createRwaChartModeState('chain', false, null)
		)

		expect(state).toMatchObject({
			view: 'timeSeries',
			breakdown: 'assetGroup'
		})
	})

	it('keeps a valid category time-series breakdown', () => {
		const state = parseRwaChartState(
			{ timeSeriesChartBreakdown: 'platform' },
			createRwaChartModeState('category', true, null)
		)

		expect(state).toMatchObject({
			view: 'timeSeries',
			breakdown: 'platform'
		})
	})

	it('uses asset group as the non-time-series default where supported', () => {
		expect(parseRwaChartState({ chartView: 'pie' }, createRwaChartModeState('chain', false, null)).breakdown).toBe(
			'assetGroup'
		)
		expect(parseRwaChartState({ chartView: 'pie' }, createRwaChartModeState('category', true, null)).breakdown).toBe(
			'assetGroup'
		)
		expect(parseRwaChartState({ chartView: 'pie' }, createRwaChartModeState('platform', true, null)).breakdown).toBe(
			'assetGroup'
		)
	})

	it('keeps asset name as the asset-group page non-time-series default', () => {
		const state = parseRwaChartState({ chartView: 'pie' }, createRwaChartModeState('assetGroup', true, null))
		expect(state.breakdown).toBe('assetName')
	})

	it('accepts asset-group treemap nesting by category', () => {
		const state = parseRwaChartState(
			{
				chartView: 'treemap',
				nonTimeSeriesChartBreakdown: 'assetGroup',
				treemapNestedBy: 'category'
			},
			createRwaChartModeState('platform', true, null)
		)

		expect(state).toMatchObject({
			view: 'treemap',
			breakdown: 'assetGroup',
			treemapNestedBy: 'category'
		})
	})
})

describe('chartState options', () => {
	it('matches the current time-series breakdown matrix', () => {
		expect(getDefaultChartBreakdown(createRwaChartModeState('chain', false, null), 'timeSeries')).toBe('assetGroup')
		expect(getDefaultChartBreakdown(createRwaChartModeState('category', true, null), 'timeSeries')).toBe('assetGroup')
		expect(getDefaultChartBreakdown(createRwaChartModeState('platform', true, null), 'timeSeries')).toBe('assetGroup')
		expect(getDefaultChartBreakdown(createRwaChartModeState('assetGroup', true, 'treasuries'), 'timeSeries')).toBe(
			'assetName'
		)
	})

	it('defaults public equities time series to platform while keeping explicit choices', () => {
		const mode = createRwaChartModeState('assetGroup', true, 'public-equities')
		const defaultState = parseRwaChartState({}, mode)
		const assetNameState = parseRwaChartState({ timeSeriesChartBreakdown: 'assetName' }, mode)

		expect(defaultState.breakdown).toBe('platform')
		expect(getChartBreakdownQueryValue(defaultState)).toBeUndefined()
		expect(assetNameState.breakdown).toBe('assetName')
	})

	it('adds chain only when the mode allows it', () => {
		const withChain = getChartBreakdownOptions({
			mode: createRwaChartModeState('category', true, null),
			view: 'pie'
		})
		const withoutChain = getChartBreakdownOptions({
			mode: createRwaChartModeState('chain', false, null),
			view: 'pie'
		})

		expect(withChain.map(({ key }) => key)).toContain('chain')
		expect(withoutChain.map(({ key }) => key)).not.toContain('chain')
	})

	it('includes asset category as an asset-group treemap nested option', () => {
		expect(getTreemapNestedByOptions('assetGroup').map(({ key }) => key)).toEqual([
			'none',
			'assetClass',
			'assetName',
			'category'
		])
	})
})

describe('chart metric availability', () => {
	const mode = createRwaChartModeState('platform', true, null)
	const noActiveMcap = { hasActiveMcapData: false }

	it('offers all three metrics and defaults to active mcap when it is tracked', () => {
		expect(getChartMetricOptions().map(({ key }) => key)).toEqual(['activeMcap', 'onChainMcap', 'defiActiveTvl'])
		expect(parseRwaChartState({}, mode).metric).toBe('activeMcap')
	})

	it('drops active mcap and normalizes its default and stale query value to onchain mcap', () => {
		expect(getChartMetricOptions(noActiveMcap).map(({ key }) => key)).toEqual(['onChainMcap', 'defiActiveTvl'])
		expect(parseRwaChartState({}, mode, noActiveMcap).metric).toBe('onChainMcap')
		expect(parseRwaChartState({ chartType: 'activeMcap' }, mode, noActiveMcap).metric).toBe('onChainMcap')
	})

	it('still honours the other metrics from the query string', () => {
		expect(parseRwaChartState({ chartType: 'defiActiveTvl' }, mode, noActiveMcap).metric).toBe('defiActiveTvl')
	})

	it('omits the effective default from the url and keeps non-defaults explicit', () => {
		expect(getChartMetricQueryValue('activeMcap')).toBeUndefined()
		expect(getChartMetricQueryValue('onChainMcap')).toBe('onChainMcap')
		expect(getChartMetricQueryValue('onChainMcap', noActiveMcap)).toBeUndefined()
		expect(getChartMetricQueryValue('defiActiveTvl', noActiveMcap)).toBe('defiActiveTvl')
	})
})
