import { cachedResult } from '~/server/api/resultCache'
import { contentHashVersion, createRedisBlobStore } from '~/server/datasetSnapshots/redisBlobStore.server'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { buildIndustriesPageData, toEquitiesTaxonomySlug, type IndustriesPageData } from '../aggregateData'
import {
	EQUITIES_EARNINGS_CALENDAR_API,
	fetchEquitiesCompaniesByTaxonomy,
	fetchEquitiesIndustries,
	fetchEquitiesSector,
	fetchEquitiesSectors,
	fetchEquitiesSectorsOverview
} from '../api'
import type { IEquitiesEarningsCalendarApiItem } from '../api.types'
import { isValidEarningsCalendarEvent } from '../earningsCalendarData'
import { buildEquitiesSectorPageViewData, type IEquitiesSectorPageViewData } from '../sectorPageData'
import type {
	EquitiesPageDataState,
	IEquitiesCalendarCompany,
	IEquitiesCalendarData,
	IEquitiesIndustriesData,
	IEquitiesSectorsData,
	IEquitiesSectorPageData,
	IEquitiesListCompanyRow
} from '../types'
import { getEquitiesSnapshot } from './tableData.server'

export const EQUITIES_SECTOR_SLUGS = [
	'technology',
	'financial-services',
	'healthcare',
	'consumer-cyclical',
	'consumer-defensive',
	'communication-services',
	'industrials',
	'energy',
	'basic-materials',
	'utilities',
	'real-estate'
] as const

export type EquitiesSectorSlug = (typeof EQUITIES_SECTOR_SLUGS)[number]

interface StoredSnapshot<T> {
	key: string
	version: string
	generatedAt: number
	data: T
}

interface SnapshotRead<T> {
	snapshot: StoredSnapshot<T>
	stale: boolean
}

const SECTORS_KEY = 'sectors'
const INDUSTRIES_KEY = 'industries'
const CALENDAR_KEY = 'calendar'
const MEMORY_TTL_MS = 60 * 1000
const NEW_YORK_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	timeZone: 'America/New_York'
})
const STORE_OPTIONS = {
	versionTtlSeconds: 3 * 60 * 60,
	pointerTtlSeconds: 60 * 60,
	lastGoodTtlSeconds: 24 * 60 * 60
}

function createStore<T>(prefix: string) {
	return createRedisBlobStore<StoredSnapshot<T>>({
		prefix,
		...STORE_OPTIONS,
		getIdentity: (payload) => ({ key: payload.key, version: payload.version }),
		getPublishedAt: (payload) => payload.generatedAt
	})
}

const sectorsStore = createStore<IEquitiesSectorsData>('equities-sectors:v1')
const industriesStore = createStore<IEquitiesIndustriesData>('equities-industries:v1')
const sectorStore = createStore<IEquitiesSectorPageData>('equities-sector:v1')
const calendarStore = createStore<IEquitiesCalendarData>('equities-calendar:v3')

