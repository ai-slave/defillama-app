// Detail-page fetchers for the /yields/pool page. These hit the per-id detail
// endpoints directly (they are not dataset-cache artifacts). The API
// rejects `apy_type` / `apy_components` on detail routes (they 400 as unknown
// params) — the response carries every APY variant and the client resolves the view
// with `../data/apy`. Earn detail and history run in both environments (the verified
// badge pulls the detail on hover) and use the allowlisted proxy in the browser;
// borrow-market detail stays server-only.
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { getYieldsHistoryUrl } from '../constants'
import type { VerifiedBlock } from '../data/types'
import type {
	BorrowMarketDetail,
	BorrowMarketHistory,
	PoolDetail,
	PoolHistory,
	PoolHistoryRange,
	VerifiedHistoryRow
} from './types'

export class ApiError extends Error {
	status: number
	url: string

	constructor(status: number, url: string) {
		super(`yields ${status}: ${url}`)
		this.name = 'ApiError'
		this.status = status
		this.url = url
	}
}

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { headers: { Accept: 'application/json' } })
	if (!res.ok) throw new ApiError(res.status, url)
	const body = (await res.json()) as { data: T }
	return body.data
}

// Server only: the browser reaches measured data through the private routes, and the public proxy
// refuses these paths. Few pools are measured, so a 404 is the ordinary case and resolves to null.
async function getVerified<T>(path: string): Promise<T | null> {
	if (typeof window !== 'undefined') return null
	try {
		return await getJson<T>(`${YIELDS_V2_SERVER_URL}${path}`)
	} catch (error) {
		if (isNotFoundError(error)) return null
		throw error
	}
}

export function fetchReportedPoolDetail(id: string): Promise<PoolDetail> {
	const key = encodeURIComponent(id)
	return getJson<PoolDetail>(getYieldsHistoryUrl(`/v2/earn/${key}`))
}

export function fetchVerifiedPoolDetail(id: string): Promise<VerifiedBlock | null> {
	return getVerified<VerifiedBlock>(`/v2/earn/verified/${encodeURIComponent(id)}`)
}

/** Reported detail, optionally joined to the paid measurement sidecar. */
export async function fetchPoolDetail(id: string, options: { includeVerified?: boolean } = {}): Promise<PoolDetail> {
	const [pool, verified] = await Promise.all([
		fetchReportedPoolDetail(id),
		options.includeVerified ? fetchVerifiedPoolDetail(id) : Promise.resolve(null)
	])
	return verified ? { ...pool, verified } : pool
}

/** Flattens a served history row into the shape the charts read. */
function toVerifiedHistoryBlock(row: VerifiedHistoryRow) {
	return {
		apy: row.apy,
		price_per_share: row.price_per_share,
		liquidity_available: row.exit_liquidity?.amount ?? null,
		liquidity_available_usd: row.exit_liquidity?.usd ?? null,
		tvl: row.tvl?.amount ?? null,
		tvl_usd: row.tvl?.usd ?? null,
		exit: row.outcome ? { outcome: row.outcome } : null,
		price_per_share_quoted: row.price_per_share_quoted ?? null,
		reason: row.reason ?? null,
		tvl_quoted: row.tvl_quoted?.amount ?? null,
		tvl_quoted_usd: row.tvl_quoted?.usd ?? null
	}
}

export function fetchReportedPoolHistory(id: string, range: PoolHistoryRange = '30d'): Promise<PoolHistory> {
	const key = encodeURIComponent(id)
	return getJson<PoolHistory>(getYieldsHistoryUrl(`/v2/earn/${key}/history?range=${range}`))
}

export function fetchVerifiedPoolHistory(
	id: string,
	range: PoolHistoryRange = '30d'
): Promise<Array<VerifiedHistoryRow> | null> {
	return getVerified<Array<VerifiedHistoryRow>>(`/v2/earn/verified/${encodeURIComponent(id)}/history?range=${range}`)
}

export function mergePoolVerifiedHistory(
	history: PoolHistory,
	verified: Array<VerifiedHistoryRow> | null
): PoolHistory {
	if (!Array.isArray(verified) || verified.length === 0) return history
	const byDate = new Map<string, ReturnType<typeof toVerifiedHistoryBlock>>()
	for (const row of verified) byDate.set(row.date, toVerifiedHistoryBlock(row))
	// Measured history can predate the reported one; those days get a row with reported fields null.
	const merged = history.map((point) => {
		const block = byDate.get(point.date)
		if (block) byDate.delete(point.date)
		return block ? { ...point, verified: block } : point
	})
	if (byDate.size === 0) return merged
	for (const [date, block] of byDate) {
		merged.push({
			date,
			tvl_usd: null,
			apy: {
				avg_1d: { base: null, reward: null, total: null },
				avg_7d: { base: null, reward: null, total: null },
				avg_30d: { base: null, reward: null, total: null }
			},
			intrinsic: null,
			price_per_share: null,
			verified: block
		})
	}
	return merged.sort((a, b) => a.date.localeCompare(b.date))
}

/** Reported history, optionally joined to the paid measurement series. */
export async function fetchPoolDetailHistory(
	id: string,
	range: PoolHistoryRange = '30d',
	options: { includeVerified?: boolean } = {}
): Promise<PoolHistory> {
	const [history, verified] = await Promise.all([
		fetchReportedPoolHistory(id, range),
		options.includeVerified ? fetchVerifiedPoolHistory(id, range) : Promise.resolve(null)
	])
	return mergePoolVerifiedHistory(history, verified)
}

// Borrow-only markets (not in the earn dataset) fall back to this per-id detail
// endpoint, which returns the full market row: supply/borrow APY windows, sizing,
// LTV and `available_history` for the borrow chart.
export function fetchBorrowMarketDetail(id: string): Promise<BorrowMarketDetail> {
	return getJson<BorrowMarketDetail>(`${YIELDS_V2_SERVER_URL}/v2/borrow/markets/${encodeURIComponent(id)}`)
}

export function fetchBorrowMarketDetailHistory(
	id: string,
	range: PoolHistoryRange = '30d'
): Promise<BorrowMarketHistory> {
	return getJson<BorrowMarketHistory>(
		getYieldsHistoryUrl(`/v2/borrow/markets/${encodeURIComponent(id)}/history?range=${range}`)
	)
}

export function isNotFoundError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 404
}

const POOL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pool ids are UUIDs upstream; anything else is rejected with a 400 there.
export function isPoolId(id: string): boolean {
	return POOL_ID_RE.test(id)
}
