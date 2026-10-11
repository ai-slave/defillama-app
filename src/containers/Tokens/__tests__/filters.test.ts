import { describe, expect, test } from 'vitest'
import {
	buildTokensFiltersQueryUpdate,
	formatTokensActiveFilter,
	getTokensFiltersDefaultSorting,
	parseTokensFiltersFromQuery,
	shouldApplyTokensFilterSorting
} from '../filters'

describe('getTokensFiltersDefaultSorting', () => {
	test('sorts by the last added filter, descending when a min is set', () => {
		expect(getTokensFiltersDefaultSorting([{ id: 'revenue24h', min: 100, max: null }])).toEqual({
			id: 'revenue24h',
			desc: true
		})
	})

	test('sorts ascending when only a max is set', () => {
		expect(getTokensFiltersDefaultSorting([{ id: 'priceChange7d', min: null, max: -5 }])).toEqual({
			id: 'priceChange7d',
			desc: false
		})
	})

	test('sorts rank ascending and returns null without filters', () => {
		expect(getTokensFiltersDefaultSorting([{ id: 'rank', min: 100, max: 500 }])).toEqual({ id: 'rank', desc: false })
		expect(getTokensFiltersDefaultSorting([])).toBeNull()
	})
})

describe('shouldApplyTokensFilterSorting', () => {
	test('applies over the default marketCap sorting', () => {
		expect(shouldApplyTokensFilterSorting({ id: 'marketCap', desc: true }, [])).toBe(true)
	})

	test('applies when current sorting came from the previous filters', () => {
		expect(
			shouldApplyTokensFilterSorting({ id: 'revenue24h', desc: true }, [{ id: 'revenue24h', min: 100, max: null }])
		).toBe(true)
	})

	test('keeps a manually chosen sorting', () => {
		expect(shouldApplyTokensFilterSorting({ id: 'priceChange24h', desc: true }, [])).toBe(false)
	})
})

describe('filters query round trip', () => {
	test('serializes and parses back', () => {
		const filters = [
			{ id: 'rank' as const, min: 100, max: 500 },
			{ id: 'marketCap' as const, min: 1_000_000_000, max: null }
		]
		const update = buildTokensFiltersQueryUpdate(filters)
		expect(update.rankFrom).toBe('100')
		expect(update.rankTo).toBe('500')
		expect(update.min_marketCap).toBe('1000000000')
		expect(update.page).toBeUndefined()
		expect(parseTokensFiltersFromQuery({ rankFrom: '100', rankTo: '500', min_marketCap: '1000000000' })).toEqual(
			filters
		)
	})

	test('normalizes garbage the same way the server does', () => {
		expect(parseTokensFiltersFromQuery({ rankFrom: '-3', rankTo: 'abc' })).toEqual([])
		expect(parseTokensFiltersFromQuery({ rankFrom: '500', rankTo: '100' })).toEqual([
			{ id: 'rank', min: 100, max: 500 }
		])
		expect(parseTokensFiltersFromQuery({ min_marketCap: '200', max_marketCap: '100' })).toEqual([
			{ id: 'marketCap', min: 100, max: 200 }
		])
	})
})

describe('formatTokensActiveFilter', () => {
	test('formats ranges and one-sided filters', () => {
		expect(formatTokensActiveFilter({ id: 'rank', min: 100, max: 500 })).toBe('Mcap Rank: 100 - 500')
		expect(formatTokensActiveFilter({ id: 'marketCap', min: 1_000_000_000, max: null })).toBe('Mcap ≥ $1B')
		expect(formatTokensActiveFilter({ id: 'priceChange7d', min: null, max: -5 })).toBe('7d Change ≤ -5%')
	})
})
