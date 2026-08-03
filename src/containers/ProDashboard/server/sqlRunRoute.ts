import type { NextApiRequest, NextApiResponse } from 'next'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { normalizeSqlResultRows } from '~/containers/Downloads/sql/resultNormalization'
import { captureSnapshot, clampRowCap } from '~/containers/ProDashboard/sqlSnapshot'
import type { SqlQueryRecipe, SqlSnapshot } from '~/containers/ProDashboard/types'
import { authorizationHeader, featuresServerUrl } from '~/server/dashboardPurgeProxy'
import { hashSqlQuery } from '~/server/sql/queryHash'
import { getStoredSqlResult, putStoredSqlResult } from '~/server/sql/resultsStore'
import { runServerSql, SqlQueueFullError } from '~/server/sql/runner'
import { validateSubscription } from '~/utils/apiAuth'
import { withApiRouteTelemetry } from '~/utils/telemetry'
import type { PersistedDashboard } from '../dashboardConfig/persisted'
import { fetchAuthenticatedUserId } from './auth'

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

async function canForceRefresh(req: NextApiRequest, dashboard: PersistedDashboard): Promise<boolean> {
	const authorization = req.headers.authorization
	if (Array.isArray(authorization) || !authorization?.startsWith('Bearer ')) return false
	const token = authorization.slice('Bearer '.length).trim()
	if (!token) return false
	const userId = await fetchAuthenticatedUserId(token)
	if (userId !== dashboard.user) return false
	if (dashboard.visibility === 'public') return true
	return (await validateSubscription(authorization)).valid
}

type SqlRunItem = { query: SqlQueryRecipe; rowCap?: number }

function findSqlItem(dashboard: PersistedDashboard, itemId: string): SqlRunItem | null {
	for (const item of dashboard.data.items) {
		if (item.id === itemId && item.kind === 'sql') {
			return { query: item.query, ...(item.rowCap === undefined ? {} : { rowCap: item.rowCap }) }
		}
	}
	return null
}

async function executeAndStore(hash: string, item: SqlRunItem): Promise<SqlSnapshot> {
	const pending = inFlightRuns.get(hash)
	if (pending) return pending

	const promise = (async () => {
		const serverResult = await runServerSql(item.query)
		const rows: QueryResult['rows'] = new Array(serverResult.rows.length)
		for (let rowIndex = 0; rowIndex < serverResult.rows.length; rowIndex++) {
			const input = serverResult.rows[rowIndex]
			if (input === undefined) throw new Error(`Missing SQL result row ${rowIndex}`)
			const row: QueryResult['rows'][number] = new Array(serverResult.columns.length)
			for (let columnIndex = 0; columnIndex < serverResult.columns.length; columnIndex++) {
				const column = serverResult.columns[columnIndex]
				if (column === undefined) throw new Error(`Missing SQL result column ${columnIndex}`)
				row[columnIndex] = input[column.name]
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
	res.setHeader('Cache-Control', 'private, no-store')
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const dashboardId = queryParam(req, 'dashboardId')
	const itemId = queryParam(req, 'itemId')
	const forceRefresh = queryParam(req, 'refresh') === '1'
	if (!dashboardId || !itemId) {
		return res.status(400).json({ error: 'Missing dashboardId or itemId' })
	}

	const dashboardResponse = await fetch(featuresServerUrl(`/dashboards/${encodeURIComponent(dashboardId)}`), {
		headers: authorizationHeader(req),
		signal: AbortSignal.timeout(15_000)
	})
	if (!dashboardResponse.ok) {
		const status = dashboardResponse.status === 401 ? 401 : 404
		return res.status(status).json({ error: 'Dashboard not found' })
	}

	let dashboard: PersistedDashboard
	try {
		dashboard = await dashboardResponse.json()
	} catch {
		return res.status(502).json({ error: 'Dashboard response was not valid JSON' })
	}
	if (forceRefresh && !(await canForceRefresh(req, dashboard))) {
		return res.status(403).json({ error: 'Only an editor can refresh this SQL widget' })
	}
	const item = findSqlItem(dashboard, itemId)
	if (!item) {
		return res.status(404).json({ error: 'SQL widget not found on dashboard' })
	}

	const hash = hashSqlQuery(item.query, { rowCap: clampRowCap(item.rowCap) })
	const stored = await getStoredSqlResult(hash)
	if (!forceRefresh && stored && isFresh(stored.computedAt)) {
		return res.status(200).json(stored.snapshot)
	}

	try {
		const snapshot = await executeAndStore(hash, item)
		return res.status(200).json(snapshot)
	} catch (error) {
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

export const dashboardSqlRunApiHandler = withApiRouteTelemetry('/api/private/pro-dashboard/sql-run', sqlRunHandler)
