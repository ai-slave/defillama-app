// Detail-page fetchers for the /yields/pool page. These hit the per-id detail
// endpoints directly (they are not dataset-cache artifacts). The API
// rejects `apy_type` / `apy_components` on detail routes (they 400 as unknown
// params) — the response carries every APY variant and the client resolves the view
// with `../data/apy`. Detail requests are server-only; history requests can also
// run in the browser and use the local proxy there.
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { getYieldsHistoryUrl } from '../constants'
import type { BorrowMarketDetail, BorrowMarketHistory, PoolDetail, PoolHistory, PoolHistoryRange } from './types'

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

export function fetchPoolDetail(id: string): Promise<PoolDetail> {
	return getJson<PoolDetail>(`${YIELDS_V2_SERVER_URL}/v2/earn/${encodeURIComponent(id)}`)
}

export function fetchPoolDetailHistory(id: string, range: PoolHistoryRange = '30d'): Promise<PoolHistory> {
	return getJson<PoolHistory>(getYieldsHistoryUrl(`/v2/earn/${encodeURIComponent(id)}/history?range=${range}`))
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
	return error instanceof ApiError && (error.status === 400 || error.status === 404)
}
