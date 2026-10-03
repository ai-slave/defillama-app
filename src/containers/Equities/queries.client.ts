import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION } from './tableQuery'
import type { EquitiesTableResponse, EquitiesTreemapResponse, IEquitiesCalendarData } from './types'

export const EQUITIES_API = '/api/public/equities'
export const EQUITIES_MARKET_MAP_API = '/api/public/equities/market-map'
export const EQUITIES_EARNINGS_CALENDAR_ROUTE = '/api/public/equities/earnings-calendar'

export interface EquitiesCalendarResponse extends IEquitiesCalendarData {
	generatedAt: number
	stale: boolean
	todayET: string
}

export interface EquitiesTableSeed {
	initialData: EquitiesTableResponse
	initialDataUpdatedAt: number
}

export function useEquitiesPaginatedTable(queryString: string | null, seed?: EquitiesTableSeed) {
	const url = queryString == null ? null : `${EQUITIES_API}${queryString}`
	return useQuery<EquitiesTableResponse>({
		queryKey: ['equities-page', EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION, queryString],
		// ISR-provided first page of the default view renders with zero fetches while fresh.
		...(seed ? { initialData: seed.initialData, initialDataUpdatedAt: seed.initialDataUpdatedAt } : {}),
		queryFn: async ({ signal }) => fetchJson<EquitiesTableResponse>(url!, { signal }),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: url != null
	})
}

export function useEquitiesTreemapDataset(queryString: string | null) {
	return useQuery<EquitiesTreemapResponse>({
		queryKey: ['equities-market-map', EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) =>
			fetchJson<EquitiesTreemapResponse>(`${EQUITIES_MARKET_MAP_API}${queryString}`, { signal }),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: queryString != null
	})
}

export function useEquitiesEarningsCalendar() {
	return useQuery<EquitiesCalendarResponse>({
		queryKey: ['equities-earnings-calendar'],
		queryFn: async ({ signal }) => fetchJson<EquitiesCalendarResponse>(EQUITIES_EARNINGS_CALENDAR_ROUTE, { signal }),
		staleTime: 60 * 60 * 1000,
		refetchInterval: 30 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}
