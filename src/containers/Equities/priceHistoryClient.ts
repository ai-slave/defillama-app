import { fetchJson } from '~/utils/async'
import type { EquitiesPriceHistory, EquitiesPriceHistoryTimeframe } from './api.types'

export async function fetchEquitiesPriceHistoryFromProxy(
	ticker: string,
	country: string,
	timeframe: EquitiesPriceHistoryTimeframe
): Promise<EquitiesPriceHistory> {
	const params = new URLSearchParams({ ticker, country, timeframe })
	return fetchJson<EquitiesPriceHistory>(`/api/public/equities/price-history?${params.toString()}`)
}
