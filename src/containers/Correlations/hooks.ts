import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import type { CgChartResponse } from '~/api/coingecko.types'
import { fetchJson } from '~/utils/async'
import { toQueryString } from '~/utils/routerQuery'
import {
	CORRELATION_TOKEN_PICKER_LIMIT,
	type CorrelationTokenOption,
	type CorrelationTokenPickerResponse
} from './types'

const CORRELATION_TOKENS_API = '/api/public/correlation/tokens'

export interface PricePoint {
	timestamp: number
	price: number
}

export const usePriceCharts = (geckoIds: string[]) => {
	const data = useQueries({
		queries: geckoIds.map((id) => ({
			queryKey: ['price_chart', id],
			queryFn: (): Promise<CgChartResponse | null> =>
				fetchCoinGeckoChartByIdWithCacheFallback(id, { fullChart: false }),
			staleTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0
		}))
	})

	return {
		data: Object.fromEntries(
			data.map((res, i) => {
				const points: PricePoint[] =
					res.data?.data?.prices?.reduce<PricePoint[]>((acc, point) => {
						const [timestamp, price] = point
						if (Number.isFinite(timestamp) && Number.isFinite(price)) {
							acc.push({ timestamp, price })
						}
						return acc
					}, []) ?? []

				points.sort((a, b) => a.timestamp - b.timestamp)
				return [geckoIds[i], points]
			})
		),
		isLoading: data.some((res) => res.isLoading)
	}
}

function fetchCorrelationTokenOptions(
	query: Record<string, string | undefined>,
	signal?: AbortSignal
): Promise<CorrelationTokenPickerResponse> {
	return fetchJson<CorrelationTokenPickerResponse>(`${CORRELATION_TOKENS_API}${toQueryString(query)}`, { signal })
}

export function useCorrelationTokenPicker(search: string, enabled: boolean, initialTokens: CorrelationTokenOption[]) {
	const normalizedSearch = search.trim()
	const initialData =
		normalizedSearch === ''
			? {
					pages: [
						{
							tokens: initialTokens,
							offset: 0,
							limit: CORRELATION_TOKEN_PICKER_LIMIT,
							total: initialTokens.length,
							nextOffset:
								initialTokens.length === CORRELATION_TOKEN_PICKER_LIMIT ? CORRELATION_TOKEN_PICKER_LIMIT : null
						}
					],
					pageParams: [0]
				}
			: undefined

	const query = useInfiniteQuery({
		queryKey: ['correlation-token-picker', normalizedSearch],
		queryFn: ({ pageParam, signal }) =>
			fetchCorrelationTokenOptions(
				{
					q: normalizedSearch || undefined,
					offset: String(pageParam),
					limit: String(CORRELATION_TOKEN_PICKER_LIMIT)
				},
				signal
			),
		initialPageParam: 0,
		initialData,
		getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
		enabled,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const tokens = useMemo(() => query.data?.pages.flatMap((page) => page.tokens) ?? [], [query.data])

	return {
		...query,
		tokens
	}
}

export function useCorrelationTokensByIds(ids: string[], enabled: boolean) {
	const idsParam = ids.join(',')

	return useQuery({
		queryKey: ['correlation-token-picker', 'ids', idsParam],
		queryFn: ({ signal }) => fetchCorrelationTokenOptions({ ids: idsParam }, signal),
		enabled: enabled && ids.length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}
