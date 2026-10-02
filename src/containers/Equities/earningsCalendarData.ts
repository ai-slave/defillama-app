import type { IEquitiesEarningsCalendarApiItem } from './api.types'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { IEquitiesCalendarCompany, IEquitiesCalendarRow } from './types'

export type EarningsCalendarStatus = 'reported' | 'projected' | 'pastDue'
export type EarningsMarketCapTier = 'mega' | 'large' | 'mid' | 'small' | 'micro'

export type IEarningsCalendarEvent = IEquitiesEarningsCalendarApiItem
export type IEarningsCalendarCompany = IEquitiesCalendarCompany
export type IEarningsCalendarRow = IEquitiesCalendarRow

interface IEarningsCalendarFilters {
	marketCapTiers?: ReadonlyArray<EarningsMarketCapTier>
	sectorSlug?: string | null
	tightWindowsOnly?: boolean
}

interface IEarningsCalendarDay {
	date: string
	weekday: number
	rows: Array<IEarningsCalendarRow>
	cards: Array<IEarningsCalendarRow>
	remainingCount: number
}

interface IEarningsCalendarWeek {
	monday: string
	friday: string
	rows: Array<IEarningsCalendarRow>
	cards: Array<IEarningsCalendarRow>
	days: Array<IEarningsCalendarDay>
	companyCount: number
}

interface IEarningsCalendarMonthBucket {
	month: string
	count: number
}

export interface IEarningsCalendarBootstrap {
	rows: Array<IEarningsCalendarRow>
	monthBuckets: Array<IEarningsCalendarMonthBucket>
	pastCount: number
	firstReportByMonth: Record<string, string>
	bounds: { first: string | null; last: string | null }
	uniqueCompanyCount: number
	sectorOptions: Array<{ key: string; name: string }>
}

interface IEarningsCalendarSearchCompany extends IEarningsCalendarCompany {
	nextEvent: IEarningsCalendarRow | null
}

export type EarningsCalendarSearchResult =
	| { kind: 'matches'; companies: Array<IEarningsCalendarSearchCompany> }
	| { kind: 'no-dates'; companies: Array<IEarningsCalendarCompany> }
	| { kind: 'no-results'; companies: [] }

const WEEKDAYS = 5

function parseIsoDateParts(value: string): [number, number, number] {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) throw new RangeError(`Invalid calendar date: ${value}`)
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const date = new Date(0)
	date.setUTCHours(0, 0, 0, 0)
	date.setUTCFullYear(year, month - 1, day)
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		throw new RangeError(`Invalid calendar date: ${value}`)
	}
	return [year, month, day]
}

function dateFromParts(year: number, month: number, day: number): string {
	const date = new Date(0)
	date.setUTCHours(0, 0, 0, 0)
	date.setUTCFullYear(year, month - 1, day)
	return date.toISOString().slice(0, 10)
}

function isIsoCalendarDate(value: string): boolean {
	try {
		parseIsoDateParts(value)
		return true
	} catch {
		return false
	}
}

export function isValidEarningsCalendarEvent(value: unknown): value is IEarningsCalendarEvent {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
	const row = value as Record<string, unknown>
	return (
		typeof row.ticker === 'string' &&
		row.ticker.length > 0 &&
		typeof row.event_key === 'string' &&
		row.event_key.length > 0 &&
		typeof row.report_date === 'string' &&
		isIsoCalendarDate(row.report_date) &&
		(row.date_status === 'reported' ||
			row.date_status === 'inferred' ||
			row.date_status === 'estimated' ||
			row.date_status === 'confirmed') &&
		(row.report_time === 'bmo' ||
			row.report_time === 'amc' ||
			row.report_time === 'dmt' ||
			row.report_time === 'unknown') &&
		(row.max_drift_days === null ||
			(typeof row.max_drift_days === 'number' && Number.isInteger(row.max_drift_days) && row.max_drift_days >= 0)) &&
		typeof row.fiscal_year === 'number' &&
		Number.isInteger(row.fiscal_year) &&
		typeof row.fiscal_period === 'string' &&
		row.fiscal_period.length > 0 &&
		typeof row.cik === 'string' &&
		typeof row.accession_number === 'string'
	)
}

