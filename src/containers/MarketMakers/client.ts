import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { toQueryString } from '~/utils/routerQuery'
import { type BreakdownPayloads, reconstructBreakdown, type ReconstructedBreakdown } from './breakdown'
import { mergePerformanceIndex, type PerformanceIndexProps } from './PerformanceIndex/data'
import type { LeaderboardRow } from './types'

export type LeaderboardRange = { start_date?: string; end_date?: string }

// Temporary CDN cache bust; remove when Cloudflare purge covers these routes.
function withCacheNonce(url: string) {
	const nonce = String(Date.now())
	return url.includes('?') ? `${url}&_n=${nonce}` : `${url}?_n=${nonce}`
}

function fetchFreshJson<T>(url: string) {
	return fetchJson<T>(withCacheNonce(url))
}

/** `initialData` is the server's rows for the default timeframe; pass it only while that timeframe is selected. */
export function usePerformanceIndex(range: LeaderboardRange, initialData: PerformanceIndexProps | undefined) {
	const queryString = toQueryString(range)
	return useQuery<PerformanceIndexProps, Error>({
		queryKey: ['market-makers', 'performance-index', range.start_date ?? null, range.end_date ?? null],
		queryFn: async () => {
			const [performance, aggregated] = await Promise.all([
				fetchFreshJson<unknown>(`/api/public/market-makers/performance${queryString}`),
				fetchFreshJson<unknown>(`/api/public/market-makers/aggregated${queryString}`)
			])
			return mergePerformanceIndex(performance, aggregated)
		},
		initialData,
		placeholderData: keepPreviousData,
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		retry: 1
	})
}

export function useLeaderboardRows(
	fetchPath: string,
	range: LeaderboardRange,
	initialData: unknown,
	shape: (raw: unknown) => Array<LeaderboardRow>
) {
	const queryString = toQueryString(range)
	return useQuery<unknown, Error, Array<LeaderboardRow>>({
		queryKey: ['market-makers', fetchPath, range.start_date ?? null, range.end_date ?? null],
		queryFn: () => fetchFreshJson<unknown>(`/api/public/market-makers/${fetchPath}${queryString}`),
		select: shape,
		initialData,
		placeholderData: keepPreviousData,
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		retry: 1
	})
}

type MMRecord = Record<string, unknown>

function findById(data: unknown, key: string, id: string | null): MMRecord | null {
	if (!Array.isArray(data) || id == null) return null
	return (data.find((row) => row && typeof row === 'object' && (row as MMRecord)[key] === id) as MMRecord) ?? null
}

// The per-id Forgd endpoints (details/breakdown/performance by id) can be unavailable
// upstream; details + performance are derived from the stable all-list endpoints so the
// detail drawer keeps working.
export function useMarketMakerDetail(id: string | null, enabled: boolean) {
	return useQuery<unknown, Error, MMRecord | null>({
		queryKey: ['market-makers', 'details-all'],
		queryFn: () => fetchFreshJson<unknown>('/api/public/market-makers/details'),
		select: (data) => findById(data, 'id', id),
		enabled: enabled && !!id,
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		retry: 1
	})
}

// Forgd's breakdown/{id} endpoint can be unavailable upstream; the per-board ranks and
// detailed KPI matrices are reconstructed from the stable all-list leaderboard endpoints.
export function useMarketMakerBreakdown(id: string | null, range: LeaderboardRange, enabled: boolean) {
	const queryString = toQueryString(range)
	return useQuery<BreakdownPayloads, Error, ReconstructedBreakdown>({
		queryKey: ['market-makers', 'breakdown-all', range.start_date ?? null, range.end_date ?? null],
		queryFn: async () => {
			const [aggregated, depth, volume, spread, kpi] = await Promise.all([
				fetchFreshJson<unknown>(`/api/public/market-makers/aggregated${queryString}`),
				fetchFreshJson<unknown>(`/api/public/market-makers/depth${queryString}`),
				fetchFreshJson<unknown>(`/api/public/market-makers/volume${queryString}`),
				fetchFreshJson<unknown>(`/api/public/market-makers/spread${queryString}`),
				fetchFreshJson<unknown>(`/api/public/market-makers/kpi${queryString}`)
			])
			return { aggregated, depth, volume, spread, kpi }
		},
		select: (data) => reconstructBreakdown(id, data),
		enabled: enabled && !!id,
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		retry: 1
	})
}

export type LeadKind = 'connect' | 'claim'

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).catch(() => {
		throw new Error("Couldn't submit the request.")
	})
	const data = await res.json().catch(() => null)
	if (!res.ok) {
		if (res.status === 429) throw new Error('Too many requests. Try again in a few minutes.')
		// A 4xx names the field the route refused; a 5xx body is not written for readers.
		const message = res.status < 500 && data && typeof data.error === 'string' ? data.error : null
		throw new Error(message ?? "Couldn't submit the request.")
	}
	return data as T
}

export async function requestLeadClickId(kind: LeadKind, marketMakerId: string | null): Promise<string | null> {
	try {
		const res = await postJson<{ clickId: string | null }>('/api/public/market-makers/cta', {
			kind,
			market_maker_id: marketMakerId,
			source_url: typeof window === 'undefined' ? null : window.location.href
		})
		return res.clickId
	} catch {
		return null
	}
}

export function useSubmitLead(kind: LeadKind) {
	return useMutation({
		mutationFn: (payload: Record<string, unknown>) =>
			postJson<{ status: string; request_id: string }>(`/api/public/market-makers/lead/${kind}`, payload)
	})
}

export function useMarketMakerPerformance(id: string | null, range: LeaderboardRange, enabled: boolean) {
	const queryString = toQueryString(range)
	return useQuery<unknown, Error, MMRecord | null>({
		queryKey: ['market-makers', 'performance-all', range.start_date ?? null, range.end_date ?? null],
		queryFn: () => fetchFreshJson<unknown>(`/api/public/market-makers/performance${queryString}`),
		select: (data) => findById(data, 'marketMakerId', id),
		enabled: enabled && !!id,
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		retry: 1
	})
}
