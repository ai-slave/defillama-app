import { describe, expect, test } from 'vitest'
import { buildEquitiesSectorPageViewData, readEquitiesSectorPageCompanies } from '../sectorPageData'
import type { IEquitiesListCompanyRow, IEquitiesSectorPageData } from '../types'

describe('sector page payload', () => {
	test('keeps only constituent fields used by the page', () => {
		const company = {
			ticker: 'AAPL',
			country: 'US',
			name: 'Apple Inc.',
			industry: 'Consumer Electronics',
			industrySlug: 'consumer-electronics',
			marketCap: 3_000_000_000_000,
			volume: 40_000_000,
			currentPrice: 200,
			priceChangePercentage1d: 1,
			priceChangePercentage7d: 2,
			priceChangePercentage1m: 3,
			trailingPE: 30,
			href: '/equities/AAPL:US',
			unusedUpstreamField: 'omit me'
		} as unknown as IEquitiesListCompanyRow
		const source = {
			overview: {},
			sector: {},
			industries: [],
			companies: [company]
		} as unknown as IEquitiesSectorPageData

		const viewData = buildEquitiesSectorPageViewData(source)
		expect(viewData.companies).toEqual([
			[
				'AAPL',
				'US',
				'Apple Inc.',
				'Consumer Electronics',
				'consumer-electronics',
				3_000_000_000_000,
				40_000_000,
				200,
				1,
				2,
				3,
				30
			]
		])
		expect(readEquitiesSectorPageCompanies(viewData.companies)).toEqual([
			{
				ticker: 'AAPL',
				country: 'US',
				name: 'Apple Inc.',
				industry: 'Consumer Electronics',
				industrySlug: 'consumer-electronics',
				marketCap: 3_000_000_000_000,
				volume: 40_000_000,
				currentPrice: 200,
				priceChangePercentage1d: 1,
				priceChangePercentage7d: 2,
				priceChangePercentage1m: 3,
				trailingPE: 30
			}
		])
		expect(readEquitiesSectorPageCompanies([company])).toEqual([company])
	})
})
