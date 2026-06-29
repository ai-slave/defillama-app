import { describe, expect, it } from 'vitest'
import {
	draftEquityFiltersToActive,
	filterEquityCompanies,
	parseEquityFiltersQuery,
	serializeEquityFiltersQuery,
	type EquityActiveFilter,
	type EquityDraftFilter
} from '../filters'
import type { IEquitiesListCompanyRow } from '../types'

function company(overrides: Partial<IEquitiesListCompanyRow>): IEquitiesListCompanyRow {
	return {
		ticker: 'BASE',
		country: 'US',
		name: 'Base Company',
		currentPrice: null,
		volume: null,
		marketCap: null,
		circulatingMarketCap: null,
		enterpriseValue: null,
		fiftyTwoWeekHigh: null,
		fiftyTwoWeekLow: null,
		dividendYield: null,
		trailingPE: null,
		priceToRevenue: null,
		priceChangePercentage1d: null,
		priceChangePercentage7d: null,
		priceChangePercentage1m: null,
		priceChange1d: null,
		marketCapChange1d: null,
		priceToBook: null,
		enterpriseValueToEbitda: null,
		holdersYield: null,
		updatedAt: null,
		revenueTTM: null,
		grossProfitTTM: null,
		earningsTTM: null,
		ebitdaTTM: null,
		operatingProfitMarginTTM: null,
		holdersRevenueTTM: null,
		holderEarningsTTM: null,
		dividendsTTM: null,
		stockRepurchaseTTM: null,
		stockIssuanceTTM: null,
		stockBasedCompensationTTM: null,
		cashAndCashEquivalents: null,
		totalAssets: null,
		totalLiabilities: null,
		totalShareholdersEquity: null,
		totalDebt: null,
		circulatingSupply: null,
		totalSupply: null,
		employeeCount: null,
		sector: 'Technology',
		industry: 'Software',
		href: '/equities/BASE:US',
		...overrides
	}
}

describe('filterEquityCompanies', () => {
	it('applies numeric filters as AND conditions', () => {
		const filters: EquityActiveFilter[] = [
			{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 10_000_000_000 },
			{ kind: 'numeric', id: 'trailingPE', operator: '<', value: 20 },
			{ kind: 'numeric', id: 'holdersYield', operator: '>', value: 3 }
		]

		const companies = [
			company({ ticker: 'PASS', marketCap: 15_000_000_000, trailingPE: 18, holdersYield: 3.5 }),
			company({ ticker: 'SMALL', marketCap: 9_000_000_000, trailingPE: 18, holdersYield: 3.5 }),
			company({ ticker: 'RICH', marketCap: 15_000_000_000, trailingPE: 22, holdersYield: 3.5 }),
			company({ ticker: 'LOWYIELD', marketCap: 15_000_000_000, trailingPE: 18, holdersYield: 2.5 })
		]

		expect(filterEquityCompanies(companies, filters).map((row) => row.ticker)).toEqual(['PASS'])
	})

	it('supports categorical include and exclude filters', () => {
		const filters: EquityActiveFilter[] = [
			{ kind: 'categorical', id: 'sector', mode: 'include', values: ['Technology'] },
			{ kind: 'categorical', id: 'industry', mode: 'exclude', values: ['Hardware'] }
		]

		const companies = [
			company({ ticker: 'SOFT', sector: 'Technology', industry: 'Software' }),
			company({ ticker: 'HARD', sector: 'Technology', industry: 'Hardware' }),
			company({ ticker: 'BANK', sector: 'Financial Services', industry: 'Banks' })
		]

		expect(filterEquityCompanies(companies, filters).map((row) => row.ticker)).toEqual(['SOFT'])
	})

	it('excludes rows with null numeric values when that metric is filtered', () => {
		const filters: EquityActiveFilter[] = [{ kind: 'numeric', id: 'trailingPE', operator: '<', value: 20 }]

		const companies = [company({ ticker: 'VALUED', trailingPE: 15 }), company({ ticker: 'MISSING', trailingPE: null })]

		expect(filterEquityCompanies(companies, filters).map((row) => row.ticker)).toEqual(['VALUED'])
	})

	it('normalizes draft filters into valid applied filters', () => {
		const filters: EquityDraftFilter[] = [
			{ kind: 'numericRange', id: 'marketCap', minValue: 1_000_000_000, maxValue: 500_000_000 },
			{ kind: 'numericRange', id: 'trailingPE', maxValue: 20 },
			{ kind: 'categorical', id: 'sector', mode: 'include', values: [] },
			{ kind: 'categorical', id: 'industry', mode: 'exclude', values: ['Hardware'] }
		]

		expect(draftEquityFiltersToActive(filters)).toEqual([
			{ kind: 'numericRange', id: 'marketCap', minValue: 500_000_000, maxValue: 1_000_000_000 },
			{ kind: 'numeric', id: 'trailingPE', operator: '<=', value: 20 },
			{ kind: 'categorical', id: 'industry', mode: 'exclude', values: ['Hardware'] }
		])
	})
})