export function addCalendarDays(date: string, days: number): string {
	const [year, month, day] = parseIsoDateParts(date)
	if (!Number.isInteger(days)) throw new RangeError(`Invalid day offset: ${days}`)
	return dateFromParts(year, month, day + days)
}

/** Sunday is 0 and Saturday is 6, matching UTC weekday numbering. */
function calendarWeekday(date: string): number {
	const [year, month, day] = parseIsoDateParts(date)
	const utcDate = new Date(0)
	utcDate.setUTCHours(0, 0, 0, 0)
	utcDate.setUTCFullYear(year, month - 1, day)
	return utcDate.getUTCDay()
}

export function mondayOfCalendarWeek(date: string): string {
	const weekday = calendarWeekday(date)
	return addCalendarDays(date, -((weekday + 6) % 7))
}

export function getEarningsCalendarStatus(row: IEarningsCalendarEvent, todayET: string): EarningsCalendarStatus {
	parseIsoDateParts(todayET)
	if (row.date_status === 'reported' || row.date_status === 'inferred') return 'reported'
	return row.report_date < todayET ? 'pastDue' : 'projected'
}

export function getEarningsMarketCapTier(marketCap: number | null): EarningsMarketCapTier | null {
	if (marketCap === null || !Number.isFinite(marketCap) || marketCap < 0) return null
	if (marketCap >= 200_000_000_000) return 'mega'
	if (marketCap >= 10_000_000_000) return 'large'
	if (marketCap >= 2_000_000_000) return 'mid'
	if (marketCap >= 300_000_000) return 'small'
	return 'micro'
}

export function joinEarningsCalendarRows(
	events: ReadonlyArray<IEarningsCalendarEvent>,
	companies: ReadonlyArray<IEarningsCalendarCompany>
): Array<IEarningsCalendarRow> {
	const companyByTicker = new Map(companies.map((company) => [company.ticker.toUpperCase(), company]))
	return events.map((event) => {
		const company = companyByTicker.get(event.ticker.toUpperCase())
		return {
			...event,
			name: company?.name ?? event.ticker,
			marketCap: company?.marketCap ?? null,
			sector: company?.sector || 'Unknown',
			sectorSlug: company?.sectorSlug || 'unknown',
			country: company?.country ?? 'US',
			href: company?.country ? `/equities/${buildEquityTickerCountrySlug(company.ticker, company.country)}` : null
		}
	})
}

function matchesEarningsCalendarFilters(
	row: IEarningsCalendarRow,
	filters: IEarningsCalendarFilters,
	allowedTiers: ReadonlySet<EarningsMarketCapTier> | null
): boolean {
	if (filters.sectorSlug && row.sectorSlug !== filters.sectorSlug) return false
	if (allowedTiers && (row.marketCap === null || !allowedTiers.has(getEarningsMarketCapTier(row.marketCap)!)))
		return false
	if (filters.tightWindowsOnly && row.max_drift_days !== null && row.max_drift_days > 7) return false
	return true
}

function compareMarketCapDescending(a: IEarningsCalendarRow, b: IEarningsCalendarRow): number {
	return (
		(b.marketCap ?? -1) - (a.marketCap ?? -1) ||
		a.ticker.localeCompare(b.ticker) ||
		a.event_key.localeCompare(b.event_key)
	)
}

