import { describe, expect, test } from 'vitest'
import {
	getTokenOverviewChartBody,
	getTokenOverviewChartQuery,
	resolveTokenOverviewCharts,
	roundToSignificantFigures
} from '../TokenOverviewSection.utils'

describe('roundToSignificantFigures', () => {
	test('rounds a BTC-sized price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(118_000 * 0.95)).toBe(112_100)
	})

	test('rounds a sub-cent memecoin price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(0.00004521 * 0.95)).toBe(0.00004295)
	})

	test('keeps a mid-range price at 4 significant figures', () => {
		expect(roundToSignificantFigures(4521.789)).toBe(4522)
	})

	test('returns 0 for non-finite input instead of throwing', () => {
		expect(roundToSignificantFigures(NaN)).toBe(0)
		expect(roundToSignificantFigures(Infinity)).toBe(0)
		expect(roundToSignificantFigures(-Infinity)).toBe(0)
	})

	test('supports a custom significant-figure count', () => {
		expect(roundToSignificantFigures(118_000 * 0.95, 2)).toBe(110_000)
	})
})

const PRICE: Array<[number, number]> = [[1000, 100]]

describe('resolveTokenOverviewCharts', () => {
	test('offers fetchable series for a CoinGecko token and shows price by default', () => {
		expect(
			resolveTokenOverviewCharts({ geckoId: 'bitcoin', rawChartData: { 'Token Price': PRICE }, chartQuery: undefined })
		).toEqual({
			availableCharts: ['Token Price', 'Token Volume', 'Mcap', 'FDV'],
			defaultCharts: ['Token Price'],
			activeCharts: ['Token Price']
		})
	})

	test('offers only the series the page carries for a token without a CoinGecko id', () => {
		expect(resolveTokenOverviewCharts({ geckoId: null, rawChartData: { Mcap: PRICE }, chartQuery: undefined })).toEqual(
			{
				availableCharts: ['Mcap'],
				defaultCharts: ['Mcap'],
				activeCharts: ['Mcap']
			}
		)
	})

	test('shows a bookmarked chart selection, an explicit empty chart, and ignores unknown series', () => {
		const chart = (chartQuery: string | Array<string>) =>
			resolveTokenOverviewCharts({ geckoId: 'bitcoin', rawChartData: { 'Token Price': PRICE }, chartQuery })
				.activeCharts

		expect(chart('Token Volume')).toEqual(['Token Volume'])
		expect(chart(['FDV', 'Mcap'])).toEqual(['FDV', 'Mcap'])
		expect(chart('None')).toEqual([])
		expect(chart('Nonsense')).toEqual(['Token Price'])
	})
})

describe('getTokenOverviewChartQuery', () => {
	const available = ['Token Price', 'Token Volume', 'Mcap', 'FDV'] as const

	test('drops the query for the default selection and writes None for an empty one', () => {
		expect(getTokenOverviewChartQuery(['Token Price'], [...available], ['Token Price'])).toBeUndefined()
		expect(getTokenOverviewChartQuery([], [...available], ['Token Price'])).toBe('None')
	})

	test('keeps each offered series once, in the order chosen', () => {
		expect(
			getTokenOverviewChartQuery(['Mcap', 'Token Price', 'Mcap'], ['Token Price', 'Mcap'], ['Token Price'])
		).toEqual(['Mcap', 'Token Price'])
	})
})

describe('getTokenOverviewChartBody', () => {
	const base = {
		isClient: true,
		geckoId: 'bitcoin',
		pendingChartCount: 0,
		readFailed: false,
		isLoading: false,
		hasChartData: true,
		activeChartCount: 1
	}

	test('renders nothing on the server for series the client still has to fetch', () => {
		expect(getTokenOverviewChartBody({ ...base, isClient: false, pendingChartCount: 1, hasChartData: false })).toBe(
			'wait-for-client'
		)
		expect(getTokenOverviewChartBody({ ...base, pendingChartCount: 1, isLoading: true })).toBe('loading')
	})

	test('a failed read with nothing to draw is an error, kept while its retry loads', () => {
		const failed = { ...base, pendingChartCount: 1, readFailed: true, hasChartData: false }
		expect(getTokenOverviewChartBody(failed)).toBe('error')
		expect(getTokenOverviewChartBody({ ...failed, isLoading: true })).toBe('error')
		// A series that failed beside drawn ones keeps the chart.
		expect(getTokenOverviewChartBody({ ...failed, hasChartData: true })).toBe('chart')
	})

	test('explains why there is no chart', () => {
		expect(getTokenOverviewChartBody({ ...base, hasChartData: false })).toBe('unavailable')
		expect(getTokenOverviewChartBody({ ...base, hasChartData: false, activeChartCount: 0 })).toBe('select-metrics')
		expect(getTokenOverviewChartBody({ ...base, geckoId: null, hasChartData: false })).toBe('no-market-data')
	})

	test('charts whatever data is ready', () => {
		expect(getTokenOverviewChartBody(base)).toBe('chart')
		expect(getTokenOverviewChartBody({ ...base, pendingChartCount: 1 })).toBe('chart')
	})
})
