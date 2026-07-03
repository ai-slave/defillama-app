import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { toQueryString } from '~/utils/routerQuery'
import { type BreakdownPayloads, reconstructBreakdown, type ReconstructedBreakdown } from './breakdown'
import { mergePerformanceIndex, type PerformanceIndexProps } from './PerformanceIndex/data'
import { isDefaultRange } from './timeframe'
import type { LeaderboardRow } from './types'

export type LeaderboardRange = { start_date?: string; end_date?: string }

export function usePerformanceIndex(range: LeaderboardRange, initialData: PerformanceIndexProps) {
	const queryString = toQueryString(range)
	return useQuery<PerformanceIndexProps, Error>({
		queryKey: ['market-makers', 'performance-index', range.start_date ?? null, range.end_date ?? null],
		queryFn: async () => {
			const [performance, aggregated] = await Promise.all([
				fetchJson<unknown>(`/api/public/market-makers/performance${queryString}`),
				fetchJson<unknown>(`/api/public/market-makers/aggregated${queryString}`)
			])
			return mergePerformanceIndex(performance, aggregated)
		},
		initialData: isDefaultRange(range) ? initialData : undefined,
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}

export function useLeaderboardRows(
	fetchPath: string,
	range: LeaderboardRange,
	initialData: unknown,
	shape: (raw: unknown) => LeaderboardRow[]
) {
	const queryString = toQueryString(range)
	return useQuery<unknown, Error, LeaderboardRow[]>({
		queryKey: ['market-makers', fetchPath, range.start_date ?? null, range.end_date ?? null],
		queryFn: () => fetchJson<unknown>(`/api/public/market-makers/${fetchPath}${queryString}`),
		select: shape,
		initialData: isDefaultRange(range) ? initialData : undefined,
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000,
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
		queryFn: () => fetchJson<unknown>('/api/public/market-makers/details'),
		select: (data) => findById(data, 'id', id),
		enabled: enabled && !!id,
		staleTime: 5 * 60 * 1000,
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
				fetchJson<unknown>(`/api/public/market-makers/aggregated${queryString}`),
				fetchJson<unknown>(`/api/public/market-makers/depth${queryString}`),
				fetchJson<unknown>(`/api/public/market-makers/volume${queryString}`),
				fetchJson<unknown>(`/api/public/market-makers/spread${queryString}`),
				fetchJson<unknown>(`/api/public/market-makers/kpi${queryString}`)
			])
			return { aggregated, depth, volume, spread, kpi }
		},
		select: (data) => reconstructBreakdown(id, data),
		enabled: enabled && !!id,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}

export function useMarketMakerPerformance(id: string | null, range: LeaderboardRange, enabled: boolean) {
	const queryString = toQueryString(range)
	return useQuery<unknown, Error, MMRecord | null>({
		queryKey: ['market-makers', 'performance-all', range.start_date ?? null, range.end_date ?? null],
		queryFn: () => fetchJson<unknown>(`/api/public/market-makers/performance${queryString}`),
		select: (data) => findById(data, 'marketMakerId', id),
		enabled: enabled && !!id,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}