export function buildEarningsCalendarWeek(
	rows: ReadonlyArray<IEarningsCalendarRow>,
	selectedDate: string,
	filters: IEarningsCalendarFilters = {},
	cardLimit = 12
): IEarningsCalendarWeek {
	if (!Number.isInteger(cardLimit) || cardLimit < 0) throw new RangeError(`Invalid card limit: ${cardLimit}`)
	const monday = mondayOfCalendarWeek(selectedDate)
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const allowedTiers = filters.marketCapTiers ? new Set(filters.marketCapTiers) : null
	const weekRows: Array<IEarningsCalendarRow> = []
	for (const row of rows) {
		if (
			row.report_date >= monday &&
			row.report_date <= friday &&
			matchesEarningsCalendarFilters(row, filters, allowedTiers)
		) {
			weekRows.push(row)
		}
	}
	weekRows.sort((a, b) => a.report_date.localeCompare(b.report_date) || compareMarketCapDescending(a, b))
	const cards = weekRows.slice().sort(compareMarketCapDescending).slice(0, cardLimit)
	const cardsByDate = new Map<string, Array<IEarningsCalendarRow>>()
	for (const row of cards) {
		const dateCards = cardsByDate.get(row.report_date) ?? []
		dateCards.push(row)
		cardsByDate.set(row.report_date, dateCards)
	}
	const days = Array.from({ length: WEEKDAYS }, (_, index) => {
		const date = addCalendarDays(monday, index)
		const dayRows = weekRows.filter((row) => row.report_date === date)
		const dayCards = cardsByDate.get(date) ?? []
		return {
			date,
			weekday: calendarWeekday(date),
			rows: dayRows,
			cards: dayCards,
			remainingCount: dayRows.length - dayCards.length
		}
	})
	return {
		monday,
		friday,
		rows: weekRows,
		cards,
		days,
		companyCount: new Set(weekRows.map((row) => row.ticker)).size
	}
}

export function buildEarningsCalendarMonthBuckets(
	rows: ReadonlyArray<IEarningsCalendarEvent>,
	todayET: string
): Array<IEarningsCalendarMonthBucket> {
	parseIsoDateParts(todayET)
	const counts = new Map<string, number>()
	for (const row of rows) {
		if (row.report_date < todayET) continue
		const month = row.report_date.slice(0, 7)
		counts.set(month, (counts.get(month) ?? 0) + 1)
	}
	return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }))
}

export function getEarningsCalendarWeekBounds(rows: ReadonlyArray<IEarningsCalendarEvent>): {
	first: string | null
	last: string | null
} {
	if (rows.length === 0) return { first: null, last: null }
	let first = rows[0]!.report_date
	let last = first
	for (let index = 1; index < rows.length; index++) {
		const date = rows[index]!.report_date
		if (date < first) first = date
		if (date > last) last = date
	}
	return { first: mondayOfCalendarWeek(first), last: mondayOfCalendarWeek(last) }
}

export function buildEarningsCalendarWeekExposure(rows: ReadonlyArray<IEarningsCalendarRow>, monday: string) {
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const rowByTicker = new Map<string, IEarningsCalendarRow>()
	for (const row of rows) {
		if (row.report_date < monday || row.report_date > friday) continue
		const current = rowByTicker.get(row.ticker)
		if (
			current === undefined ||
			row.report_date < current.report_date ||
			(row.report_date === current.report_date && row.event_key < current.event_key)
		) {
			rowByTicker.set(row.ticker, row)
		}
	}
	const companyRows = [...rowByTicker.values()]
	const days = Array.from({ length: WEEKDAYS }, (_, index) => {
		const date = addCalendarDays(monday, index)
		const dayRows = companyRows.filter((row) => row.report_date === date).sort(compareMarketCapDescending)
		return {
			date,
			rows: dayRows,
			companyCount: dayRows.length,
			marketCap: dayRows.reduce((total, row) => total + (row.marketCap ?? 0), 0)
		}
	})
	const secConfirmedCount = companyRows.filter((row) => buildSecFilingUrl(row.cik, row.accession_number)).length
	return {
		days,
		companyCount: companyRows.length,
		marketCap: days.reduce((total, day) => total + day.marketCap, 0),
		secConfirmedCount,
		projectedCount: companyRows.length - secConfirmedCount
	}
}

