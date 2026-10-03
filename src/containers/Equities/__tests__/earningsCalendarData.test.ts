import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected, readSelectionFromQuery } from '~/components/Select/query'
import {
	addCalendarDays,
	buildEarningsCalendarBootstrap,
	buildEarningsCalendarSummary,
	buildEarningsCalendarWeek,
	buildEarningsCalendarWeekExposure,
	buildSecFilingUrl,
	cleanEarningsCompanyName,
	getEarningsCalendarDisplayDate,
	getEarningsCalendarStatus,
	getEarningsMarketCapTier,
	isValidEarningsCalendarEvent,
	joinEarningsCalendarRows,
	mondayOfCalendarWeek,
	searchEarningsCalendarCompanies,
	type EarningsMarketCapOption
} from '../earningsCalendarData'
import { makeCompany, makeEvent, makeRow } from './calendarFixture'

describe('earnings calendar date arithmetic', () => {
	test('adds days across month and leap-day boundaries', () => {
		expect(addCalendarDays('2024-02-28', 2)).toBe('2024-03-01')
		expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01')
	})

	test('finds the Monday containing a calendar date', () => {
		expect(mondayOfCalendarWeek('2026-10-25')).toBe('2026-10-19')
		expect(mondayOfCalendarWeek('2026-10-26')).toBe('2026-10-26')
	})

	test('rejects invalid machine dates', () => {
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
				sectorSlugs: ['technology'],
				marketCapTiers: ['mega'],
				tightWindowsOnly: true
			}).rows.map((row) => row.ticker)
		).toEqual(['A'])
		expect(
			buildEarningsCalendarWeek(rows, '2026-10-27', { tightWindowsOnly: true }).rows.map((row) => row.ticker)
		).toEqual(['A', 'C'])
	})

	test('a company without a market cap shows under the Unknown tier', () => {
		const rows = [makeRow({ ticker: 'A', marketCap: 250_000_000_000 }), makeRow({ ticker: 'C', marketCap: null })]

		expect(
			buildEarningsCalendarWeek(rows, '2026-10-27', { marketCapTiers: ['unknown'] }).rows.map((row) => row.ticker)
		).toEqual(['C'])
	})
})

describe('earnings calendar week selection', () => {
	test('a shared future week shows available current-week events while the full calendar is unavailable', () => {
		const bootstrapRows = [makeRow({ ticker: 'CURRENT', report_date: '2026-10-02' })]
		const displayDate = getEarningsCalendarDisplayDate('2026-10-05', '2026-10-03', false)

		expect(buildEarningsCalendarWeek(bootstrapRows, displayDate).rows.map((row) => row.ticker)).toEqual(['CURRENT'])
	})

	test('a shared future week becomes visible when the full calendar is available', () => {
		const rows = [makeRow({ ticker: 'FUTURE', report_date: '2026-10-05' })]
		const displayDate = getEarningsCalendarDisplayDate('2026-10-05', '2026-10-03', true)

		expect(buildEarningsCalendarWeek(rows, displayDate).rows.map((row) => row.ticker)).toEqual(['FUTURE'])
		expect(getEarningsCalendarDisplayDate('2026-02-30', '2026-10-03', true)).toBe('2026-10-03')
	})

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
			buildEarningsCalendarSummary(
				[makeEvent({ report_date: '2026-10-28' }), makeEvent({ report_date: '2026-11-03' })],
				'2026-10-27'
			).bounds
		).toEqual({
			first: '2026-10-26',
			last: '2026-11-02'
		})
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
				{ key: 'healthcare', name: 'Healthcare' },
				{ key: 'technology', name: 'Technology' },
				{ key: 'unknown', name: 'Unknown' }
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
		expect(buildEarningsCalendarSummary(rows, '2026-10-02').monthBuckets).toEqual([
			{ month: '2026-10', count: 2 },
			{ month: '2026-11', count: 2 }
		])
	})

	test('counts the 31 completed calendar dates named by the recent bucket', () => {
		const events = [
			makeEvent({ ticker: 'BOUNDARY', report_date: '2026-09-01' }),
			makeEvent({ ticker: 'INSIDE', report_date: '2026-09-02' }),
			makeEvent({ ticker: 'TODAY', report_date: '2026-10-02' })
		]

		expect(buildEarningsCalendarSummary(events, '2026-10-02').pastCount).toBe(2)
	})

	test('summarizes weekly reporting market cap and filing-backed dates by company', () => {
		const rows = [
			makeRow({ ticker: 'AAPL', report_date: '2026-10-27', marketCap: 3_000_000_000_000 }),
			makeRow({ ticker: 'AAPL', event_key: 'duplicate', report_date: '2026-10-28', marketCap: 3_000_000_000_000 }),
			makeRow({ ticker: 'MSFT', report_date: '2026-10-28', marketCap: 2_500_000_000_000 }),
			makeRow({ ticker: 'SMALL', report_date: '2026-10-30', marketCap: 500_000_000, cik: '', accession_number: '' }),
			makeRow({ ticker: 'LATER', report_date: '2026-11-02', marketCap: 50_000_000_000 })
		]
		const exposure = buildEarningsCalendarWeekExposure(rows, '2026-10-26', '2026-10-26')
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
			projectedCount: exposure.projectedCount,
			pastDueCount: exposure.pastDueCount
		}).toEqual({
			marketCap: 5_500_500_000_000,
			companyCount: 3,
			secConfirmedCount: 2,
			projectedCount: 1,
			pastDueCount: 0
		})
	})

	test('does not label an overdue earnings date as projected', () => {
		const rows = [
			makeRow({ ticker: 'LATE', report_date: '2026-10-26', date_status: 'estimated', cik: '', accession_number: '' }),
			makeRow({ ticker: 'NEXT', report_date: '2026-10-30', date_status: 'estimated', cik: '', accession_number: '' })
		]

		const exposure = buildEarningsCalendarWeekExposure(rows, '2026-10-26', '2026-10-28')

		expect({ projectedCount: exposure.projectedCount, pastDueCount: exposure.pastDueCount }).toEqual({
			projectedCount: 1,
			pastDueCount: 1
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
			kind: 'match',
			company: { ticker: 'AAPL', nextEvent: { report_date: '2026-11-10' } },
			query: 'aap'
		})
		expect(searchEarningsCalendarCompanies('SPCX', companies, rows, '2026-10-30')).toEqual({
			kind: 'no-dates',
			company: companies[1],
			query: 'SPCX'
		})
		expect(searchEarningsCalendarCompanies('nobody', companies, rows, '2026-10-30')).toEqual({
			kind: 'no-results',
			query: 'nobody'
		})
	})
})

