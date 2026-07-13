import type { SqlSnapshot } from '~/containers/ProDashboard/types'
import { featuresServerUrl } from '~/server/dashboardPurgeProxy'

export interface StoredSqlResult {
	snapshot: SqlSnapshot
	computedAt: string
}

function internalKey(): string | null {
	return process.env.SQL_RESULTS_INTERNAL_KEY?.trim() || null
}

function resultUrl(hash: string): string {
	return featuresServerUrl(`/internal/sql-results/${encodeURIComponent(hash)}`)
}

export async function getStoredSqlResult(hash: string): Promise<StoredSqlResult | null> {
	const key = internalKey()
	if (!key) return null
	try {
		const response = await fetch(resultUrl(hash), {
			headers: { 'x-internal-key': key },
			signal: AbortSignal.timeout(10_000)
		})
		if (!response.ok) return null
		const body = (await response.json()) as { result?: unknown; computedAt?: unknown }
		if (!body || typeof body.computedAt !== 'string' || !body.result || typeof body.result !== 'object') {
			return null
		}
		return { snapshot: body.result as SqlSnapshot, computedAt: body.computedAt }
	} catch {
		return null
	}
}

export async function putStoredSqlResult(hash: string, snapshot: SqlSnapshot): Promise<void> {
	const key = internalKey()
	if (!key) return
	try {
		await fetch(resultUrl(hash), {
			method: 'PUT',
			headers: { 'x-internal-key': key, 'Content-Type': 'application/json' },
			body: JSON.stringify({ result: snapshot, computedAt: snapshot.computedAt }),
			signal: AbortSignal.timeout(10_000)
		})
	} catch (error) {
		console.error('Failed to persist sql result:', error)
	}
}
