import type { IEquitiesEarningsCalendarApiItem } from './api.types'
import type { EquitiesCalendarResponse } from './queries.client'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { IEquitiesCalendarCompany, IEquitiesCalendarRow } from './types'

/* The server sends a bootstrap seed (the current week and the summary) while the client loads the full calendar.
   Until the full calendar arrives:
   - URL-selected data (another week) renders only once the full dataset is available; the page shows the seed's
     actual period, never a false empty state (getEarningsCalendarDisplayDate).
   - The URL keeps the requested selection, so it takes effect when the full dataset arrives.
   - A failed request says what the page still shows ("only this week is shown and search is off"). */

export type EarningsCalendarStatus = 'reported' | 'projected' | 'pastDue'
export type EarningsMarketCapTier = 'mega' | 'large' | 'mid' | 'small' | 'micro'
/** Picker options for the market cap filter; rows without a market cap fall under `unknown`. */
export type EarningsMarketCapOption = EarningsMarketCapTier | 'unknown'

interface IEarningsCalendarFilters {
	/** The picked options; rows outside them are hidden. Omitted means every option. */
	marketCapTiers?: ReadonlyArray<EarningsMarketCapOption>
	sectorSlugs?: ReadonlyArray<string>
	tightWindowsOnly?: boolean
}

interface EarningsCalendarDay {
	date: string
	weekday: number
	rows: Array<IEquitiesCalendarRow>
	cards: Array<IEquitiesCalendarRow>
	remainingCount: number
}

interface EarningsCalendarWeek {
	monday: string
	friday: string
	rows: Array<IEquitiesCalendarRow>
	cards: Array<IEquitiesCalendarRow>
	days: Array<EarningsCalendarDay>
	companyCount: number
}

interface EarningsCalendarMonthBucket {
	month: string
	count: number
}

export interface IEarningsCalendarBootstrap {
	rows: Array<IEquitiesCalendarRow>
	monthBuckets: Array<EarningsCalendarMonthBucket>
	pastCount: number
	firstReportByMonth: Record<string, string>
	bounds: { first: string | null; last: string | null }
	uniqueCompanyCount: number
	sectorOptions: Array<{ key: string; name: string }>
}

/** The bootstrap with the page-level fields the route adds. */
export type EarningsCalendarBootstrapSeed = IEarningsCalendarBootstrap & {
	todayET: string
	updatedAt: string | null
	stale: boolean
}

/**
 * What the page renders, from the full calendar once it has loaded, else from the server's current-week
 * bootstrap. `companies` is null until the full calendar arrives, because search and navigation need every event.
 */
export function buildEarningsCalendarView(
	data: EquitiesCalendarResponse | undefined,
	bootstrap: EarningsCalendarBootstrapSeed
) {
	if (!data) {
		return {
			rows: bootstrap.rows,
			companies: null,
			sectorOptions: bootstrap.sectorOptions,
			summary: bootstrap,
			todayET: bootstrap.todayET,
			stale: bootstrap.stale,
			updatedAt: bootstrap.updatedAt
		}
	}
	return {
		rows: joinEarningsCalendarRows(data.rows, data.companies),
		companies: data.companies,
		sectorOptions: buildEarningsCalendarSectorOptions(data.companies),
		summary: buildEarningsCalendarSummary(data.rows, data.todayET),
		todayET: data.todayET,
		stale: data.stale,
		updatedAt: data.updatedAt
	}
}

interface EarningsCalendarSearchCompany extends IEquitiesCalendarCompany {
	nextEvent: IEquitiesCalendarRow | null
}

export type EarningsCalendarSearchResult =
	| { kind: 'match'; company: EarningsCalendarSearchCompany; query: string }
	| { kind: 'no-dates'; company: IEquitiesCalendarCompany; query: string }
	| { kind: 'no-results'; query: string }

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

export function isValidEarningsCalendarDate(value: string): boolean {
	try {
		parseIsoDateParts(value)
		return true
	} catch {
		return false
	}
}

export function getEarningsCalendarDisplayDate(
	requestedDate: string | undefined,
	todayET: string,
	fullCalendarAvailable: boolean
): string {
	return fullCalendarAvailable && requestedDate && isValidEarningsCalendarDate(requestedDate) ? requestedDate : todayET
}

