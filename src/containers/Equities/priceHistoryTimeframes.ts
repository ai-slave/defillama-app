import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'

export type EquitiesPriceHistoryApiTimeframe = Exclude<PriceChartTimeframe, '24H' | '7D'> | '1D' | '1W'

export function toEquitiesPriceHistoryApiTimeframe(timeframe: PriceChartTimeframe): EquitiesPriceHistoryApiTimeframe {
	if (timeframe === '24H') return '1D'
	if (timeframe === '7D') return '1W'
	return timeframe
}
