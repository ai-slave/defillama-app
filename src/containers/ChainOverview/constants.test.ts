import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { chainCharts, chainOverviewChartColors, getChainOverviewPaletteColor } from './constants'

describe('ChainOverview chart colors', () => {
	test('keeps every chart label aligned with its established palette index', () => {
		expect(Object.keys(chainOverviewChartColors)).toEqual(Object.keys(chainCharts))
		expect(Object.values(chainOverviewChartColors)).toEqual(CHART_COLORS.slice(0, Object.keys(chainCharts).length))
	})

	test('fails explicitly when a palette index is unavailable', () => {
		expect(() => getChainOverviewPaletteColor(CHART_COLORS.length)).toThrow('Missing ChainOverview chart color')
	})
})
