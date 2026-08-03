import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildProDashboardChartSourcePlan } from '~/containers/ProDashboard/chartSourcePlan'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import { dashboardStreamNeedsProtocolCatalog } from '~/containers/ProDashboard/dashboardStreamCapabilities'
import {
	INITIAL_DASHBOARD_STREAM_ITEM_COUNT,
	type DashboardStreamChunk
} from '~/containers/ProDashboard/dashboardStreamContract'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { DISCOVERY_CATEGORIES } from '~/containers/ProDashboard/discoveryCategories'
import { dashboardAPI, dashboardUrlKey } from '~/containers/ProDashboard/services/DashboardAPI'
import { STREAM_PROTOCOL_SERIES_SKIP_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { auditProDashboardTableSources } from './proDashboardTableAudit'
import { buildProDashboardTableSourcePlan } from './proDashboardTableSourcePlan'

type AuditSeverity = 'error' | 'warning'

interface AuditIssue {
	severity: AuditSeverity
	code: string
	message: string
}

interface CachedResponse {
	status: number
	statusText: string
	headers: Array<[string, string]>
	body: string
}

interface ParsedStream {
	chunks: DashboardStreamChunk[]
	issues: AuditIssue[]
}

interface DashboardAuditResult {
	id: string
	slug?: string
	name: string
	sections: Array<{ key: string; rank: number }>
	itemKinds: Record<string, number>
	chartConsumers: number
	expectedChartSources: number
	receivedChartSources: number
	emptyChartSources: string[]
	missingChartSources: string[]
	duplicateChartSources: string[]
	expectedTableSources: number
	receivedTableSources: number
	emptyTableSources: string[]
	missingTableSources: string[]
	duplicateTableSources: string[]
	unexpectedTableSources: string[]
	chunkTypes: Record<string, number>
	durationMs: number
	issues: AuditIssue[]
}

interface AuditReport {
	generatedAt: string
	baseUrl: string
	sectionLimit: number
	discoverySlots: number
	uniqueDashboards: number
	summary: {
		errors: number
		warnings: number
		expectedChartSources: number
		receivedChartSources: number
		expectedTableSources: number
		receivedTableSources: number
	}
	dashboards: DashboardAuditResult[]
}

interface CliOptions {
	baseUrl: string
	sectionLimit: number
	concurrency: number
	cacheDir: string
	output: string
	reuseCache: boolean
	dashboard?: string
}

function parseBoolean(value: string | undefined): boolean {
	return value === '1' || value === 'true'
}

function parseCliOptions(argv: string[]): CliOptions {
	const values = new Map<string, string>()
	for (const arg of argv) {
		if (!arg.startsWith('--')) continue
		const separator = arg.indexOf('=')
		if (separator === -1) values.set(arg.slice(2), 'true')
		else values.set(arg.slice(2, separator), arg.slice(separator + 1))
	}

	const cacheDir = values.get('cache-dir') ?? path.join(tmpdir(), 'defillama-pro-dashboard-audit')
	const dashboard = values.get('dashboard')
	return {
		baseUrl: (values.get('base-url') ?? 'http://127.0.0.1:3000').replace(/\/$/, ''),
		sectionLimit: Math.max(1, Number(values.get('section-limit') ?? 10)),
		concurrency: Math.max(1, Number(values.get('concurrency') ?? 3)),
		cacheDir,
		output: values.get('output') ?? path.join(cacheDir, 'report.json'),
		reuseCache: parseBoolean(values.get('reuse-cache')),
		...(dashboard === undefined ? {} : { dashboard })
	}
}

function cacheFileForUrl(cacheDir: string, url: string): string {
	return path.join(cacheDir, `${createHash('sha256').update(url).digest('hex')}.json`)
}

function createCachedFetch(cacheDir: string, reuseCache: boolean) {
	return async (url: string | URL | globalThis.Request, options?: RequestInit): Promise<Response> => {
		const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
		const cacheFile = cacheFileForUrl(cacheDir, requestUrl)

		if (reuseCache) {
			const cached = await readFile(cacheFile, 'utf8').catch(() => null)
			if (cached) {
				const entry: CachedResponse = JSON.parse(cached)
				return new Response(entry.body, {
					status: entry.status,
					statusText: entry.statusText,
					headers: entry.headers
				})
			}
		}

		const response = await fetch(url, options)
		const entry: CachedResponse = {
			status: response.status,
			statusText: response.statusText,
			headers: Array.from(response.headers.entries()),
			body: await response.text()
		}
		await mkdir(cacheDir, { recursive: true })
		await writeFile(cacheFile, JSON.stringify(entry))
		return new Response(entry.body, {
			status: entry.status,
			statusText: entry.statusText,
			headers: entry.headers
		})
	}
}

function parseStream(body: string): ParsedStream {
	const chunks: DashboardStreamChunk[] = []
	const issues: AuditIssue[] = []
	for (const [index, lineValue] of body.split('\n').entries()) {
		const line = lineValue.trim()
		if (!line) continue
		try {
			const value: DashboardStreamChunk = JSON.parse(line)
			if (!value || typeof value !== 'object' || !('type' in value)) throw new Error('chunk has no type')
			chunks.push(value)
		} catch (error) {
			issues.push({
				severity: 'error',
				code: 'invalid-stream-chunk',
				message: `Line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
			})
		}
	}
	return { chunks, issues }
}

function countItemKinds(items: DashboardItemConfig[]): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1
	return counts
}

function countChartConsumers(items: DashboardItemConfig[]): number {
	let count = 0
	for (const item of items) {
		if (item.kind === 'chart' || item.kind === 'metric') count++
		else if (item.kind === 'multi') count += item.items.length
	}
	return count
}

function expectedChunkTypes(items: DashboardItemConfig[]): Set<string> {
	const expected = new Set<string>(['dashboard', 'done'])
	if (dashboardStreamNeedsProtocolCatalog(items)) expected.add('protocolsAndChains')
	if (countChartConsumers(items) > 0) expected.add('appMetadata')
	for (const item of items) {
		switch (item.kind) {
			case 'chart':
			case 'metric':
				expected.add('chartData')
				break
			case 'multi':
				if (item.items.length > 0) expected.add('chartData')
				break
			case 'builder':
				if (item.config.mode === 'protocol' || !STREAM_PROTOCOL_SERIES_SKIP_METRICS.has(item.config.metric)) {
					expected.add('chartBuilderData')
				}
				break
			case 'yields':
				expected.add('yieldsChartData')
				break
			case 'stablecoins':
				expected.add('stablecoinsChartData')
				break
			case 'stablecoin-asset':
				expected.add('stablecoinAssetData')
				break
			case 'advanced-tvl':
			case 'advanced-borrowed':
				expected.add('protocolTvlChartData')
				break
			case 'income-statement':
				expected.add('incomeStatementData')
				break
			case 'unlocks-pie':
			case 'unlocks-schedule':
				expected.add('emissionData')
				break
			case 'rwa-overview':
				expected.add('rwaBreakdownData')
				break
			case 'rwa-asset':
				expected.add('rwaAssetChartData')
				break
		}
	}
	return expected
}

async function runWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length)
	const queue = items.entries()
	const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		for (;;) {
			const next = queue.next()
			if (next.done) return
			const [index, item] = next.value
			results[index] = await worker(item)
		}
	})
	await Promise.all(workers)
	return results
}

async function auditDashboard({
	dashboardSummary,
	sections,
	baseUrl,
	cachedFetch
}: {
	dashboardSummary: Dashboard
	sections: Array<{ key: string; rank: number }>
	baseUrl: string
	cachedFetch: ReturnType<typeof createCachedFetch>
}): Promise<DashboardAuditResult> {
	const startedAt = performance.now()
	const issues: AuditIssue[] = []
	const dashboardKey = dashboardUrlKey(dashboardSummary)
	const streamUrl = `${baseUrl}/api/dynamic/pro-dashboard/${encodeURIComponent(dashboardKey)}/stream`
	const response = await cachedFetch(streamUrl).catch((error) => {
		issues.push({ severity: 'error', code: 'stream-request-failed', message: String(error) })
		return null
	})

	if (!response) {
		return {
			id: dashboardSummary.id,
			...(dashboardSummary.slug === undefined ? {} : { slug: dashboardSummary.slug }),
			name: dashboardSummary.data?.dashboardName ?? dashboardKey,
			sections,
			itemKinds: {},
			chartConsumers: 0,
			expectedChartSources: 0,
			receivedChartSources: 0,
			emptyChartSources: [],
			missingChartSources: [],
			duplicateChartSources: [],
			expectedTableSources: 0,
			receivedTableSources: 0,
			emptyTableSources: [],
			missingTableSources: [],
			duplicateTableSources: [],
			unexpectedTableSources: [],
			chunkTypes: {},
			durationMs: Math.round(performance.now() - startedAt),
			issues
		}
	}

	if (!response.ok) {
		issues.push({
			severity: 'error',
			code: 'stream-http-error',
			message: `${response.status} ${response.statusText}`
		})
	}
	const parsed = parseStream(await response.text())
	issues.push(...parsed.issues)

	const chunkTypes: Record<string, number> = {}
	for (const chunk of parsed.chunks) chunkTypes[chunk.type] = (chunkTypes[chunk.type] ?? 0) + 1
	if (!chunkTypes.done) issues.push({ severity: 'error', code: 'stream-incomplete', message: 'Missing done chunk' })

	const dashboardChunk = parsed.chunks.find((chunk) => chunk.type === 'dashboard')
	let dashboard = dashboardChunk?.type === 'dashboard' ? dashboardChunk.data : null
	if (!dashboard) {
		dashboard = await dashboardAPI.getDashboard(dashboardKey, cachedFetch).catch(() => null)
	}
	if (!dashboard) {
		issues.push({ severity: 'error', code: 'dashboard-missing', message: 'No dashboard config was returned' })
	}
	const items = (dashboard?.data?.items ?? []).slice(0, INITIAL_DASHBOARD_STREAM_ITEM_COUNT)

	const catalogChunk = parsed.chunks.find((chunk) => chunk.type === 'protocolsAndChains')
	const catalog = catalogChunk?.type === 'protocolsAndChains' ? catalogChunk.data : null
	if (dashboardStreamNeedsProtocolCatalog(items) && !catalog)
		issues.push({ severity: 'warning', code: 'catalog-missing', message: 'Protocol catalog was unavailable' })
	const appMetadataChunk = parsed.chunks.find((chunk) => chunk.type === 'appMetadata')
	const appMetadata = appMetadataChunk?.type === 'appMetadata' ? appMetadataChunk.data : null

	const sourcePlan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)
	const receivedCounts = new Map<string, number>()
	const emptyChartSources: string[] = []
	for (const chunk of parsed.chunks) {
		if (chunk.type !== 'chartData') continue
		const key = JSON.stringify(chunk.queryKey)
		receivedCounts.set(key, (receivedCounts.get(key) ?? 0) + 1)
		if (chunk.data.length === 0) emptyChartSources.push(key)
	}

	const expectedKeys = new Set(sourcePlan.map((source) => JSON.stringify(source.queryKey)))
	const missingChartSources = Array.from(expectedKeys).filter((key) => !receivedCounts.has(key))
	const duplicateChartSources = Array.from(receivedCounts)
		.filter(([, count]) => count > 1)
		.map(([key]) => key)
	for (const key of missingChartSources) {
		issues.push({ severity: 'error', code: 'chart-source-missing', message: key })
	}
	for (const key of duplicateChartSources) {
		issues.push({ severity: 'error', code: 'chart-source-duplicated', message: key })
	}
	for (const key of emptyChartSources) {
		issues.push({ severity: 'warning', code: 'chart-source-empty', message: key })
	}

	const tablePlan = buildProDashboardTableSourcePlan(items)
	const tableAudit = auditProDashboardTableSources(tablePlan.streamSources, parsed.chunks)
	for (const source of tableAudit.missing) {
		issues.push({ severity: 'error', code: 'table-source-missing', message: source })
	}
	for (const source of tableAudit.duplicate) {
		issues.push({ severity: 'error', code: 'table-source-duplicated', message: source })
	}
	for (const source of tableAudit.unexpected) {
		issues.push({ severity: 'error', code: 'table-source-unexpected', message: source })
	}
	for (const source of tableAudit.empty) {
		issues.push({ severity: 'warning', code: 'table-source-empty', message: source })
	}
	for (const expectedType of expectedChunkTypes(items)) {
		if (!chunkTypes[expectedType]) {
			issues.push({
				severity: expectedType === 'chartData' ? 'error' : 'warning',
				code: 'chunk-type-missing',
				message: expectedType
			})
		}
	}

	const slug = dashboard?.slug ?? dashboardSummary.slug
	return {
		id: dashboard?.id ?? dashboardSummary.id,
		...(slug === undefined ? {} : { slug }),
		name: dashboard?.data?.dashboardName ?? dashboardSummary.data?.dashboardName ?? dashboardKey,
		sections,
		itemKinds: countItemKinds(items),
		chartConsumers: countChartConsumers(items),
		expectedChartSources: expectedKeys.size,
		receivedChartSources: receivedCounts.size,
		emptyChartSources,
		missingChartSources,
		duplicateChartSources,
		expectedTableSources: tableAudit.expected,
		receivedTableSources: tableAudit.received,
		emptyTableSources: tableAudit.empty,
		missingTableSources: tableAudit.missing,
		duplicateTableSources: tableAudit.duplicate,
		unexpectedTableSources: tableAudit.unexpected,
		chunkTypes,
		durationMs: Math.round(performance.now() - startedAt),
		issues
	}
}

async function main(): Promise<void> {
	const options = parseCliOptions(process.argv.slice(2))
	const cachedFetch = createCachedFetch(options.cacheDir, options.reuseCache)
	const discovered = new Map<string, { dashboard: Dashboard; sections: Array<{ key: string; rank: number }> }>()

	if (options.dashboard) {
		const dashboard = await dashboardAPI.getDashboard(options.dashboard, cachedFetch)
		discovered.set(dashboard.id, { dashboard, sections: [{ key: 'explicit', rank: 1 }] })
	} else {
		const sectionResults = await Promise.all(
			DISCOVERY_CATEGORIES.map(async (section) => ({
				section,
				response: await dashboardAPI.searchDashboards(
					{
						visibility: 'public',
						sortBy: section.sortBy,
						...(section.timeFrame === undefined ? {} : { timeFrame: section.timeFrame }),
						page: 1,
						limit: options.sectionLimit
					},
					cachedFetch
				)
			}))
		)

		for (const { section, response } of sectionResults) {
			for (const [index, dashboard] of response.items.entries()) {
				const existing = discovered.get(dashboard.id)
				if (existing) existing.sections.push({ key: section.key, rank: index + 1 })
				else discovered.set(dashboard.id, { dashboard, sections: [{ key: section.key, rank: index + 1 }] })
			}
		}
	}

	const entries = Array.from(discovered.values())
	const dashboards = await runWithConcurrency(entries, options.concurrency, (entry) =>
		auditDashboard({
			dashboardSummary: entry.dashboard,
			sections: entry.sections,
			baseUrl: options.baseUrl,
			cachedFetch
		})
	)

	let errors = 0
	let warnings = 0
	let expectedChartSources = 0
	let receivedChartSources = 0
	let expectedTableSources = 0
	let receivedTableSources = 0
	for (const dashboard of dashboards) {
		expectedChartSources += dashboard.expectedChartSources
		receivedChartSources += dashboard.receivedChartSources
		expectedTableSources += dashboard.expectedTableSources
		receivedTableSources += dashboard.receivedTableSources
		for (const issue of dashboard.issues) {
			if (issue.severity === 'error') errors++
			else warnings++
		}
	}

	const report: AuditReport = {
		generatedAt: new Date().toISOString(),
		baseUrl: options.baseUrl,
		sectionLimit: options.sectionLimit,
		discoverySlots: options.dashboard ? 1 : DISCOVERY_CATEGORIES.length * options.sectionLimit,
		uniqueDashboards: dashboards.length,
		summary: {
			errors,
			warnings,
			expectedChartSources,
			receivedChartSources,
			expectedTableSources,
			receivedTableSources
		},
		dashboards
	}
	await mkdir(path.dirname(options.output), { recursive: true })
	await writeFile(options.output, JSON.stringify(report, null, 2))

	console.log(
		`[pro-dashboard-audit] ${dashboards.length} dashboards, ${expectedChartSources} chart sources, ${expectedTableSources} table sources, ${errors} errors, ${warnings} warnings`
	)
	console.log(`[pro-dashboard-audit] report: ${options.output}`)
	for (const dashboard of dashboards) {
		const dashboardErrors = dashboard.issues.filter((issue) => issue.severity === 'error').length
		if (dashboardErrors > 0)
			console.error(`  ${dashboardErrors} error(s): ${dashboard.name} (${dashboard.slug ?? dashboard.id})`)
	}
	if (errors > 0) process.exitCode = 1
}

main().catch((error) => {
	console.error('[pro-dashboard-audit]', error)
	process.exit(1)
})