export function getNewYorkCalendarDate(timestampMs: number): string {
	const parts = NEW_YORK_DATE_FORMATTER.formatToParts(new Date(timestampMs))
	const year = parts.find((part) => part.type === 'year')?.value
	const month = parts.find((part) => part.type === 'month')?.value
	const day = parts.find((part) => part.type === 'day')?.value
	if (!year || !month || !day) throw new Error('Could not resolve the New York calendar date')
	return `${year}-${month}-${day}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasString(value: Record<string, unknown>, key: string): boolean {
	return typeof value[key] === 'string' && value[key].length > 0
}

function assertSectorData(data: IEquitiesSectorsData): void {
	if (!isRecord(data.overview) || data.sectors.length === 0)
		throw new Error('Equities sectors snapshot is empty or malformed')
	const sectorSlugs = new Set<string>()
	for (const sector of data.sectors) {
		if (!isRecord(sector) || !hasString(sector, 'sector') || !hasString(sector, 'sectorSlug')) {
			throw new Error('Equities market snapshot contains an invalid sector')
		}
		if (sectorSlugs.has(sector.sectorSlug)) throw new Error(`Duplicate equities sector: ${sector.sectorSlug}`)
		sectorSlugs.add(sector.sectorSlug)
	}
}

function assertIndustryData(data: IEquitiesIndustriesData): void {
	if (!isRecord(data.overview) || data.industries.length === 0) {
		throw new Error('Equities industries snapshot is empty or malformed')
	}
	const industryKeys = new Set<string>()
	for (const industry of data.industries) {
		if (!isRecord(industry) || !hasString(industry, 'industrySlug') || !hasString(industry, 'sectorSlug')) {
			throw new Error('Equities market snapshot contains an invalid industry')
		}
		const key = `${industry.sectorSlug}:${industry.industrySlug}`
		if (industryKeys.has(key)) throw new Error(`Duplicate equities industry: ${key}`)
		industryKeys.add(key)
	}
}

function snapshot<T>(key: string, data: T): StoredSnapshot<T> {
	return {
		key,
		version: contentHashVersion(JSON.stringify(data)),
		generatedAt: Date.now(),
		data
	}
}

async function readOrBuild<T>({
	cacheKey,
	store,
	build
}: {
	cacheKey: string
	store: ReturnType<typeof createStore<T>>
	build: () => Promise<StoredSnapshot<T>>
}): Promise<SnapshotRead<T>> {
	const current = await store.readCurrent(cacheKey)
	if (current) return { snapshot: current, stale: false }

	try {
		const built = await build()
		await store.publish(built)
		return { snapshot: built, stale: false }
	} catch (error) {
		const lastGood = await store.readLastGood(cacheKey)
		if (lastGood) return { snapshot: lastGood, stale: true }
		throw error
	}
}

export async function getEquitiesSectorsData(): Promise<SnapshotRead<IEquitiesSectorsData>> {
	return cachedResult('equities-sectors-data', SECTORS_KEY, { ttlMs: MEMORY_TTL_MS, maxEntries: 1 }, async () =>
		readOrBuild({
			cacheKey: SECTORS_KEY,
			store: sectorsStore,
			build: async () => {
				const [overview, sectors] = await Promise.all([fetchEquitiesSectorsOverview(), fetchEquitiesSectors()])
				const data = { overview, sectors }
				assertSectorData(data)
				return snapshot(SECTORS_KEY, data)
			}
		})
	)
}

export async function getEquitiesIndustriesData(): Promise<SnapshotRead<IEquitiesIndustriesData>> {
	return cachedResult('equities-industries-data', INDUSTRIES_KEY, { ttlMs: MEMORY_TTL_MS, maxEntries: 1 }, async () =>
		readOrBuild({
			cacheKey: INDUSTRIES_KEY,
			store: industriesStore,
			build: async () => {
				const [overview, industries] = await Promise.all([fetchEquitiesSectorsOverview(), fetchEquitiesIndustries()])
				const data = { overview, industries }
				assertIndustryData(data)
				return snapshot(INDUSTRIES_KEY, data)
			}
		})
	)
}

export async function getEquitiesSectorData(
	sectorSlug: EquitiesSectorSlug
): Promise<SnapshotRead<IEquitiesSectorPageData>> {
	return cachedResult('equities-sector-data', sectorSlug, { ttlMs: MEMORY_TTL_MS, maxEntries: 16 }, async () =>
		readOrBuild({
			cacheKey: sectorSlug,
			store: sectorStore,
			build: async () => {
				const [sector, overview, industries, companies] = await Promise.all([
					fetchEquitiesSector(sectorSlug),
					fetchEquitiesSectorsOverview(),
					fetchEquitiesIndustries(sectorSlug),
					fetchEquitiesCompaniesByTaxonomy({ sector: sectorSlug })
				])
				if (!isRecord(sector) || sector.sectorSlug !== sectorSlug || companies.length === 0) {
					throw new Error(`Equities sector snapshot is empty or malformed: ${sectorSlug}`)
				}
				const data = { sector, overview, industries, companies }
				return snapshot(sectorSlug, data)
			}
		})
	)
}

function toCalendarCompany(row: IEquitiesListCompanyRow): IEquitiesCalendarCompany {
	return {
		ticker: row.ticker,
		name: row.name,
		marketCap: row.marketCap,
		sector: row.sector || 'Unknown',
		sectorSlug: row.sectorSlug || toEquitiesTaxonomySlug(row.sector),
		country: row.country
	}
}

async function fetchCalendarWithHeaders(): Promise<Array<IEquitiesEarningsCalendarApiItem>> {
	const url = new URL(EQUITIES_EARNINGS_CALENDAR_API)
	url.searchParams.set('cachebust', '091626')
	const response = await fetchWithPoolingOnServer(url, { timeout: 45_000 })
	if (!response.ok) throw new Error(`Equities earnings calendar upstream returned ${response.status}`)
	const truncated = response.headers.get('x-result-truncated')?.toLowerCase()
	if (truncated === 'true' || truncated === '1' || truncated === 'yes') {
		throw new Error('Equities earnings calendar upstream response was truncated')
	}
	const data: unknown = await response.json()
	if (!Array.isArray(data) || data.length === 0) throw new Error('Equities earnings calendar is empty or malformed')
	return data.map((row) => {
		if (!isValidEarningsCalendarEvent(row)) throw new Error('Equities earnings calendar contains an invalid event')
		return {
			ticker: row.ticker,
			date_status: row.date_status,
			report_date: row.report_date,
			report_time: row.report_time,
			max_drift_days: row.max_drift_days,
			fiscal_year: row.fiscal_year,
			fiscal_period: row.fiscal_period,
			event_key: row.event_key,
			cik: row.cik,
			accession_number: row.accession_number
		}
	})
}

export async function getEquitiesCalendarData(): Promise<SnapshotRead<IEquitiesCalendarData>> {
	return cachedResult('equities-calendar-data-v3', CALENDAR_KEY, { ttlMs: MEMORY_TTL_MS, maxEntries: 1 }, async () =>
		readOrBuild({
			cacheKey: CALENDAR_KEY,
			store: calendarStore,
			build: async () => {
				const [calendar, companiesSnapshot] = await Promise.all([fetchCalendarWithHeaders(), getEquitiesSnapshot()])
				const companies = companiesSnapshot.rows.map(toCalendarCompany)
				const data = { rows: calendar, companies, updatedAt: companiesSnapshot.updatedAt }
				return snapshot(CALENDAR_KEY, data)
			}
		})
	)
}

async function safePageData<T>(loader: () => Promise<SnapshotRead<T>>): Promise<EquitiesPageDataState<T>> {
	try {
		const { snapshot: result, stale } = await loader()
		return { status: 'ready', data: result.data, stale }
	} catch (error) {
		recordRouteRuntimeError(error, 'getStaticProps')
		return { status: 'error', data: null, stale: false }
	}
}

export function loadEquitiesSectorsPageData(): Promise<EquitiesPageDataState<IEquitiesSectorsData>> {
	return safePageData(getEquitiesSectorsData)
}

export async function loadEquitiesIndustriesPageData(): Promise<EquitiesPageDataState<IndustriesPageData>> {
	const state = await safePageData(getEquitiesIndustriesData)
	return state.status === 'ready' ? { ...state, data: buildIndustriesPageData(state.data) } : state
}

export function loadEquitiesSectorPageData(
	sectorSlug: EquitiesSectorSlug
): Promise<EquitiesPageDataState<IEquitiesSectorPageViewData>> {
	return safePageData(() => getEquitiesSectorData(sectorSlug)).then((state) =>
		state.status === 'ready' ? { ...state, data: buildEquitiesSectorPageViewData(state.data) } : state
	)
}

export function loadEquitiesCalendarPageData(): Promise<EquitiesPageDataState<IEquitiesCalendarData>> {
	return safePageData(getEquitiesCalendarData)
}
