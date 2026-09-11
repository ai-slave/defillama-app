import { cachedResult } from '~/server/api/resultCache'
import {
	fetchReportedPoolDetail,
	fetchReportedPoolHistory,
	fetchVerifiedPoolDetail,
	fetchVerifiedPoolHistory,
	mergePoolVerifiedHistory
} from './fetch'
import type { PoolDetail, PoolHistory, PoolHistoryRange } from './types'

// Server-side memo over the upstream detail/history endpoints. The payloads are the same for
// every caller — the gate is applied after them — so one fetch serves both the page render and
// the private route that fills in its measured half.
const MEMORY = { ttlMs: 5 * 60 * 1000, ttlJitter: 0.2, maxEntries: 64, maxBytes: 64 * 1024 * 1024 }

function fetchReportedPoolDetailCached(id: string): Promise<PoolDetail> {
	return cachedResult(
		'yields:pool-detail',
		id,
		MEMORY,
		() => fetchReportedPoolDetail(id),
		() => 4 * 1024
	)
}

function fetchVerifiedPoolDetailCached(id: string) {
	return cachedResult(
		'yields:pool-verified-detail',
		id,
		MEMORY,
		() => fetchVerifiedPoolDetail(id),
		() => 4 * 1024
	)
}

/** Detail callers opt into the verified sidecar only after establishing that the pool is measured. */
export async function fetchPoolDetailCached(id: string, includeVerified = false): Promise<PoolDetail> {
	const [pool, verified] = await Promise.all([
		fetchReportedPoolDetailCached(id),
		includeVerified ? fetchVerifiedPoolDetailCached(id) : Promise.resolve(null)
	])
	return verified ? { ...pool, verified } : pool
}

function fetchReportedPoolHistoryCached(id: string, range: PoolHistoryRange): Promise<PoolHistory> {
	return cachedResult(
		'yields:pool-history',
		`${id}:${range}`,
		MEMORY,
		() => fetchReportedPoolHistory(id, range),
		(history) => history.length * 256 + 256
	)
}

function fetchVerifiedPoolHistoryCached(id: string, range: PoolHistoryRange) {
	return cachedResult(
		'yields:pool-verified-history',
		`${id}:${range}`,
		MEMORY,
		() => fetchVerifiedPoolHistory(id, range),
		(history) => (history?.length ?? 0) * 256 + 256
	)
}

export async function fetchPoolHistoryCached(
	id: string,
	range: PoolHistoryRange,
	includeVerified = false
): Promise<PoolHistory> {
	const [history, verified] = await Promise.all([
		fetchReportedPoolHistoryCached(id, range),
		includeVerified ? fetchVerifiedPoolHistoryCached(id, range) : Promise.resolve(null)
	])
	return mergePoolVerifiedHistory(history, verified)
}
