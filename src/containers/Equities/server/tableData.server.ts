import type { ParsedUrlQuery } from 'node:querystring'
import { cachedResult } from '~/server/api/resultCache'
import { contentHashVersion, createRedisBlobStore } from '~/server/datasetSnapshots/redisBlobStore.server'
import { compareTableSortValues } from '~/server/tablePages/cursorPage.server'
import { offsetTablePage } from '~/server/tablePages/offsetPage.server'
import { prepareTableRows } from '~/server/tablePages/preparedRows.server'
import type { TablePageOrder } from '~/server/tablePages/types'
import { fetchEquitiesCompanies } from '../api'
import type { IEquitiesCompanyApiItem } from '../api.types'
import { filterEquityCompanies, type EquityActiveFilter } from '../filters'
import {
	EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
	getEquitiesTableQuery,
	getEquitiesTableQuerySignature,
	getEquitiesTreemapSizeMetricFromQuery,
	MAX_EQUITIES_TABLE_PAGE_SIZE,
	type EquitiesSortKey,
	type EquitiesTableQuery
} from '../tableQuery'
import { buildEquityTickerCountrySlug } from '../tickerCountry'
import { EQUITIES_TREEMAP_DEFAULT_LIMIT, rankEquitiesTreemapRows } from '../treemapData'
import type {
	EquitiesCategoricalOptions,
	EquitiesTableResponse,
	EquitiesTreemapResponse,
	EquitiesTreemapRow,
	IEquitiesListCompanyRow
} from '../types'

/**
 * The equities companies snapshot: one content-hashed, pointer-fresh copy of the
 * upstream companies list that every runtime pages from instead of shipping
 * ~3,000 wide rows to the browser.
 */
export interface EquitiesSnapshot {
	version: string
	generatedAt: number
	updatedAt: string | null
	rows: Array<IEquitiesListCompanyRow>
	options: EquitiesCategoricalOptions
}

const SNAPSHOT_KEY = 'all'
const PREPARED_ROWS_NAMESPACE = 'table-pages:equities:prepared-rows'
const PREPARED_ROWS_MEMORY = { ttlMs: 5 * 60 * 1000, maxEntries: 64 }

const equitiesStore = createRedisBlobStore<EquitiesSnapshot>({
	prefix: 'equities-companies:v1',
	versionTtlSeconds: 30 * 60,
	pointerTtlSeconds: 5 * 60,
	lastGoodTtlSeconds: 60 * 60,
	getIdentity: (payload) => ({ key: SNAPSHOT_KEY, version: payload.version }),
	getPublishedAt: (payload) => payload.generatedAt
})

