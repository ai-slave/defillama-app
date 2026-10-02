import { describe, expect, test } from 'vitest'
import {
	buildIndustriesPageData,
	buildIndustrySummary,
	buildSectorTreemapData,
	calculateCompanyDollarVolume,
	calculateConstituentSectorWeight,
	calculateNetMargin,
	filterKnownAggregates,
	filterIndustryTail,
	getIndustryTreemapOther,
	normalizeIndustrySelection,
	selectIndustryReturnMatrix,
	sortNullableRows,
	sortRowsByValue,
	type IndustryAggregateRow,
	type SectorAggregateRow
} from '../aggregateData'

function industry(overrides: Partial<IndustryAggregateRow> = {}): IndustryAggregateRow {
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

test('industries page data excludes unused API fields from the serialized payload', () => {
	const result = buildIndustriesPageData({
		overview: { marketCap: 100, companyCount: 20, sectorCount: 2, revenueTTM: 50 },
		industries: [{ ...industry(), updatedAt: '2026-10-01', coverage: { revenue: 10 } }]
	})

	expect(result.overview).toEqual({ marketCap: 100, companyCount: 20, sectorCount: 2 })
	expect(Object.keys(result.industries[0]!).sort()).toEqual(
		[
			'companyCount',
			'dividendYield',
			'dollarVolume24h',
			'industry',
			'industrySlug',
			'marketCap',
			'priceChangePercentage1d',
			'priceChangePercentage1m',
			'priceChangePercentage1y',
			'priceChangePercentage3m',
			'priceChangePercentage6m',
			'priceChangePercentage7d',
			'priceChangePercentageYtd',
			'sector',
			'sectorSlug',
			'sectorWeight',
			'trailingPE',
			'updatedAt',
			'weight'
		].sort()
	)
})

function sector(overrides: Partial<SectorAggregateRow> = {}): SectorAggregateRow {
	return {
		sector: 'Technology',
		sectorSlug: 'technology',
		marketCap: 800,
		weight: 80,
		dollarVolume24h: 90,
		dollarVolumeShare24h: 90,
		revenueTTM: 60,
		companyCount: 30,
		priceChangePercentage1d: 1.5,
		priceChangePercentage7d: 2.5,
		priceChangePercentage1m: 3.5,
		priceChangePercentage3m: 4,
		priceChangePercentage6m: 5,
		priceChangePercentageYtd: 4.5,
		priceChangePercentage1y: 5.5,
		trailingPE: 25,
		...overrides
	}
}

describe('sector and industry row selection', () => {
	test('aggregate pages omit Unknown classifications', () => {
		const rows = [sector(), sector({ sector: 'Unknown', sectorSlug: 'unknown', weight: 0.1 })]
		expect(filterKnownAggregates(rows).map((row) => row.sectorSlug)).toEqual(['technology'])
		const industries = [
			industry(),
			industry({ industry: 'Unknown', industrySlug: 'unknown' }),
			industry({ industry: 'Unclassified sector', industrySlug: 'unclassified-sector', sectorSlug: 'unknown' })
		]
		expect(filterKnownAggregates(industries).map((row) => row.industrySlug)).toEqual(['software'])
	})
})

describe('sortNullableRows', () => {
	test('keeps null and non-finite values last for ascending and descending order', () => {
		const rows = [
			{ id: 'null', value: null },
			{ id: 'two', value: 2 },
			{ id: 'nan', value: Number.NaN },
			{ id: 'one', value: 1 }
		]
		expect(sortNullableRows(rows, 'value', 'asc').map((row) => row.id)).toEqual(['one', 'two', 'null', 'nan'])
		expect(sortNullableRows(rows, 'value', 'desc').map((row) => row.id)).toEqual(['two', 'one', 'null', 'nan'])
	})

	test('sorts text and derived values while preserving stable ties', () => {
		const rows = [
			{ id: 'bravo', first: 1, second: 2 },
			{ id: 'alpha', first: 1, second: 3 },
			{ id: 'charlie', first: null, second: 4 }
		]
		expect(sortNullableRows(rows, 'id', 'asc').map((row) => row.id)).toEqual(['alpha', 'bravo', 'charlie'])
		expect(
			sortRowsByValue(rows, (row) => (row.first === null ? null : row.first + row.second), 'desc').map((row) => row.id)
		).toEqual(['alpha', 'bravo', 'charlie'])
	})
})

describe('industry query selection', () => {
	test('preserves a valid selection and falls back to all for a stale slug', () => {
		expect(normalizeIndustrySelection('software', ['software', 'semiconductors'])).toBe('software')
		expect(normalizeIndustrySelection('old-industry', ['software', 'semiconductors'])).toBe('all')
	})
})

describe('sector treemap metric mapping', () => {
	test('switches value, share, and caption total together for market cap, volume, and revenue', () => {
		const rows = [
			sector(),
			sector({
				sector: 'Unknown',
				sectorSlug: 'unknown',
				marketCap: 20,
				weight: 2,
				dollarVolume24h: 10,
				dollarVolumeShare24h: 10,
				revenueTTM: 40
			})
		]
		const overview = { marketCap: 1000, dollarVolume24h: 100, revenueTTM: 200 }
		expect(buildSectorTreemapData(rows, 'marketCap', overview)).toMatchObject({
			total: 1000,
			rows: [
				{ value: 800, share: 80 },
				{ value: 20, share: 2 }
			]
		})
		expect(buildSectorTreemapData(rows, 'volume', overview)).toMatchObject({
			total: 100,
			rows: [
				{ value: 90, share: 90 },
				{ value: 10, share: 10 }
			]
		})
		expect(buildSectorTreemapData(rows, 'revenue', overview)).toMatchObject({
			total: 200,
			rows: [
				{ value: 60, share: 30 },
				{ value: 40, share: 20 }
			]
		})
	})
})

describe('industry summary and display transformations', () => {
	test('computes headline counts, top shares, best and worst, and dynamic 0.1% threshold', () => {
		const rows = [
			industry({ industry: 'Largest', marketCap: 600, weight: 60, companyCount: 12, priceChangePercentage1m: 4 }),
			industry({ industry: 'Small cap', marketCap: 20, weight: 0.05, companyCount: 2, priceChangePercentage1m: -2 }),
			industry({ industry: 'No return', marketCap: 10, weight: null, companyCount: 9, priceChangePercentage1m: null })
		]
		expect(buildIndustrySummary(rows, 1000)).toMatchObject({
			industryCount: 3,
			underTenCompaniesCount: 2,
			top10MarketShare: 60.05,
			top20MarketShare: 60.05,
			largestIndustry: { industry: 'Largest' },
			bestIndustry1m: { industry: 'Largest' },
			worstIndustry1m: { industry: 'Small cap' },
			underPointOnePercentCount: 1,
			underPointOnePercentMarketCapThreshold: 1
		})
	})

	test('hides industries below either tail threshold but leaves large two-company industries hidden too', () => {
		const rows = [
			industry({ industrySlug: 'large', marketCap: 50_000_000_000, companyCount: 12 }),
			industry({ industrySlug: 'small-cap', marketCap: 9_000_000_000, companyCount: 10 }),
			industry({ industrySlug: 'few-companies', marketCap: 100_000_000_000, companyCount: 2 })
		]
		const { visibleRows, hiddenRows } = filterIndustryTail(rows)
		expect(visibleRows.map((row) => row.industrySlug)).toEqual(['large'])
		expect(hiddenRows.map((row) => row.industrySlug)).toEqual(['small-cap', 'few-companies'])
		expect(filterIndustryTail(rows, { hideTail: false }).visibleRows).toHaveLength(3)
	})

	test('groups rows after the top twenty into one Other aggregate', () => {
		const rows = Array.from({ length: 22 }, (_, index) =>
			industry({
				industry: `Industry ${index + 1}`,
				industrySlug: `industry-${index + 1}`,
				marketCap: index < 20 ? 100 : 7,
				weight: index < 20 ? 1 : 0.05
			})
		)
		expect(getIndustryTreemapOther(rows)).toEqual({
			count: 2,
			marketCap: 14,
			weight: 0.1,
			underPointOnePercentCount: 2
		})
	})

	test('selects the first twelve industries with all seven served return periods', () => {
		const rows = Array.from({ length: 13 }, (_, index) =>
			industry({
				industry: `Industry ${index + 1}`,
				industrySlug: `industry-${index + 1}`,
				priceChangePercentage1d: index,
				priceChangePercentageYtd: index + 5
			})
		)
		const matrix = selectIndustryReturnMatrix(rows)
		expect(matrix).toHaveLength(12)
		expect(matrix[0]).toEqual({
			industry: 'Industry 1',
			industrySlug: 'industry-1',
			sectorSlug: 'technology',
			values: { '1d': 0, '7d': 2, '1m': 3, '3m': 4, '6m': 5, ytd: 5, '1y': 7 }
		})
	})
})

describe('aggregate and constituent metric calculations', () => {
	test('calculates net margin and preserves unavailable or zero-denominator values', () => {
		expect(calculateNetMargin(788, 2940)).toBeCloseTo(26.8027210884)
		expect(calculateNetMargin(-50, 200)).toBe(-25)
		expect(calculateNetMargin(null, 200)).toBeNull()
		expect(calculateNetMargin(50, 0)).toBeNull()
	})

	test('calculates constituent sector weight and share-count dollar volume', () => {
		expect(calculateConstituentSectorWeight(5_000_000_000, 25_000_000_000)).toBe(20)
		expect(calculateConstituentSectorWeight(null, 25_000_000_000)).toBeNull()
		expect(calculateCompanyDollarVolume(65_246_700, 225)).toBe(14_680_507_500)
		expect(calculateCompanyDollarVolume(65_246_700, null)).toBeNull()
	})
})
