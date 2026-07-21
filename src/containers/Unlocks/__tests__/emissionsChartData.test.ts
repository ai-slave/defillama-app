import { describe, expect, it } from 'vitest'
import type { EmissionsChartRow } from '../api.types'
import { buildEmissionProjectionModel, processGroupedChartData, sortStacksByVolatility } from '../emissionsChartData'

function createRow(timestamp: number): EmissionsChartRow {
	return { timestamp }
}

describe('emissions chart data transforms', () => {
	it('keeps forecast series separate when standard allocation groups their base series', () => {
		const result = buildEmissionProjectionModel({
			chartSections: ['App Rewards', 'App Rewards (forecast)'],
			categoriesBreakdown: { farming: ['App Rewards'] },
			sectionMetadata: {
				'App Rewards': {},
				'App Rewards (forecast)': { isForecast: true, colorFrom: 'App Rewards' }
			},
			seriesTbdSections: [],
			seriesForecastSections: []
		})

		expect(result).toEqual({
			categoriesBreakdown: {
				farming: ['App Rewards'],
				'farming (forecast)': ['App Rewards (forecast)']
			},
			tbdSections: [],
			forecastSections: ['App Rewards (forecast)', 'farming (forecast)']
		})

		const row = createRow(1)
		row['App Rewards'] = 10
		row['App Rewards (forecast)'] = 4
		expect(processGroupedChartData([row], result.categoriesBreakdown!)).toEqual([
			{ timestamp: 1, farming: 10, 'farming (forecast)': 4 }
		])
	})

	it('keeps directly grouped TBD series separate from documented values', () => {
		const result = buildEmissionProjectionModel({
			chartSections: ['Community', 'Community (TBD)'],
			categoriesBreakdown: { farming: ['Community', 'Community (TBD)'] },
			sectionMetadata: { 'Community (TBD)': { isTBD: true } },
			seriesTbdSections: [],
			seriesForecastSections: []
		})

		expect(result).toEqual({
			categoriesBreakdown: {
				farming: ['Community'],
				'farming (TBD)': ['Community (TBD)']
			},
			tbdSections: ['Community (TBD)', 'farming (TBD)'],
			forecastSections: []
		})
	})

	it('uses projection flags carried by chart points when section metadata is absent', () => {
		expect(
			buildEmissionProjectionModel({
				chartSections: ['Forecast Rewards'],
				categoriesBreakdown: null,
				sectionMetadata: undefined,
				seriesTbdSections: [],
				seriesForecastSections: ['Forecast Rewards']
			})
		).toEqual({
			categoriesBreakdown: null,
			tbdSections: [],
			forecastSections: ['Forecast Rewards']
		})
	})

	it('ignores flagged metadata sections that have no chart data', () => {
		const result = buildEmissionProjectionModel({
			chartSections: ['Node Operators & Company'],
			categoriesBreakdown: {
				insiders: ['Node Operators & Company'],
				noncirculating: ['Remaining Node Operators & Company (TBD)']
			},
			sectionMetadata: { 'Remaining Node Operators & Company (TBD)': { isTBD: true } },
			seriesTbdSections: [],
			seriesForecastSections: []
		})

		expect(result).toEqual({
			categoriesBreakdown: { insiders: ['Node Operators & Company'] },
			tbdSections: [],
			forecastSections: []
		})
	})

	it('groups categories with case-insensitive first-match semantics', () => {
		const row = createRow(1)
		row.Team = 10
		row.team = 20
		row.Price = 2
		row['Market Cap'] = 200

		const [result] = processGroupedChartData([row], { Allocation: ['team'] })

		expect(result).toEqual({
			timestamp: 1,
			Price: 2,
			'Market Cap': 200,
			Allocation: 10
		})
	})

	it('sorts stacks by volatility without mutating their input order', () => {
		const first = createRow(1)
		first.volatile = 0
		first.moderate = 0
		first.steady = 2
		const second = createRow(2)
		second.volatile = 10
		second.moderate = 5
		second.steady = 2
		const stacks = ['moderate', 'volatile', 'steady']

		expect(sortStacksByVolatility(stacks, [first, second])).toEqual(['volatile', 'moderate', 'steady'])
		expect(stacks).toEqual(['moderate', 'volatile', 'steady'])
	})
})