function collectUniqueValues(
	rows: Array<IEquitiesCompanyApiItem>,
	key: 'country' | 'sector' | 'industry'
): Array<string> {
	const values = new Set<string>()
	for (const row of rows) {
		if (row[key]) values.add(row[key])
	}
	return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export function buildEquitiesSnapshot(
	companies: Array<IEquitiesCompanyApiItem>,
	generatedAt: number
): EquitiesSnapshot {
	// The producer already writes this complete population in descending market-cap order.
	const rows: Array<IEquitiesListCompanyRow> = []
	for (const company of companies) {
		rows.push({ ...company, href: `/equities/${buildEquityTickerCountrySlug(company.ticker, company.country)}` })
	}
	return {
		// Content-addressed: an unchanged upstream republishes the same blob and only refreshes the pointer.
		version: contentHashVersion(JSON.stringify(companies)),
		generatedAt,
		updatedAt: companies[0]?.updatedAt ?? null,
		rows,
		options: {
			country: collectUniqueValues(companies, 'country'),
			sector: collectUniqueValues(companies, 'sector'),
			industry: collectUniqueValues(companies, 'industry')
		}
	}
}

async function buildAndValidateEquitiesSnapshot(): Promise<EquitiesSnapshot> {
	const companies = await fetchEquitiesCompanies()
	// Publish gate: an empty upstream answer must not replace the last healthy snapshot.
	if (companies.length === 0) throw new Error('equities companies snapshot is empty')
	return buildEquitiesSnapshot(companies, Date.now())
}

export async function getEquitiesSnapshot(): Promise<EquitiesSnapshot> {
	return cachedResult('equities-snapshot', SNAPSHOT_KEY, { ttlMs: 60 * 1000, maxEntries: 1 }, async () => {
		const current = await equitiesStore.readCurrent(SNAPSHOT_KEY)
		if (current) return current

		let built: EquitiesSnapshot
		try {
			built = await buildAndValidateEquitiesSnapshot()
		} catch (error) {
			// Upstream outage at pointer expiry: serve the last published snapshot instead of failing.
			const lastGood = await equitiesStore.readLastGood(SNAPSHOT_KEY)
			if (lastGood) return lastGood
			throw error
		}
		await equitiesStore.publish(built)
		return built
	})
}

function compareRowIdentity(a: IEquitiesListCompanyRow, b: IEquitiesListCompanyRow): number {
	const aId = `${a.ticker}:${a.country}`
	const bId = `${b.ticker}:${b.country}`
	return aId < bId ? -1 : aId > bId ? 1 : 0
}

function sortRows(rows: Array<IEquitiesListCompanyRow>, sortBy: EquitiesSortKey, order: TablePageOrder): void {
	rows.sort((a, b) => compareTableSortValues(a[sortBy], b[sortBy], order) || compareRowIdentity(a, b))
}

function matchesSearch(rows: Array<IEquitiesListCompanyRow>, search: string): Array<IEquitiesListCompanyRow> {
	const normalized = search.toLowerCase()
	if (!normalized) return rows
	const matches: Array<IEquitiesListCompanyRow> = []
	for (const row of rows) {
		if (row.ticker.toLowerCase().includes(normalized) || row.name.toLowerCase().includes(normalized)) matches.push(row)
	}
	return matches
}

/** Filter, then sort once per query; ticker matches rank ahead of company-name matches while searching. */
export function prepareEquitiesRows(
	rows: Array<IEquitiesListCompanyRow>,
	query: EquitiesTableQuery
): Array<IEquitiesListCompanyRow> {
	const filtered = filterEquityCompanies(rows, query.filters)
	const order: TablePageOrder = query.sortDesc ? 'desc' : 'asc'
	const search = query.search.toLowerCase()
	if (!search) {
		const sorted = filtered.slice()
		sortRows(sorted, query.sortBy, order)
		return sorted
	}
	const tickerMatches: Array<IEquitiesListCompanyRow> = []
	const nameMatches: Array<IEquitiesListCompanyRow> = []
	for (const row of filtered) {
		if (row.ticker.toLowerCase().includes(search)) tickerMatches.push(row)
		else if (row.name.toLowerCase().includes(search)) nameMatches.push(row)
	}
	sortRows(tickerMatches, query.sortBy, order)
	sortRows(nameMatches, query.sortBy, order)
	return tickerMatches.concat(nameMatches)
}

export async function getEquitiesTablePage(
	snapshot: EquitiesSnapshot,
	rawQuery: ParsedUrlQuery
): Promise<EquitiesTableResponse> {
	const query = getEquitiesTableQuery(rawQuery)
	const rows = await prepareTableRows({
		namespace: PREPARED_ROWS_NAMESPACE,
		domain: SNAPSHOT_KEY,
		version: snapshot.version,
		signature: getEquitiesTableQuerySignature(query),
		memory: PREPARED_ROWS_MEMORY,
		prepare: () => prepareEquitiesRows(snapshot.rows, query)
	})
	return {
		schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
		...offsetTablePage({ rows, page: query.page, pageSize: query.pageSize, maxPageSize: MAX_EQUITIES_TABLE_PAGE_SIZE }),
		options: snapshot.options,
		updatedAt: snapshot.updatedAt
	}
}

function toEquitiesTreemapRow(row: IEquitiesListCompanyRow): EquitiesTreemapRow {
	return {
		ticker: row.ticker,
		country: row.country,
		name: row.name,
		sector: row.sector,
		industry: row.industry,
		marketCap: row.marketCap,
		revenueTTM: row.revenueTTM,
		earningsTTM: row.earningsTTM,
		ebitdaTTM: row.ebitdaTTM,
		enterpriseValue: row.enterpriseValue,
		cashAndCashEquivalents: row.cashAndCashEquivalents,
		totalDebt: row.totalDebt,
		totalAssets: row.totalAssets,
		totalShareholdersEquity: row.totalShareholdersEquity,
		employeeCount: row.employeeCount,
		priceChangePercentage1d: row.priceChangePercentage1d,
		priceChangePercentage7d: row.priceChangePercentage7d,
		priceChangePercentage1m: row.priceChangePercentage1m
	}
}

export function buildEquitiesTreemapPage(
	rows: Array<IEquitiesListCompanyRow>,
	{
		search,
		filters,
		sizeMetric
	}: { search: string; filters: Array<EquityActiveFilter>; sizeMetric: EquitiesTreemapResponse['sizeMetric'] }
): EquitiesTreemapResponse {
	const matching = matchesSearch(filterEquityCompanies(rows, filters), search)
	const ranking = rankEquitiesTreemapRows(matching, sizeMetric, EQUITIES_TREEMAP_DEFAULT_LIMIT)
	return {
		schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
		sizeMetric,
		rows: ranking.rows.map((row) => toEquitiesTreemapRow(row as IEquitiesListCompanyRow)),
		excludedCount: ranking.excludedCount,
		truncatedCount: ranking.truncatedCount,
		total: matching.length
	}
}

export async function getEquitiesTreemapPage(
	snapshot: EquitiesSnapshot,
	rawQuery: ParsedUrlQuery
): Promise<EquitiesTreemapResponse> {
	const { search, filters } = getEquitiesTableQuery(rawQuery)
	const sizeMetric = getEquitiesTreemapSizeMetricFromQuery(rawQuery)
	return prepareTableRows({
		namespace: 'table-pages:equities:market-map',
		domain: SNAPSHOT_KEY,
		version: snapshot.version,
		signature: JSON.stringify({ search: search.toLowerCase(), filters: rawQuery.filters ?? '', sizeMetric }),
		memory: PREPARED_ROWS_MEMORY,
		prepare: () => buildEquitiesTreemapPage(snapshot.rows, { search, filters, sizeMetric })
	})
}
