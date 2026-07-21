import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeSqlResultRows } from '~/containers/Downloads/sql/resultNormalization'
import { captureSnapshot } from '~/containers/ProDashboard/components/SqlChart/snapshot'
import type { SqlChartConfig, SqlSnapshot } from '~/containers/ProDashboard/types'
import { authorizationHeader, featuresServerUrl, parseJsonObject } from '~/server/dashboardPurgeProxy'
import { hashSqlQuery } from '~/server/sql/queryHash'
import { getStoredSqlResult, putStoredSqlResult } from '~/server/sql/resultsStore'
import { runServerSql, SqlQueueFullError } from '~/server/sql/runner'
import { withApiRouteTelemetry } from '~/utils/telemetry'

const SQL_RESULT_TTL_MS = 60 * 60 * 1000

const inFlightRuns = new Map<string, Promise<SqlSnapshot>>()

function queryParam(req: NextApiRequest, name: string): string | null {
	const value = req.query[name]
	if (Array.isArray(value)) return value[0] || null
	return typeof value === 'string' && value ? value : null
}

function isFresh(computedAt: string): boolean {
	const timestamp = new Date(computedAt).getTime()
	if (Number.isNaN(timestamp)) return false
	return Date.now() - timestamp < SQL_RESULT_TTL_MS
}

function findSqlItem(dashboard: Record<string, unknown>, itemId: string): SqlChartConfig | null {
	const data = dashboard.data as { items?: unknown[] } | undefined
	if (!Array.isArray(data?.items)) return null
	for (const item of data.items) {
		if (
			item &&
			typeof item === 'object' &&
			(item as { id?: unknown }).id === itemId &&
			(item as { kind?: unknown }).kind === 'sql'
		) {
			return item as SqlChartConfig
		}
	}
	return null
}

async function executeAndStore(hash: string, item: SqlChartConfig): Promise<SqlSnapshot> {
	const pending = inFlightRuns.get(hash)
	if (pending) return pending

	const promise = (async () => {
		const serverResult = await runServerSql(item.query)
		const rows = new Array<unknown[]>(serverResult.rows.length)
		for (let rowIndex = 0; rowIndex < serverResult.rows.length; rowIndex++) {
			const input = serverResult.rows[rowIndex]
			const row = new Array<unknown>(serverResult.columns.length)
			for (let columnIndex = 0; columnIndex < serverResult.columns.length; columnIndex++) {
				row[columnIndex] = input[serverResult.columns[columnIndex].name]
			}
			rows[rowIndex] = row
		}
		const result = normalizeSqlResultRows({ columns: serverResult.columns, rows })
		const snapshot = captureSnapshot(result, 'server', undefined, item.rowCap)
		await putStoredSqlResult(hash, snapshot)
		return snapshot
	})().finally(() => {
		inFlightRuns.delete(hash)
	})

	inFlightRuns.set(hash, promise)
	return promise
}

export async function sqlRunHandler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const dashboardId = queryParam(req, 'dashboardId')
	const itemId = queryParam(req, 'itemId')
	if (!dashboardId || !itemId) {
		res.setHeader('Cache-Control', 'no-store')
		return res.status(400).json({ error: 'Missing dashboardId or itemId' })
	}

	const dashboardResponse = await fetch(featuresServerUrl(`/dashboards/${encodeURIComponent(dashboardId)}`), {
		headers: authorizationHeader(req),
		signal: AbortSignal.timeout(15_000)
	})
	if (!dashboardResponse.ok) {
		res.setHeader('Cache-Control', 'no-store')
		const status = dashboardResponse.status === 401 ? 401 : 404
		return res.status(status).json({ error: 'Dashboard not found' })
	}

	const dashboard = parseJsonObject(await dashboardResponse.text())
	if (!dashboard) {
		res.setHeader('Cache-Control', 'no-store')
		return res.status(502).json({ error: 'Dashboard response was not valid JSON' })
	}

	const item = findSqlItem(dashboard, itemId)
	if (!item) {
		res.setHeader('Cache-Control', 'no-store')
		return res.status(404).json({ error: 'SQL widget not found on dashboard' })
	}

	const hash = hashSqlQuery(item.query)
	const stored = await getStoredSqlResult(hash)
	if (stored && isFresh(stored.computedAt)) {
		res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
		return res.status(200).json(stored.snapshot)
	}

	try {
		const snapshot = await executeAndStore(hash, item)
		res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
		return res.status(200).json(snapshot)
	} catch (error) {
		res.setHeader('Cache-Control', 'no-store')
		if (error instanceof SqlQueueFullError) {
			res.setHeader('Retry-After', '5')
			return res.status(429).json({ error: error.message })
		}
		const message = error instanceof Error ? error.message : 'SQL execution failed'
		if (stored) {
			return res.status(200).json({ ...stored.snapshot, error: message })
		}
		return res.status(502).json({ error: message })
	}
}

export default withApiRouteTelemetry('/api/private/pro-dashboard/sql-run', sqlRunHandler)
