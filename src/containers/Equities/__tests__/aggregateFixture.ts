import type { IndustryAggregateRow } from '../aggregateData'

export function industry(overrides: Partial<IndustryAggregateRow> = {}): IndustryAggregateRow {
	return {
		industry: 'Software',
		industrySlug: 'software',
		sector: 'Technology',
		sectorSlug: 'technology',
		marketCap: 10_000_000_000,
		weight: 1,
		sectorWeight: 5,
		companyCount: 10,
		dollarVolume24h: 500,
		priceChangePercentage1d: 1,
		priceChangePercentage7d: 2,
		priceChangePercentage1m: 3,
		priceChangePercentage3m: 4,
		priceChangePercentage6m: 5,
		priceChangePercentageYtd: 6,
		priceChangePercentage1y: 7,
		trailingPE: 20,
		dividendYield: 1,
		...overrides
	}
}
