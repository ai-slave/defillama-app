import { describe, expect, test } from 'vitest'
import { getEquitiesTreemapQueryValue, parseEquitiesTreemapState } from '../treemapState'

describe('parseEquitiesTreemapState', () => {
	test('defaults to the table view and market-cap sector map', () => {
		const defaults = {
			view: 'table',
			groupBy: 'sector',
			sizeMetric: 'marketCap',
			colorMetric: 'priceChangePercentage1d'
		}
		expect(parseEquitiesTreemapState({})).toEqual(defaults)
		expect(parseEquitiesTreemapState({ view: 'movers', mapGroup: 'x', mapSize: 'nope', mapColor: '1y' })).toEqual(
			defaults
		)
	})

	test('accepts valid values and takes the first array entry', () => {
		expect(
			parseEquitiesTreemapState({
				view: 'map',
				mapGroup: 'none',
				mapSize: ['employeeCount', 'marketCap'],
				mapColor: 'priceChangePercentage7d'
			})
		).toEqual({
			view: 'map',
			groupBy: 'none',
			sizeMetric: 'employeeCount',
			colorMetric: 'priceChangePercentage7d'
		})
	})

	test('omits defaults from the query', () => {
		expect(getEquitiesTreemapQueryValue('view', 'table')).toBeUndefined()
		expect(getEquitiesTreemapQueryValue('view', 'map')).toBe('map')
	})
})
