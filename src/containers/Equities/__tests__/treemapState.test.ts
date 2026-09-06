import { describe, expect, test } from 'vitest'
import { EQUITIES_TREEMAP_DEFAULTS, getEquitiesTreemapQueryValue, parseEquitiesTreemapState } from '../treemapState'

describe('parseEquitiesTreemapState', () => {
	test('defaults to the table view and market-cap sector map', () => {
		expect(parseEquitiesTreemapState({})).toEqual(EQUITIES_TREEMAP_DEFAULTS)
		expect(parseEquitiesTreemapState({ view: 'movers', mapGroup: 'x', mapSize: 'nope', mapColor: '1y' })).toEqual(
			EQUITIES_TREEMAP_DEFAULTS
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