describe('equity filter query encoding', () => {
	it('round-trips active filters through the compact query format', () => {
		const filters: EquityActiveFilter[] = [
			{ kind: 'categorical', id: 'country', mode: 'include', values: ['US', 'CA'] },
			{ kind: 'categorical', id: 'sector', mode: 'exclude', values: ['Financial Services'] },
			{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 10_000_000_000 },
			{ kind: 'numeric', id: 'trailingPE', operator: '<=', value: 20 },
			{ kind: 'numericRange', id: 'holdersYield', minValue: 2, maxValue: 8 }
		]

		const query = serializeEquityFiltersQuery(filters)

		expect(query).toBe(
			'country:in:US,CA;sector:out:Financial%20Services;marketCap:gte:10000000000;trailingPE:lte:20;holdersYield:between:2,8'
		)
		expect(parseEquityFiltersQuery(query)).toEqual(filters)
	})

	it('parses repeated filter query params and URL-encoded delimiter characters', () => {
		expect(parseEquityFiltersQuery(['country:in:US', 'industry:in:Oil%2C%20Gas%3A%20E%26P;marketCap:gte:10b'])).toEqual(
			[
				{ kind: 'categorical', id: 'country', mode: 'include', values: ['US'] },
				{ kind: 'categorical', id: 'industry', mode: 'include', values: ['Oil, Gas: E&P'] },
				{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 10_000_000_000 }
			]
		)
	})

	it('ignores invalid query filters and lets later duplicate filters win', () => {
		expect(
			parseEquityFiltersQuery(
				[
					'unknown:gte:1',
					'marketCap:nope:1',
					'marketCap:gte:not-a-number',
					'sector:in:',
					'marketCap:gte:100',
					'marketCap:lte:50',
					'trailingPE:between:30,10'
				].join(';')
			)
		).toEqual([
			{ kind: 'numeric', id: 'marketCap', operator: '<=', value: 50 },
			{ kind: 'numericRange', id: 'trailingPE', minValue: 10, maxValue: 30 }
		])
	})

	it('keeps duplicate filters in their first position while applying the latest value', () => {
		expect(parseEquityFiltersQuery('trailingPE:gte:1;marketCap:gte:100;trailingPE:lte:50')).toEqual([
			{ kind: 'numeric', id: 'trailingPE', operator: '<=', value: 50 },
			{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 100 }
		])
	})

	it('round-trips numeric filters that serialize with exponent notation', () => {
		const filters: EquityActiveFilter[] = [
			{ kind: 'numeric', id: 'currentPrice', operator: '>=', value: 1e-7 },
			{ kind: 'numericRange', id: 'marketCap', minValue: 1e21, maxValue: 2e21 }
		]

		expect(parseEquityFiltersQuery(serializeEquityFiltersQuery(filters))).toEqual(filters)
	})

	it('omits the query param when no filters are active', () => {
		expect(serializeEquityFiltersQuery([])).toBeUndefined()
		expect(parseEquityFiltersQuery(undefined)).toEqual([])
	})
})
