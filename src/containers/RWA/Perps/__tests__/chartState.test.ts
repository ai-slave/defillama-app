import { describe, expect, test } from 'vitest'
import {
	getRWAPerpsChartBreakdownQueryValue,
	getRWAPerpsChartControls,
	getRWAPerpsChartViewQueryValueForMode,
	getRWAPerpsTimeSeriesModeQueryValue,
	getRWAPerpsVolumeGroupByQueryValue,
	parseRWAPerpsChartState,
	parseRWAPerpsVolumeGroupBy,
	setRWAPerpsChartView
} from '../chartState'

describe('parseRWAPerpsChartState', () => {
	test('normalizes volume date grouping query values', () => {
		expect(parseRWAPerpsVolumeGroupBy(undefined)).toBe('daily')
		expect(parseRWAPerpsVolumeGroupBy('monthly')).toBe('monthly')
		expect(parseRWAPerpsVolumeGroupBy(['yearly'])).toBe('yearly')
		expect(parseRWAPerpsVolumeGroupBy('cumulative')).toBe('daily')
		expect(getRWAPerpsVolumeGroupByQueryValue('daily')).toBeUndefined()
		expect(getRWAPerpsVolumeGroupByQueryValue('quarterly')).toBe('quarterly')
	})

	test('normalizes legacy hbar query values', () => {
		const state = parseRWAPerpsChartState({ chartView: 'bar' }, 'overview')
		expect(state.view).toBe('hbar')
	})

	test('defaults all pages to time series when no chart view is provided', () => {
		const overviewState = parseRWAPerpsChartState({}, 'overview')
		const venueState = parseRWAPerpsChartState({}, 'venue')
		const assetGroupState = parseRWAPerpsChartState({}, 'assetGroup')
		const assetState = parseRWAPerpsChartState({}, 'asset')

		expect(overviewState).toMatchObject({
			view: 'timeSeries',
			breakdown: 'assetGroup',
			timeSeriesMode: 'breakdown',
			treemapNestedBy: 'baseAsset'
		})
		expect(venueState).toMatchObject({
			view: 'timeSeries',
			breakdown: 'assetGroup',
			timeSeriesMode: 'breakdown',
			treemapNestedBy: 'baseAsset'
		})
		expect(assetGroupState).toMatchObject({
			view: 'timeSeries',
			breakdown: 'baseAsset',
			timeSeriesMode: 'breakdown',
			treemapNestedBy: 'contract'
		})
		expect(assetState).toMatchObject({
			view: 'timeSeries',
			breakdown: 'venue',
			timeSeriesMode: 'breakdown',
			treemapNestedBy: 'contract'
		})
	})

	test('defaults overview treemap to asset group nested by base asset', () => {
		const state = parseRWAPerpsChartState({ chartView: 'treemap' }, 'overview')

		expect(state).toMatchObject({
			view: 'treemap',
			breakdown: 'assetGroup',
			treemapNestedBy: 'baseAsset'
		})
	})

	test('defaults venue treemap to asset group nested by base asset', () => {
		const state = parseRWAPerpsChartState({ chartView: 'treemap' }, 'venue')

		expect(state).toMatchObject({
			view: 'treemap',
			breakdown: 'assetGroup',
			treemapNestedBy: 'baseAsset'
		})
	})

	test('accepts a valid perps treemap nested grouping', () => {
		const state = parseRWAPerpsChartState(
			{
				chartView: 'treemap',
				nonTimeSeriesChartBreakdown: 'assetClass',
				treemapNestedBy: 'baseAsset'
			},
			'overview'
		)

		expect(state).toMatchObject({
			view: 'treemap',
			breakdown: 'assetClass',
			treemapNestedBy: 'baseAsset'
		})
	})

	test('falls back safely when treemapNestedBy is invalid for the selected parent group', () => {
		const state = parseRWAPerpsChartState(
			{
				chartView: 'treemap',
				nonTimeSeriesChartBreakdown: 'baseAsset',
				treemapNestedBy: 'assetClass'
			},
			'venue'
		)

		expect(state).toMatchObject({
			view: 'treemap',
			breakdown: 'baseAsset',
			treemapNestedBy: 'contract'
		})
	})

	test('parses the grouped time-series mode query', () => {
		expect(parseRWAPerpsChartState({ timeSeriesMode: 'grouped' }, 'overview').timeSeriesMode).toBe('grouped')
	})

	test('supports a page-specific time-series breakdown default', () => {
		const state = parseRWAPerpsChartState({}, 'overview', { timeSeriesBreakdown: 'baseAsset' })

		expect(state).toMatchObject({
			view: 'timeSeries',
			breakdown: 'baseAsset',
			timeSeriesMode: 'breakdown'
		})
		expect(getRWAPerpsChartBreakdownQueryValue(state, { timeSeriesBreakdown: 'baseAsset' })).toBeUndefined()
	})
})

describe('perps chartState options', () => {
	test.each(['overview', 'venue', 'assetGroup', 'asset'] as const)(
		'omits the time series view from the %s page url and keeps other views explicit',
		(mode) => {
			expect(getRWAPerpsChartViewQueryValueForMode(mode, 'timeSeries')).toBeUndefined()
			expect(getRWAPerpsChartViewQueryValueForMode(mode, 'pie')).toBe('pie')
		}
	)

	test('omits the default breakdown time-series mode from the query', () => {
		expect(getRWAPerpsTimeSeriesModeQueryValue('breakdown')).toBeUndefined()
		expect(getRWAPerpsTimeSeriesModeQueryValue('grouped')).toBe('grouped')
	})

	// A single-asset page has one base asset, so it cannot break down by it.
	test('falls back to venue when an asset page asks for a base asset breakdown', () => {
		expect(parseRWAPerpsChartState({ timeSeriesChartBreakdown: 'baseAsset' }, 'asset').breakdown).toBe('venue')
		expect(
			parseRWAPerpsChartState({ chartView: 'treemap', nonTimeSeriesChartBreakdown: 'baseAsset' }, 'asset').breakdown
		).toBe('venue')
	})

	test('keeps the selected breakdown and nesting when switching into treemap view', () => {
		const nextState = setRWAPerpsChartView(
			{
				mode: 'overview',
				view: 'pie',
				metric: 'openInterest',
				breakdown: 'assetClass',
				timeSeriesMode: 'grouped',
				treemapNestedBy: 'baseAsset'
			},
			'treemap'
		)

		expect(nextState).toMatchObject({
			view: 'treemap',
			breakdown: 'assetClass',
			treemapNestedBy: 'baseAsset'
		})
	})
})

describe('getRWAPerpsChartControls', () => {
	test.each([
		{ query: {}, controls: { nestedBy: false, restore: false, dateGrouping: false } },
		{ query: { chartType: 'volume24h' }, controls: { nestedBy: false, restore: false, dateGrouping: true } },
		{
			query: { chartView: 'pie', chartType: 'volume24h' },
			controls: { nestedBy: false, restore: false, dateGrouping: false }
		},
		{ query: { chartView: 'treemap' }, controls: { nestedBy: true, restore: true, dateGrouping: false } },
		{
			query: { chartView: 'treemap', nonTimeSeriesChartBreakdown: 'contract' },
			controls: { nestedBy: false, restore: true, dateGrouping: false }
		}
	])('shows the overview controls that apply to $query', ({ query, controls }) => {
		expect(getRWAPerpsChartControls(parseRWAPerpsChartState(query, 'overview'))).toEqual(controls)
	})
})
