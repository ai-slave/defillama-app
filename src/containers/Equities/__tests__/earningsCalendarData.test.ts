import { describe, expect, test } from 'vitest'
import {
	addCalendarDays,
	buildEarningsCalendarBootstrap,
	buildEarningsCalendarMonthBuckets,
	buildEarningsCalendarWeek,
	buildEarningsCalendarWeekExposure,
	buildSecFilingUrl,
	cleanEarningsCompanyName,
	getEarningsCalendarStatus,
	getEarningsCalendarWeekBounds,
	getEarningsMarketCapTier,
	isValidEarningsCalendarEvent,
	joinEarningsCalendarRows,
	mondayOfCalendarWeek,
	searchEarningsCalendarCompanies,
	type IEarningsCalendarCompany,
	type IEarningsCalendarEvent,
	type IEarningsCalendarRow
} from '../earningsCalendarData'

function makeEvent(overrides: Partial<IEarningsCalendarEvent> = {}): IEarningsCalendarEvent {
	return {
		ticker: 'TEST',
		date_status: 'estimated',
		report_date: '2026-10-27',
		report_time: 'unknown',
		max_drift_days: 7,
		fiscal_year: 2026,
		fiscal_period: 'Q3',
		event_key: '2026-Q3',
		cik: '123456',
		accession_number: '0000123456-26-123456',
		...overrides
	}
}

function makeCompany(overrides: Partial<IEarningsCalendarCompany> = {}): IEarningsCalendarCompany {
	return {
		ticker: 'TEST',
		name: 'Test Corporation',
		marketCap: 1_000_000_000,
		sector: 'Technology',
		sectorSlug: 'technology',
		country: 'US',
		...overrides
	}
}

function makeRow(overrides: Partial<IEarningsCalendarRow> = {}): IEarningsCalendarRow {
	return {
		...makeEvent(),
		name: 'Test Corporation',
		marketCap: 1_000_000_000,
		sector: 'Technology',
		sectorSlug: 'technology',
		country: 'US',
		href: '/equities/TEST:US',
		...overrides
	}
}

describe('earnings calendar date arithmetic', () => {
	test('uses strict calendar parts across leap day and Monday week boundaries', () => {
		expect(addCalendarDays('2024-02-28', 2)).toBe('2024-03-01')
		expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01')
		expect(mondayOfCalendarWeek('2026-10-25')).toBe('2026-10-19')
		expect(mondayOfCalendarWeek('2026-10-26')).toBe('2026-10-26')
		expect(() => addCalendarDays('2026-02-30', 1)).toThrow(RangeError)
		expect(() => addCalendarDays('2026-10-01T00:00:00Z', 1)).toThrow(RangeError)
	})

	test('classifies filing-backed dates as reported and old estimates as past due', () => {
		expect(getEarningsCalendarStatus(makeEvent({ date_status: 'reported' }), '2026-10-27')).toBe('reported')
		expect(
			getEarningsCalendarStatus(makeEvent({ date_status: 'inferred', report_date: '2026-10-20' }), '2026-10-27')
		).toBe('reported')
		expect(getEarningsCalendarStatus(makeEvent({ report_date: '2026-10-26' }), '2026-10-27')).toBe('pastDue')
		expect(getEarningsCalendarStatus(makeEvent({ report_date: '2026-10-27' }), '2026-10-27')).toBe('projected')
	})

	test('rejects malformed upstream events before they can break calendar rendering', () => {
		expect(isValidEarningsCalendarEvent(makeEvent())).toBe(true)
		expect(isValidEarningsCalendarEvent(makeEvent({ report_date: '2026-02-30' }))).toBe(false)
		expect(isValidEarningsCalendarEvent({ ...makeEvent(), date_status: 'announced' })).toBe(false)
		expect(isValidEarningsCalendarEvent({ ...makeEvent(), max_drift_days: -1 })).toBe(false)
	})
})

