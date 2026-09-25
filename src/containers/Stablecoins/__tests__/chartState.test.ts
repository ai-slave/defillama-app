import { describe, expect, test } from 'vitest'
import {
	createStablecoinOverviewChartMode,
	getStablecoinAssetVolumeChartKind,
	getStablecoinChainsVolumeChartKind,
	getStablecoinDashboardChartType,
	getStablecoinChartViewOptions,
	getStablecoinOverviewVolumeChartKind,
	getStablecoinSeriesSelectorLabel,
	parseStablecoinVolumeGroupBy,
	parseStablecoinChartState
} from '../chartState'

describe('stablecoin chart state', () => {
	test('uses overview defaults', () => {
		expect(parseStablecoinChartState({}, createStablecoinOverviewChartMode('All'))).toMatchObject({
			type: 'marketCap',
			view: 'total'
		})
	})

	test('normalizes invalid views to the selected type default', () => {
		expect(
			parseStablecoinChartState(
				{ chartType: 'volume', chartView: 'dominance' },
				createStablecoinOverviewChartMode('All')
			)
		).toMatchObject({
			type: 'volume',
			view: 'total'
		})
	})

	test('allows scoped chain page volume views', () => {
		const state = parseStablecoinChartState(
			{ chartType: 'volume', chartView: 'byToken' },
			createStablecoinOverviewChartMode('Ethereum')
		)

		expect(state).toMatchObject({ type: 'volume', view: 'byToken' })
		expect(getStablecoinChartViewOptions(state)).toEqual([
			{ key: 'total', name: 'Total' },
			{ key: 'byToken', name: 'By Token' },
			{ key: 'byCurrency', name: 'By Currency' }
		])
		expect(
			parseStablecoinChartState(
				{ chartType: 'volume', chartView: 'byChain' },
				createStablecoinOverviewChartMode('Ethereum')
			)
		).toMatchObject({ type: 'volume', view: 'total' })
	})

	test('allows scoped asset page volume views', () => {
		const state = parseStablecoinChartState({ chartType: 'volume', chartView: 'byChain' }, { page: 'asset' })

		expect(state).toMatchObject({ type: 'volume', view: 'byChain' })
		expect(getStablecoinChartViewOptions(state)).toEqual([
			{ key: 'total', name: 'Total' },
			{ key: 'byChain', name: 'By Chain' }
		])
		expect(parseStablecoinChartState({ chartType: 'volume', chartView: 'byToken' }, { page: 'asset' })).toMatchObject({
			type: 'volume',
			view: 'total'
		})
	})

	test('parses volume grouping query values once for all stablecoin pages', () => {
		expect(parseStablecoinVolumeGroupBy('weekly')).toBe('weekly')
		expect(parseStablecoinVolumeGroupBy('cumulative')).toBe('cumulative')
		expect(parseStablecoinVolumeGroupBy(['monthly', 'weekly'])).toBe('monthly')
		expect(parseStablecoinVolumeGroupBy('invalid')).toBe('daily')
	})

	test('keeps volume views out of the dashboard chart types', () => {
		expect(getStablecoinDashboardChartType('volume', 'total')).toBeNull()
	})

	test('maps chart state to scoped volume chart requests', () => {
		expect(getStablecoinOverviewVolumeChartKind('volume', 'byChain', 'All')).toBe('chain')
		expect(getStablecoinOverviewVolumeChartKind('volume', 'byChain', 'Ethereum')).toBe('total')
		expect(getStablecoinOverviewVolumeChartKind('volume', 'byToken', 'Ethereum')).toBe('token')
		expect(getStablecoinOverviewVolumeChartKind('volume', 'byCurrency', 'Ethereum')).toBe('currency')
		expect(getStablecoinOverviewVolumeChartKind('marketCap', 'total', 'All')).toBeNull()

		expect(getStablecoinChainsVolumeChartKind('volume', 'byChain')).toBe('chain')
		expect(getStablecoinChainsVolumeChartKind('volume', 'byToken')).toBe('token')
		expect(getStablecoinChainsVolumeChartKind('marketCap', 'total')).toBeNull()

		expect(getStablecoinAssetVolumeChartKind('volume', 'byChain')).toBe('chain')
		expect(getStablecoinAssetVolumeChartKind('volume', 'byToken')).toBe('total')
		expect(getStablecoinAssetVolumeChartKind('marketCap', 'total')).toBeNull()
	})

	test('labels the peer selector by page and leaves total views without one', () => {
		expect(getStablecoinSeriesSelectorLabel(createStablecoinOverviewChartMode('All'), 'marketCap', 'breakdown')).toBe(
			'Token'
		)
		expect(getStablecoinSeriesSelectorLabel({ page: 'chains' }, 'marketCap', 'dominance')).toBe('Chain')
		expect(getStablecoinSeriesSelectorLabel({ page: 'asset' }, 'marketCap', 'total')).toBeNull()
	})
})