/** Small server-rendered view model; the complete calendar continues loading in the background. */
export function buildEarningsCalendarBootstrap(
	events: ReadonlyArray<IEarningsCalendarEvent>,
	companies: ReadonlyArray<IEarningsCalendarCompany>,
	todayET: string
): IEarningsCalendarBootstrap {
	const monday = mondayOfCalendarWeek(todayET)
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const currentWeekEvents: Array<IEarningsCalendarEvent> = []
	const monthCounts = new Map<string, number>()
	const firstReportByMonth: Record<string, string> = {}
	const uniqueTickers = new Set<string>()
	let firstReport: string | null = null
	let lastReport: string | null = null
	let pastCount = 0
	for (const event of events) {
		uniqueTickers.add(event.ticker)
		if (firstReport === null || event.report_date < firstReport) firstReport = event.report_date
		if (lastReport === null || event.report_date > lastReport) lastReport = event.report_date
		if (event.report_date >= monday && event.report_date <= friday) currentWeekEvents.push(event)
		if (event.report_date < todayET) {
			pastCount++
			continue
		}
		const month = event.report_date.slice(0, 7)
		monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
		const firstMonthlyReport = firstReportByMonth[month]
		if (firstMonthlyReport === undefined || event.report_date < firstMonthlyReport) {
			firstReportByMonth[month] = event.report_date
		}
	}
	return {
		rows: buildEarningsCalendarWeek(joinEarningsCalendarRows(currentWeekEvents, companies), todayET, {}, 0).rows,
		monthBuckets: [...monthCounts].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
		pastCount,
		firstReportByMonth,
		bounds: {
			first: firstReport === null ? null : mondayOfCalendarWeek(firstReport),
			last: lastReport === null ? null : mondayOfCalendarWeek(lastReport)
		},
		uniqueCompanyCount: uniqueTickers.size,
		sectorOptions: buildEarningsCalendarSectorOptions(companies)
	}
}

export function buildEarningsCalendarSectorOptions(
	companies: ReadonlyArray<IEarningsCalendarCompany>
): Array<{ key: string; name: string }> {
	const sectors = new Map<string, string>()
	for (const company of companies) sectors.set(company.sectorSlug || 'unknown', company.sector || 'Unknown')
	return [
		{ key: 'all', name: 'All sectors' },
		...[...sectors]
			.filter(([key]) => key !== 'unknown')
			.sort((a, b) => a[1].localeCompare(b[1]))
			.map(([key, name]) => ({ key, name }))
	]
}

export function searchEarningsCalendarCompanies(
	query: string,
	companies: ReadonlyArray<IEarningsCalendarCompany>,
	rows: ReadonlyArray<IEarningsCalendarRow>,
	todayET: string
): EarningsCalendarSearchResult {
	parseIsoDateParts(todayET)
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return { kind: 'no-results', companies: [] }
	const matches = companies.filter(
		(company) =>
			company.ticker.toLowerCase().startsWith(normalizedQuery) || company.name.toLowerCase().includes(normalizedQuery)
	)
	if (matches.length === 0) return { kind: 'no-results', companies: [] }
	const rowsByTicker = new Map<string, Array<IEarningsCalendarRow>>()
	for (const row of rows) {
		const tickerRows = rowsByTicker.get(row.ticker) ?? []
		tickerRows.push(row)
		rowsByTicker.set(row.ticker, tickerRows)
	}
	const withNextEvent = matches.map((company) => {
		const nextEvent = (rowsByTicker.get(company.ticker) ?? [])
			.filter((row) => row.report_date >= todayET)
			.sort((a, b) => a.report_date.localeCompare(b.report_date) || a.event_key.localeCompare(b.event_key))[0]
		return { ...company, nextEvent: nextEvent ?? null }
	})
	const companiesWithDates = withNextEvent.filter((company) => company.nextEvent !== null)
	if (companiesWithDates.length > 0) {
		companiesWithDates.sort((a, b) => {
			const tickerMatch =
				Number(b.ticker.toLowerCase().startsWith(normalizedQuery)) -
				Number(a.ticker.toLowerCase().startsWith(normalizedQuery))
			return (
				tickerMatch ||
				a.nextEvent!.report_date.localeCompare(b.nextEvent!.report_date) ||
				(b.marketCap ?? -1) - (a.marketCap ?? -1)
			)
		})
		return { kind: 'matches', companies: companiesWithDates }
	}
	return { kind: 'no-dates', companies: matches }
}

export function buildSecFilingUrl(cik: string, accessionNumber: string): string | null {
	if (!/^\d+$/.test(cik) || !/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber)) return null
	const accessionPath = accessionNumber.replaceAll('-', '')
	return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionPath}/${accessionNumber}-index.htm`
}

export function cleanEarningsCompanyName(name: string): string {
	return name.replace(/\s+(Class [A-Z]\s+)?Common Stock$/i, '').trim()
}
