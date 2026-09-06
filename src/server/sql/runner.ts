import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchAllChartOptions, type ChartOptionsMap } from '~/containers/Downloads/chart-datasets'
import { extractTableRefs, matchTableRef } from '~/containers/Downloads/sql/completions'
import { identifierize, tableNameFor, type TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import type { SqlQueryRecipe } from '~/containers/ProDashboard/types'
import { SqlPolicyError, validateSqlRecipe } from './policy'
import { fetchCsvForSource } from './tableLoader'
import { SQL_WORKER_SCRIPT } from './workerScript'

const MAX_CONCURRENT_RUNS = 2
const MAX_QUEUED_RUNS = 16
const DEFAULT_RUN_TIMEOUT_MS = 30_000
const WORKER_MEMORY_LIMIT = '512MB'
const WORKER_THREADS = 2
const CHART_OPTIONS_TTL_MS = 10 * 60 * 1000
const CHART_OPTIONS_TIMEOUT_MS = 20_000

export interface ServerQueryResult {
	columns: Array<{ name: string; type: string }>
	rows: Array<Record<string, unknown>>
}

export class SqlQueueFullError extends Error {
	constructor() {
		super('SQL runner queue is full, try again later')
	}
}

export class SqlRunTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`SQL execution timed out after ${Math.round(timeoutMs / 1000)}s`)
	}
}

let activeRuns = 0
const waiters: Array<() => void> = []

async function acquireRunSlot(): Promise<() => void> {
	if (activeRuns >= MAX_CONCURRENT_RUNS && waiters.length >= MAX_QUEUED_RUNS) {
		throw new SqlQueueFullError()
	}
	if (activeRuns >= MAX_CONCURRENT_RUNS) {
		await new Promise<void>((resolve) => {
			waiters.push(resolve)
		})
	}
	activeRuns++
	let released = false
	return () => {
		if (released) return
		released = true
		activeRuns--
		const next = waiters.shift()
		if (next) next()
	}
}

let chartOptionsCache: { value: ChartOptionsMap; expiresAt: number } | null = null

async function getChartOptionsMap(): Promise<ChartOptionsMap> {
	if (chartOptionsCache && chartOptionsCache.expiresAt > Date.now()) {
		return chartOptionsCache.value
	}
	const value = await Promise.race([
		fetchAllChartOptions(),
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Timed out loading chart options')), CHART_OPTIONS_TIMEOUT_MS)
		)
	])
	chartOptionsCache = { value, expiresAt: Date.now() + CHART_OPTIONS_TTL_MS }
	return value
}

export async function resolveTableSources(
	sql: string,
	declaredSources: Array<TableSource>
): Promise<Array<{ name: string; source: TableSource }>> {
	const tables = declaredSources.map((source) => ({ name: tableNameFor(source), source }))
	const known = new Set(tables.map((t) => t.name))

	const missingRefs = extractTableRefs(sql).filter((ref) => !known.has(ref))
	if (missingRefs.length === 0) return tables

	let chartOptionsMap: ChartOptionsMap | null = null
	for (const ref of missingRefs) {
		const match = matchTableRef(ref)
		if (!match) continue
		if (match.kind === 'dataset') {
			tables.push({ name: ref, source: { kind: 'dataset', slug: match.slug } })
			known.add(ref)
			continue
		}
		if (!chartOptionsMap) chartOptionsMap = await getChartOptionsMap()
		const options = chartOptionsMap[match.definition.slug] ?? []
		const resolvedOption = options.find((opt) => identifierize(opt.value) === match.paramIdentifier)
		if (!resolvedOption) {
			throw new Error(
				`Table "${ref}" — couldn't resolve ${match.definition.paramLabel.toLowerCase()} "${match.paramIdentifier}" for ${match.definition.name}.`
			)
		}
		tables.push({
			name: ref,
			source: {
				kind: 'chart',
				slug: match.definition.slug,
				param: resolvedOption.value,
				paramLabel: resolvedOption.label
			}
		})
		known.add(ref)
	}
	return tables
}

interface WorkerTable {
	name: string
	csvPath: string
}

interface WorkerResponse {
	ok: boolean
	columns?: Array<{ name: string; type: string }>
	rows?: Array<Record<string, unknown>>
	error?: string
	policyViolation?: boolean
}

function runWorker(
	job: { sql: string; tables: Array<WorkerTable>; memoryLimit: string; threads: number },
	timeoutMs: number
): Promise<WorkerResponse> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ['-e', SQL_WORKER_SCRIPT], {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe']
		})

		let settled = false
		const stdoutChunks: Array<Buffer> = []
		const stderrChunks: Array<Buffer> = []

		const timer = setTimeout(() => {
			if (settled) return
			settled = true
			child.kill('SIGKILL')
			reject(new SqlRunTimeoutError(timeoutMs))
		}, timeoutMs)

		child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
		child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

		child.on('error', (err) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			reject(err)
		})

		child.on('close', (code) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString().trim()
				reject(new Error(stderr || `SQL worker exited with code ${code}`))
				return
			}
			try {
				resolve(JSON.parse(Buffer.concat(stdoutChunks).toString()) as WorkerResponse)
			} catch {
				reject(new Error('SQL worker returned malformed output'))
			}
		})

		child.stdin.write(JSON.stringify(job))
		child.stdin.end()
	})
}

export async function runServerSql(
	recipe: SqlQueryRecipe,
	options: { timeoutMs?: number } = {}
): Promise<ServerQueryResult> {
	validateSqlRecipe(recipe)
	const sql = recipe.sql.trim()

	const release = await acquireRunSlot()
	try {
		const tables = await resolveTableSources(sql, recipe.tableSources)

		const jobDir = await mkdtemp(join(tmpdir(), 'sql-run-'))
		try {
			const workerTables: Array<WorkerTable> = []
			for (const table of tables) {
				const csv = await fetchCsvForSource(table.source)
				const csvPath = join(jobDir, `${table.name}.csv`)
				await writeFile(csvPath, csv, 'utf8')
				workerTables.push({ name: table.name, csvPath })
			}

			const response = await runWorker(
				{
					sql,
					tables: workerTables,
					memoryLimit: WORKER_MEMORY_LIMIT,
					threads: WORKER_THREADS
				},
				options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS
			)

			if (!response.ok) {
				if (response.policyViolation) throw new SqlPolicyError(response.error || 'SQL is not allowed.')
				throw new Error(response.error || 'SQL execution failed')
			}
			return { columns: response.columns ?? [], rows: response.rows ?? [] }
		} finally {
			await rm(jobDir, { recursive: true, force: true }).catch(() => undefined)
		}
	} finally {
		release()
	}
}