describe('earnings calendar rows and filters', () => {
	test('joins company details by ticker and preserves unmatched events under Unknown', () => {
		const rows = joinEarningsCalendarRows(
			[makeEvent({ ticker: 'AAPL' }), makeEvent({ ticker: 'ANSC' })],
			[makeCompany({ ticker: 'AAPL', name: 'Apple Inc.', marketCap: 3_000_000_000_000 })]
		)
		expect(rows.map(({ ticker, name, marketCap, sectorSlug }) => [ticker, name, marketCap, sectorSlug])).toEqual([
			['AAPL', 'Apple Inc.', 3_000_000_000_000, 'technology'],
			['ANSC', 'ANSC', null, 'unknown']
		])
	})

	test('assigns market-cap thresholds and applies sector, cap and tight-window filters', () => {
		expect([
			getEarningsMarketCapTier(200_000_000_000),
			getEarningsMarketCapTier(10_000_000_000),
			getEarningsMarketCapTier(2_000_000_000),
			getEarningsMarketCapTier(300_000_000),
			getEarningsMarketCapTier(299_999_999),
			getEarningsMarketCapTier(null)
		]).toEqual(['mega', 'large', 'mid', 'small', 'micro', null])
		const rows = [
			makeRow({ ticker: 'A', sectorSlug: 'technology', marketCap: 250_000_000_000, max_drift_days: null }),
			makeRow({ ticker: 'B', sectorSlug: 'healthcare', marketCap: 50_000_000_000, max_drift_days: 14 }),
			makeRow({ ticker: 'C', sectorSlug: 'technology', marketCap: null, max_drift_days: 7 })
		]
		expect(
			buildEarningsCalendarWeek(rows, '2026-10-27', {
				sectorSlug: 'technology',
				marketCapTiers: ['mega'],
				tightWindowsOnly: true
			}).rows.map((row) => row.ticker)
		).toEqual(['A'])
		expect(
			buildEarningsCalendarWeek(rows, '2026-10-27', { tightWindowsOnly: true }).rows.map((row) => row.ticker)
		).toEqual(['A', 'C'])
	})
})

describe('earnings calendar week selection', () => {
	test('ranks one global top twelve across Monday to Friday and reports partial week bounds', () => {
		const rows = Array.from({ length: 14 }, (_, index) =>
			makeRow({
				ticker: `T${index + 1}`,
				event_key: `2026-Q${index + 1}`,
				report_date: index < 2 ? '2026-10-26' : index < 7 ? '2026-10-27' : '2026-10-30',
				marketCap: (14 - index) * 1_000_000_000
			})
		)
		const week = buildEarningsCalendarWeek(rows, '2026-10-29')
		expect([week.monday, week.friday, week.rows.length, week.companyCount]).toEqual([
			'2026-10-26',
			'2026-10-30',
			14,
			14
		])
		expect(week.cards.map((row) => row.ticker)).toEqual([
			'T1',
			'T2',
			'T3',
			'T4',
			'T5',
			'T6',
			'T7',
			'T8',
			'T9',
			'T10',
			'T11',
			'T12'
		])
		expect(week.days.map((day) => [day.date, day.rows.length, day.cards.length, day.remainingCount])).toEqual([
			['2026-10-26', 2, 2, 0],
			['2026-10-27', 5, 5, 0],
			['2026-10-28', 0, 0, 0],
			['2026-10-29', 0, 0, 0],
			['2026-10-30', 7, 5, 2]
		])
		expect(
			getEarningsCalendarWeekBounds([
				makeEvent({ report_date: '2026-10-28' }),
				makeEvent({ report_date: '2026-11-03' })
			])
		).toEqual({
			first: '2026-10-26',
			last: '2026-11-02'
		})
		expect(getEarningsCalendarWeekBounds([])).toEqual({ first: null, last: null })
	})
})

