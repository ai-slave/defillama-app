import { expect, test } from 'vitest'
import { buildEquitiesSectorPageViewData, readEquitiesSectorPageCompanies } from '../sectorPageData'
import type { IEquitiesListCompanyRow, IEquitiesSectorPageData } from '../types'

test('the sector page reads back every company field the server keeps, and nothing else', () => {
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

	expect(readEquitiesSectorPageCompanies(buildEquitiesSectorPageViewData(source).companies)).toEqual([
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
})
