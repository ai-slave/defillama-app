import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { Table } from 'apache-arrow'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { ChartOptionsMap } from '../chart-datasets'
import { datasets } from '../datasets'
import { extractTableRefs, matchTableRef } from './completions'
import { queryDuckDB } from './duckdb/query'
import type { QueryResult } from './exportResults'
import { normalizeSqlResultRows } from './resultNormalization'
import type { PendingTable } from './TableChipRail'
import {
	identifierize,
	prettyLabelForSource,
	tableNameFor,
	type RegisteredTable,
	type TableSource
} from './useTableRegistry'

export interface ExecutorCtx {
	conn: AsyncDuckDBConnection | null
	loadedTables: Array<RegisteredTable>
	loadSource: (source: TableSource, signal?: AbortSignal) => Promise<RegisteredTable | null>
	chartOptionsMap: ChartOptionsMap
}

export interface ExecutorCallbacks {
	onPendingChange?: (pending: Array<PendingTable>) => void
	onLoadingStage?: (stage: string | null) => void
}

export type ExecutorResult =
	| { ok: true; result: QueryResult; durationMs: number; justLoaded: boolean }
	| { ok: false; error: string; cancelled?: boolean }

interface AutoLoadStep {
	key: string
	name: string
	label: string
	source: TableSource
}

const KNOWN_DATASET_IDENTIFIERS = new Set(datasets.map((d) => identifierize(d.slug)))

function buildAutoLoadPlan(
	missingRefs: Array<string>,
	chartOptionsMap: ChartOptionsMap,
	extraKnown: ReadonlySet<string>
): Array<AutoLoadStep> {
	const steps: Array<AutoLoadStep> = []
	for (const ref of missingRefs) {
		if (extraKnown.has(ref)) continue
		const match = matchTableRef(ref)
		if (!match) continue
		if (match.kind === 'dataset') {
			steps.push({
				key: `auto-${ref}`,
				name: ref,
				label: match.definition.name,
				source: { kind: 'dataset', slug: match.slug }
			})
			continue
		}
		const options = chartOptionsMap[match.definition.slug] ?? []
		const resolvedOption = options.find((opt) => identifierize(opt.value) === match.paramIdentifier)
		if (!resolvedOption) {
			throw new Error(
				`Table "${ref}" — couldn't resolve ${match.definition.paramLabel.toLowerCase()} "${match.paramIdentifier}" for ${match.definition.name}. Use "add" to browse valid options.`
			)
		}
		steps.push({
			key: `auto-${ref}`,
			name: ref,
			label: `${match.definition.name} · ${resolvedOption.label}`,
			source: {
				kind: 'chart',
				slug: match.definition.slug,
				param: resolvedOption.value,
				paramLabel: resolvedOption.label
			}
		})
	}
	return steps
}

async function runWithFreshLoadRetry(
	conn: AsyncDuckDBConnection,
	sql: string,
	justLoaded: boolean,
	signal?: AbortSignal
): Promise<Table> {
	try {
		return await queryDuckDB(conn, sql, signal)
	} catch (error) {
		if (signal?.aborted || !justLoaded) throw error
		const msg = error instanceof Error ? error.message : String(error)
		const transient = /function signature mismatch/i.test(msg)
		if (!transient) throw error
		await new Promise((resolve) => setTimeout(resolve, 60))
		return await queryDuckDB(conn, sql, signal)
	}
}

function cancelled(error = 'Cancelled'): ExecutorResult {
	return { ok: false, error, cancelled: true }
}

function isAbortError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError'
}

/**
 * Shared SQL execution path used by query tabs and notebook cells.
 * - Extracts table refs from SQL
 * - Auto-loads missing datasets (skipping any names in `skipAutoLoad`)
 * - Executes the query and returns rows/columns
 * - Respects `signal` for cancellation: best-effort conn.cancelSent() on abort,
 *   and the returned result carries `cancelled: true` so callers can skip error UI.
 */
export async function runSql(
	ctx: ExecutorCtx,
	sql: string,
	callbacks: ExecutorCallbacks = {},
	skipAutoLoad: ReadonlySet<string> = new Set(),
	signal?: AbortSignal
): Promise<ExecutorResult> {
	if (!ctx.conn) return { ok: false, error: 'LlamaSQL connection not ready.' }
	if (signal?.aborted) return cancelled()
	const trimmed = sql.trim()
	if (!trimmed) return { ok: false, error: 'Empty query.' }

	trackUmamiEvent('sql-studio-run-query')

	const started = performance.now()
	try {
		const referenced = extractTableRefs(trimmed)
		const loadedNames = new Set(ctx.loadedTables.map((t) => t.name))
		const missingRefs = referenced.filter((r) => !loadedNames.has(r) && !skipAutoLoad.has(r))

		const plan = buildAutoLoadPlan(missingRefs, ctx.chartOptionsMap, skipAutoLoad)
		if (plan.length > 0) {
			callbacks.onPendingChange?.(plan.map((p) => ({ key: p.key, name: p.name, label: p.label, status: 'pending' })))
		}

		let pending: Array<PendingTable> = plan.map((p) => ({
			key: p.key,
			name: p.name,
			label: p.label,
			status: 'pending'
		}))

		for (const [index, step] of plan.entries()) {
			if (signal?.aborted) {
				callbacks.onLoadingStage?.(null)
				return cancelled()
			}
			pending = pending.map((p) => (p.key === step.key ? { ...p, status: 'loading' } : p))
			callbacks.onPendingChange?.(pending)
			const stagePrefix =
				plan.length > 1 ? `Loading ${step.label} · ${index + 1}/${plan.length}` : `Loading ${step.label}`
			// No ellipsis: ResultsPanel's loading part draws its own dots; plain-text readers add one.
			callbacks.onLoadingStage?.(stagePrefix)

			const loaded = await ctx.loadSource(step.source, signal)
			if (signal?.aborted) {
				callbacks.onLoadingStage?.(null)
				return cancelled()
			}
			if (!loaded) {
				pending = pending.map((p) => (p.key === step.key ? { ...p, status: 'failed' } : p))
				callbacks.onPendingChange?.(pending)
				callbacks.onLoadingStage?.(null)
				return { ok: false, error: `Could not auto-load table "${step.name}" (${step.label}).` }
			}
			pending = pending.filter((p) => p.key !== step.key)
			callbacks.onPendingChange?.(pending)
		}
		callbacks.onLoadingStage?.(null)

		const conn = ctx.conn
		const arrow = await runWithFreshLoadRetry(conn, trimmed, plan.length > 0, signal)

		const columns = arrow.schema.fields.map((f: any) => ({ name: f.name, type: String(f.type) }))
		const arrowRows = arrow.toArray()
		const rows = new Array<Array<unknown>>(arrowRows.length)
		for (let rowIndex = 0; rowIndex < arrowRows.length; rowIndex++) {
			const input = arrowRows[rowIndex]
			const row = new Array<unknown>(columns.length)
			for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
				row[columnIndex] = input[columns[columnIndex].name] ?? null
			}
			rows[rowIndex] = row
		}
		const result = normalizeSqlResultRows({ columns, rows })
		const durationMs = Math.round(performance.now() - started)
		return {
			ok: true,
			result,
			durationMs,
			justLoaded: plan.length > 0
		}
	} catch (error) {
		callbacks.onLoadingStage?.(null)
		if (isAbortError(error) || signal?.aborted) return cancelled()
		return { ok: false, error: error instanceof Error ? error.message : String(error) }
	}
}

export { buildAutoLoadPlan, tableNameFor, prettyLabelForSource, KNOWN_DATASET_IDENTIFIERS }