describe('earnings calendar buckets and company search', () => {
	test('builds a compact current-week bootstrap with whole-window navigation data', () => {
		const events = [
			makeEvent({ ticker: 'OLD', report_date: '2026-10-20', event_key: 'old' }),
			makeEvent({ ticker: 'AAPL', report_date: '2026-10-27', event_key: 'apple' }),
			makeEvent({ ticker: 'MSFT', report_date: '2026-10-30', event_key: 'microsoft' }),
			makeEvent({ ticker: 'NEXT', report_date: '2026-11-02', event_key: 'next' })
		]
		const companies = [
			makeCompany({ ticker: 'OLD', sector: 'Unknown', sectorSlug: 'unknown' }),
			makeCompany({ ticker: 'AAPL', name: 'Apple Inc.', marketCap: 3_000_000_000_000 }),
			makeCompany({ ticker: 'MSFT', name: 'Microsoft Corp.', marketCap: 2_500_000_000_000 }),
			makeCompany({ ticker: 'NEXT', sector: 'Healthcare', sectorSlug: 'healthcare' })
		]

		const bootstrap = buildEarningsCalendarBootstrap(events, companies, '2026-10-27')

		expect(bootstrap.rows.map((row) => row.ticker)).toEqual(['AAPL', 'MSFT'])
		expect(bootstrap.monthBuckets).toEqual([
			{ month: '2026-10', count: 2 },
			{ month: '2026-11', count: 1 }
		])
		expect({
			pastCount: bootstrap.pastCount,
			firstReportByMonth: bootstrap.firstReportByMonth,
			bounds: bootstrap.bounds,
			uniqueCompanyCount: bootstrap.uniqueCompanyCount,
			sectorOptions: bootstrap.sectorOptions
		}).toEqual({
			pastCount: 1,
			firstReportByMonth: { '2026-10': '2026-10-27', '2026-11': '2026-11-02' },
			bounds: { first: '2026-10-19', last: '2026-11-02' },
			uniqueCompanyCount: 4,
			sectorOptions: [
				{ key: 'all', name: 'All sectors' },
				{ key: 'healthcare', name: 'Healthcare' },
				{ key: 'technology', name: 'Technology' }
			]
		})
	})

	test('buckets future months', () => {
		const rows = [
			makeEvent({ report_date: '2026-10-02' }),
			makeEvent({ report_date: '2026-10-03' }),
			makeEvent({ report_date: '2026-11-01' }),
			makeEvent({ report_date: '2026-11-02' })
		]
		expect(buildEarningsCalendarMonthBuckets(rows, '2026-10-02')).toEqual([
			{ month: '2026-10', count: 2 },
			{ month: '2026-11', count: 2 }
		])
	})

	test('summarizes weekly reporting market cap and filing-backed dates by company', () => {
		const rows = [
			makeRow({ ticker: 'AAPL', report_date: '2026-10-27', marketCap: 3_000_000_000_000 }),
			makeRow({ ticker: 'AAPL', event_key: 'duplicate', report_date: '2026-10-28', marketCap: 3_000_000_000_000 }),
			makeRow({ ticker: 'MSFT', report_date: '2026-10-28', marketCap: 2_500_000_000_000 }),
			makeRow({ ticker: 'SMALL', report_date: '2026-10-30', marketCap: 500_000_000, cik: '', accession_number: '' }),
			makeRow({ ticker: 'LATER', report_date: '2026-11-02', marketCap: 50_000_000_000 })
		]
		const exposure = buildEarningsCalendarWeekExposure(rows, '2026-10-26')
		expect(exposure.days.map((day) => [day.date, day.marketCap, day.companyCount])).toEqual([
			['2026-10-26', 0, 0],
			['2026-10-27', 3_000_000_000_000, 1],
			['2026-10-28', 2_500_000_000_000, 1],
			['2026-10-29', 0, 0],
			['2026-10-30', 500_000_000, 1]
		])
		expect(exposure.days.map((day) => day.rows.map((row) => row.ticker))).toEqual([
			[],
			['AAPL'],
			['MSFT'],
			[],
			['SMALL']
		])
		expect({
			marketCap: exposure.marketCap,
			companyCount: exposure.companyCount,
			secConfirmedCount: exposure.secConfirmedCount,
			projectedCount: exposure.projectedCount
		}).toEqual({
			marketCap: 5_500_500_000_000,
			companyCount: 3,
			secConfirmedCount: 2,
			projectedCount: 1
		})
	})

	test('returns each known company’s next event and distinguishes known companies without dates', () => {
		const companies = [
			makeCompany({ ticker: 'AAPL', name: 'Apple Inc.', marketCap: 3_000_000_000_000 }),
			makeCompany({ ticker: 'SPCX', name: 'SpaceX Holdings', marketCap: 1_960_000_000_000 })
		]
		const rows = [
			makeRow({ ticker: 'AAPL', name: 'Apple Inc.', report_date: '2026-10-29', marketCap: 3_000_000_000_000 }),
			makeRow({
				ticker: 'AAPL',
				name: 'Apple Inc.',
				event_key: '2026-Q4',
				report_date: '2026-11-10',
				marketCap: 3_000_000_000_000
			})
		]
		expect(searchEarningsCalendarCompanies('aap', companies, rows, '2026-10-30')).toMatchObject({
			kind: 'matches',
			companies: [{ ticker: 'AAPL', nextEvent: { report_date: '2026-11-10' } }]
		})
		expect(searchEarningsCalendarCompanies('SPCX', companies, rows, '2026-10-30')).toEqual({
			kind: 'no-dates',
			companies: [companies[1]]
		})
		expect(searchEarningsCalendarCompanies('nobody', companies, rows, '2026-10-30')).toEqual({
			kind: 'no-results',
			companies: []
		})
	})
})

describe('earnings calendar display helpers', () => {
	test('builds SEC filing links only from valid identifiers and removes vendor stock suffixes', () => {
		expect(buildSecFilingUrl('320193', '0000320193-26-000123')).toBe(
			'https://www.sec.gov/Archives/edgar/data/320193/000032019326000123/0000320193-26-000123-index.htm'
		)
		expect(buildSecFilingUrl('bad', '0000320193-26-000123')).toBeNull()
		expect(cleanEarningsCompanyName('Visa Inc. Class A Common Stock')).toBe('Visa Inc.')
		expect(cleanEarningsCompanyName('Microsoft Corporation Common Stock')).toBe('Microsoft Corporation')
	})
})
