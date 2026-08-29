import { fetchJson } from '~/utils/async'
import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import type { EquitiesPriceHistory } from './api.types'

export async function fetchEquitiesPriceHistoryFromProxy(
	ticker: string,
	country: string,
	timeframe: PriceChartTimeframe
): Promise<EquitiesPriceHistory> {
	const params = new URLSearchParams({ ticker, country, timeframe })
	return fetchJson<EquitiesPriceHistory>(`/api/public/equities/price-history?${params.toString()}`)
}
