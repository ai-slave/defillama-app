import { describe, expect, it } from 'vitest'
import {
	buildEquitiesTableQueryString,
	buildEquitiesTreemapQueryString,
	getEquitiesTableQuery,
	getEquitiesTableQuerySignature,
	getEquitiesTableSortingFromQuery,
	getEquitiesTreemapSizeMetricFromQuery
} from '../tableQuery'

describe('getEquitiesTableQuery', () => {
	it('falls back to the first market-cap page for empty or invalid input', () => {
		expect(getEquitiesTableQuery({})).toEqual({
			page: 1,
			pageSize: 50,
			sortBy: 'marketCap',
			sortDesc: true,
			search: '',
			filters: []
		})
		expect(getEquitiesTableQuery({ page: '-3', pageSize: '9000', sortBy: 'ticker', sortDesc: 'nope' })).toMatchObject({
			page: 1,
			pageSize: 500,
			sortBy: 'marketCap',
			sortDesc: true
		})
	})

	it('parses paging, sort, trimmed search and compact filters', () => {
		expect(
			getEquitiesTableQuery({
				page: '3',
				pageSize: '25',
				sortBy: 'earningsTTM',
				sortDesc: 'false',
				search: ' Apple ',
				filters: 'country:in:US;marketCap:gte:1b'
			})
		).toEqual({
			page: 3,
			pageSize: 25,
			sortBy: 'earningsTTM',
			sortDesc: false,
			search: 'Apple',
			filters: [
				{ kind: 'categorical', id: 'country', mode: 'include', values: ['US'] },
				{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 1_000_000_000 }
			]
		})
	})

	it('signs on order-changing fields only, case-insensitively for search', () => {
		const a = getEquitiesTableQuery({ page: '1', search: 'Apple', filters: 'country:in:US' })
		const b = getEquitiesTableQuery({ page: '7', pageSize: '100', search: 'apple', filters: 'country:in:US' })
		expect(getEquitiesTableQuerySignature(a)).toBe(getEquitiesTableQuerySignature(b))
		expect(getEquitiesTableQuerySignature(getEquitiesTableQuery({ sortBy: 'volume' }))).not.toBe(
			getEquitiesTableQuerySignature(a)
		)
	})
})

describe('getEquitiesTableSortingFromQuery', () => {
	it('uses the preset sort when the URL has no valid sortBy', () => {
		const preset = [{ id: 'earningsTTM', desc: true }]
		expect(getEquitiesTableSortingFromQuery({}, preset)).toBe(preset)
		expect(getEquitiesTableSortingFromQuery({ sortBy: 'ticker' }, preset)).toBe(preset)
		expect(getEquitiesTableSortingFromQuery({ sortBy: 'volume', sortDesc: 'false' }, preset)).toEqual([
			{ id: 'volume', desc: false }
		])
	})
})

describe('buildEquitiesTableQueryString', () => {
	it('omits defaults and canonicalizes the filters param', () => {
		expect(
			buildEquitiesTableQueryString({
				query: { rankBy: 'earnings', view: 'table', search: '', filters: ['country:in:US', 'bogus:zz:1'] },
				pagination: { pageIndex: 0, pageSize: 50 },
				sorting: [{ id: 'marketCap', desc: true }]
			})
		).toBe('?filters=country%3Ain%3AUS')
		expect(
			buildEquitiesTableQueryString({
				query: { search: 'tsla' },
				pagination: { pageIndex: 2, pageSize: 25 },
				sorting: [{ id: 'volume', desc: false }]
			})
		).toBe('?page=3&pageSize=25&sortBy=volume&sortDesc=false&search=tsla')
		expect(
			buildEquitiesTableQueryString({
				query: {},
				pagination: { pageIndex: 0, pageSize: 50 },
				sorting: [{ id: 'marketCap', desc: true }]
			})
		).toBe('')
	})
})

describe('market map query', () => {
	it('carries filters and a non-default size metric only', () => {
		expect(buildEquitiesTreemapQueryString({ query: { page: '4', sortBy: 'volume' }, sizeMetric: 'marketCap' })).toBe(
			''
		)
		expect(
			buildEquitiesTreemapQueryString({
				query: { search: 'bank', filters: 'sector:in:Energy' },
				sizeMetric: 'revenueTTM'
			})
		).toBe('?search=bank&filters=sector%3Ain%3AEnergy&sizeMetric=revenueTTM')
		expect(getEquitiesTreemapSizeMetricFromQuery({ sizeMetric: 'employeeCount' })).toBe('employeeCount')
		expect(getEquitiesTreemapSizeMetricFromQuery({ sizeMetric: 'ticker' })).toBe('marketCap')
	})
})
