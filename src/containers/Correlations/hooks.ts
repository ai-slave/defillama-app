import { useQueries } from '@tanstack/react-query'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import type { CgChartResponse } from '~/api/coingecko.types'

export interface PricePoint {
	timestamp: number
	price: number
}

export const usePriceCharts = (geckoIds: Array<string>) => {
	const data = useQueries({
		queries: geckoIds.map((id) => ({
			queryKey: ['price_chart', id],
			queryFn: (): Promise<CgChartResponse | null> => fetchCoinGeckoChartByIdWithCacheFallback(id, { timeframe: '1Y' }),
			staleTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0
		}))
	})

	return {
		data: Object.fromEntries(
			data.map((res, i) => {
				const points: Array<PricePoint> = []
				for (const [timestamp, price] of res.data?.data?.prices ?? []) {
					if (Number.isFinite(timestamp) && Number.isFinite(price)) points.push({ timestamp, price })
				}

				return [geckoIds[i], points]
			})
		),
		isLoading: data.some((res) => res.isLoading)
	}
}
