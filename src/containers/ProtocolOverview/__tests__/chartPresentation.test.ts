import { describe, expect, test } from 'vitest'
import { buildChainChartPresentation } from '~/containers/ChainOverview/chartPresentation'
import { buildProtocolChartPresentation } from '../chartPresentation'

const data: Array<[number, number | null]> = [[Date.UTC(2026, 8, 20), 40]]

describe('active address series names', () => {
	test('call grouped active addresses a daily average on protocol and chain charts', () => {
		const protocol = (groupBy: 'daily' | 'weekly') =>
			buildProtocolChartPresentation({
				chartData: { 'Active Addresses': data, 'New Addresses': data },
				chartColors: {},
				groupBy,
				rangeHallmarks: null,
				isThemeDark: false,
				themeText: '#000'
			}).charts.map((chart) => chart.name)
		const chain = (groupBy: 'daily' | 'monthly') =>
			buildChainChartPresentation({ 'Active Addresses': data, 'New Addresses': data }, groupBy).charts.map(
				(chart) => chart.name
			)

		expect(protocol('weekly')).toEqual(['Active Addresses (daily average)', 'New Addresses'])
		expect(chain('monthly')).toEqual(['Active Addresses (daily average)', 'New Addresses'])
		expect(protocol('daily')).toEqual(['Active Addresses', 'New Addresses'])
		expect(chain('daily')).toEqual(['Active Addresses', 'New Addresses'])
	})
})