export function isValidEarningsCalendarEvent(value: unknown): value is IEquitiesEarningsCalendarApiItem {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
	const row = value as Record<string, unknown>
	return (
		typeof row.ticker === 'string' &&
		row.ticker.length > 0 &&
		typeof row.event_key === 'string' &&
		row.event_key.length > 0 &&
		typeof row.report_date === 'string' &&
		isValidEarningsCalendarDate(row.report_date) &&
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

export function getEarningsCalendarStatus(
	row: IEquitiesEarningsCalendarApiItem,
	todayET: string
): EarningsCalendarStatus {
	if (row.date_status === 'reported' || row.date_status === 'inferred') return 'reported'
	return row.report_date < todayET ? 'pastDue' : 'projected'
}

export function getEarningsMarketCapTier(marketCap: number | null): EarningsMarketCapTier | null {
	if (marketCap === null || marketCap < 0) return null
	if (marketCap >= 200_000_000_000) return 'mega'
	if (marketCap >= 10_000_000_000) return 'large'
	if (marketCap >= 2_000_000_000) return 'mid'
	if (marketCap >= 300_000_000) return 'small'
	return 'micro'
}

export function joinEarningsCalendarRows(
	events: ReadonlyArray<IEquitiesEarningsCalendarApiItem>,
	companies: ReadonlyArray<IEquitiesCalendarCompany>
): Array<IEquitiesCalendarRow> {
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
	row: IEquitiesCalendarRow,
	filters: IEarningsCalendarFilters,
	allowedTiers: ReadonlySet<EarningsMarketCapOption> | null,
	allowedSectors: ReadonlySet<string> | null
): boolean {
	if (allowedSectors && !allowedSectors.has(row.sectorSlug)) return false
	if (allowedTiers && !allowedTiers.has(getEarningsMarketCapTier(row.marketCap) ?? 'unknown')) return false
	if (filters.tightWindowsOnly && row.max_drift_days !== null && row.max_drift_days > 7) return false
	return true
}

function compareMarketCapDescending(a: IEquitiesCalendarRow, b: IEquitiesCalendarRow): number {
	return (
		(b.marketCap ?? -1) - (a.marketCap ?? -1) ||
		a.ticker.localeCompare(b.ticker) ||
		a.event_key.localeCompare(b.event_key)
	)
}

export function buildEarningsCalendarWeek(
	rows: ReadonlyArray<IEquitiesCalendarRow>,
	selectedDate: string,
	filters: IEarningsCalendarFilters = {},
	cardLimit = 12
): EarningsCalendarWeek {
	const monday = mondayOfCalendarWeek(selectedDate)
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const allowedTiers = filters.marketCapTiers ? new Set(filters.marketCapTiers) : null
	const allowedSectors = filters.sectorSlugs ? new Set(filters.sectorSlugs) : null
	const weekRows: Array<IEquitiesCalendarRow> = []
	for (const row of rows) {
		if (
			row.report_date >= monday &&
			row.report_date <= friday &&
			matchesEarningsCalendarFilters(row, filters, allowedTiers, allowedSectors)
		) {
			weekRows.push(row)
		}
	}
	weekRows.sort((a, b) => a.report_date.localeCompare(b.report_date) || compareMarketCapDescending(a, b))
	const cards = weekRows.slice().sort(compareMarketCapDescending).slice(0, cardLimit)
	const cardsByDate = new Map<string, Array<IEquitiesCalendarRow>>()
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

export function buildEarningsCalendarSummary(rows: ReadonlyArray<IEquitiesEarningsCalendarApiItem>, todayET: string) {
	const monthCounts = new Map<string, number>()
	const firstReportByMonth: Record<string, string> = {}
	const uniqueTickers = new Set<string>()
	let firstReport: string | null = null
	let lastReport: string | null = null
	let pastCount = 0
	const recentPastBoundary = addCalendarDays(todayET, -31)
	for (const row of rows) {
		uniqueTickers.add(row.ticker)
		if (firstReport === null || row.report_date < firstReport) firstReport = row.report_date
		if (lastReport === null || row.report_date > lastReport) lastReport = row.report_date
		if (row.report_date < todayET) {
			if (row.report_date >= recentPastBoundary) pastCount++
			continue
		}
		const month = row.report_date.slice(0, 7)
		monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
		if (firstReportByMonth[month] === undefined || row.report_date < firstReportByMonth[month]) {
			firstReportByMonth[month] = row.report_date
		}
	}
	return {
		monthBuckets: [...monthCounts].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
		pastCount,
		firstReportByMonth,
		bounds: {
			first: firstReport === null ? null : mondayOfCalendarWeek(firstReport),
			last: lastReport === null ? null : mondayOfCalendarWeek(lastReport)
		},
		uniqueCompanyCount: uniqueTickers.size
	}
}

export function buildEarningsCalendarWeekExposure(
	rows: ReadonlyArray<IEquitiesCalendarRow>,
	monday: string,
	todayET: string
) {
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const rowByTicker = new Map<string, IEquitiesCalendarRow>()
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
	const statusCounts = { reported: 0, projected: 0, pastDue: 0 }
	for (const row of companyRows) {
		if (!buildSecFilingUrl(row.cik, row.accession_number)) statusCounts[getEarningsCalendarStatus(row, todayET)]++
	}
	return {
		days,
		companyCount: companyRows.length,
		marketCap: days.reduce((total, day) => total + day.marketCap, 0),
		secConfirmedCount,
		projectedCount: statusCounts.projected,
		pastDueCount: statusCounts.pastDue
	}
}

/** Small server-rendered view model; the complete calendar continues loading in the background. */
export function buildEarningsCalendarBootstrap(
	events: ReadonlyArray<IEquitiesEarningsCalendarApiItem>,
	companies: ReadonlyArray<IEquitiesCalendarCompany>,
	todayET: string
): IEarningsCalendarBootstrap {
	const monday = mondayOfCalendarWeek(todayET)
	const friday = addCalendarDays(monday, WEEKDAYS - 1)
	const currentWeekEvents: Array<IEquitiesEarningsCalendarApiItem> = []
	for (const event of events) {
		if (event.report_date >= monday && event.report_date <= friday) currentWeekEvents.push(event)
	}
	const summary = buildEarningsCalendarSummary(events, todayET)
	return {
		rows: buildEarningsCalendarWeek(joinEarningsCalendarRows(currentWeekEvents, companies), todayET, {}, 0).rows,
		...summary,
		sectorOptions: buildEarningsCalendarSectorOptions(companies)
	}
}

/** Sectors by name, then Unknown, which also holds events whose company is missing from the company list. */
export function buildEarningsCalendarSectorOptions(
	companies: ReadonlyArray<IEquitiesCalendarCompany>
): Array<{ key: string; name: string }> {
	const sectors = new Map<string, string>()
	for (const company of companies) {
		if (company.sectorSlug && company.sectorSlug !== 'unknown') sectors.set(company.sectorSlug, company.sector)
	}
	return [
		...[...sectors].sort((a, b) => a[1].localeCompare(b[1])).map(([key, name]) => ({ key, name })),
		{ key: 'unknown', name: 'Unknown' }
	]
}

export function searchEarningsCalendarCompanies(
	query: string,
	companies: ReadonlyArray<IEquitiesCalendarCompany>,
	rows: ReadonlyArray<IEquitiesCalendarRow>,
	todayET: string
): EarningsCalendarSearchResult {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return { kind: 'no-results', query: query.trim() }
	const matches = companies.filter(
		(company) =>
			company.ticker.toLowerCase().startsWith(normalizedQuery) || company.name.toLowerCase().includes(normalizedQuery)
	)
	if (matches.length === 0) return { kind: 'no-results', query: query.trim() }
	const rowsByTicker = new Map<string, Array<IEquitiesCalendarRow>>()
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
		return { kind: 'match', company: companiesWithDates[0]!, query: query.trim() }
	}
	return { kind: 'no-dates', company: matches[0]!, query: query.trim() }
}

export function buildSecFilingUrl(cik: string, accessionNumber: string): string | null {
	if (!/^\d+$/.test(cik) || !/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber)) return null
	const accessionPath = accessionNumber.replaceAll('-', '')
	return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionPath}/${accessionNumber}-index.htm`
}

export function cleanEarningsCompanyName(name: string): string {
	return name.replace(/\s+(Class [A-Z]\s+)?Common Stock$/i, '').trim()
}
