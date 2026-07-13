import { chartDatasetsBySlug } from '~/containers/Downloads/chart-datasets'
import { datasetsBySlug } from '~/containers/Downloads/datasets'
import type { TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { flattenItemsToCsv, rowsToCsv } from './csv'

const CSV_CACHE_TTL_MS = 10 * 60 * 1000
const CSV_CACHE_MAX_ENTRIES = 32
const UPSTREAM_TIMEOUT_MS = 15_000

interface CsvCacheEntry {
	csv: string
	expiresAt: number
}

const csvCache = new Map<string, CsvCacheEntry>()
const inFlight = new Map<string, Promise<string>>()

export function cacheKeyForSource(source: TableSource): string {
	if (source.kind === 'dataset') return `dataset:${source.slug}`
	return `chart:${source.slug}:${source.param}`
}

export async function fetchCsvForSource(source: TableSource): Promise<string> {
	const key = cacheKeyForSource(source)

	const cached = csvCache.get(key)
	if (cached && cached.expiresAt > Date.now()) {
		csvCache.delete(key)
		csvCache.set(key, cached)
		return cached.csv
	}

	const pending = inFlight.get(key)
	if (pending) return pending

	const promise = fetchCsvUncached(source)
		.then((csv) => {
			csvCache.delete(key)
			csvCache.set(key, { csv, expiresAt: Date.now() + CSV_CACHE_TTL_MS })
			while (csvCache.size > CSV_CACHE_MAX_ENTRIES) {
				const oldest = csvCache.keys().next().value
				if (oldest === undefined) break
				csvCache.delete(oldest)
			}
			return csv
		})
		.finally(() => {
			inFlight.delete(key)
		})

	inFlight.set(key, promise)
	return promise
}

async function fetchCsvUncached(source: TableSource): Promise<string> {
	if (source.kind === 'dataset') {
		const dataset = datasetsBySlug.get(source.slug)
		if (!dataset) throw new Error(`Dataset "${source.slug}" not found`)

		const upstream = await fetchWithPoolingOnServer(dataset.url, { timeout: UPSTREAM_TIMEOUT_MS })
		if (!upstream.ok) {
			throw new Error(`Upstream API returned ${upstream.status} for dataset "${source.slug}"`)
		}
		const json = await upstream.json()
		const items = dataset.extractItems(json)
		return flattenItemsToCsv(items, dataset.fields)
	}

	const chartDataset = chartDatasetsBySlug.get(source.slug)
	if (!chartDataset) throw new Error(`Chart dataset "${source.slug}" not found`)

	const param = source.param.trim()
	if (!param) throw new Error(`Missing param for chart dataset "${source.slug}"`)

	let rows: Array<Record<string, unknown>>
	if (chartDataset.customFetch) {
		rows = await withUpstreamTimeout(chartDataset.customFetch(param), `chart "${source.slug}"`)
	} else {
		const upstream = await fetchWithPoolingOnServer(chartDataset.buildUrl(param), { timeout: UPSTREAM_TIMEOUT_MS })
		if (!upstream.ok) {
			throw new Error(`Upstream API returned ${upstream.status} for chart "${source.slug}"`)
		}
		const json = await upstream.json()
		rows = chartDataset.extractRows(json)
	}

	if (rows.length === 0) {
		throw new Error(`No data returned for chart "${source.slug}" with param "${param}"`)
	}

	return rowsToCsv(rows)
}

function withUpstreamTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Upstream timeout for ${label}`)), UPSTREAM_TIMEOUT_MS)
		promise.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(err) => {
				clearTimeout(timer)
				reject(err)
			}
		)
	})
}

export function clearCsvCacheForTests(): void {
	csvCache.clear()
	inFlight.clear()
}