describe('earnings calendar display helpers', () => {
	test('builds SEC filing links only from valid identifiers', () => {
		expect(buildSecFilingUrl('320193', '0000320193-26-000123')).toBe(
			'https://www.sec.gov/Archives/edgar/data/320193/000032019326000123/0000320193-26-000123-index.htm'
		)
		expect(buildSecFilingUrl('bad', '0000320193-26-000123')).toBeNull()
	})

	test('removes vendor stock suffixes from company names', () => {
		expect(cleanEarningsCompanyName('Visa Inc. Class A Common Stock')).toBe('Visa Inc.')
		expect(cleanEarningsCompanyName('Microsoft Corporation Common Stock')).toBe('Microsoft Corporation')
	})
})

describe('calendar filters in the URL', () => {
	const tiers: Array<EarningsMarketCapOption> = ['mega', 'large', 'mid', 'small', 'micro', 'unknown']
	const sectors = ['healthcare', 'technology', 'unknown']
	const rows = [
		makeRow({ ticker: 'MEGA', marketCap: 300_000_000_000, sectorSlug: 'technology' }),
		makeRow({ ticker: 'HLTH', marketCap: 50_000_000_000, sectorSlug: 'healthcare' }),
		makeRow({ ticker: 'NOCAP', marketCap: null, sectorSlug: 'unknown' })
	]
	const tickersAfter = (updates: Record<string, string | Array<string> | undefined>) =>
		buildEarningsCalendarWeek(rows, '2026-10-27', {
			marketCapTiers: readSelectionFromQuery(updates, 'marketCap', 'excludeMarketCap', tiers),
			sectorSlugs: readSelectionFromQuery(updates, 'sector', 'excludeSector', sectors)
		}).rows.map((row) => row.ticker)

	test('picking Mega and Unknown keeps the company without a market cap', () => {
		expect(
			tickersAfter(getQueryUpdatesFromSelected('marketCap', 'excludeMarketCap', tiers, ['mega', 'unknown']))
		).toEqual(['MEGA', 'NOCAP'])
	})

	test('leaving one sector out keeps every other sector, Unknown included', () => {
		expect(
			tickersAfter(getQueryUpdatesFromSelected('sector', 'excludeSector', sectors, ['healthcare', 'unknown']))
		).toEqual(['HLTH', 'NOCAP'])
	})
})
