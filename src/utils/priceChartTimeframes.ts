export const PRICE_CHART_TIMEFRAMES = ['24H', '7D', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'] as const

export type PriceChartTimeframe = (typeof PRICE_CHART_TIMEFRAMES)[number]

export const DEFAULT_PRICE_CHART_TIMEFRAME: PriceChartTimeframe = '24H'

export type PriceChartIntradayTimeframe = Extract<PriceChartTimeframe, '24H' | '7D'>

export function parsePriceChartTimeframe(value: string | undefined): PriceChartTimeframe | null {
	if (!value) return null
	return PRICE_CHART_TIMEFRAMES.find((timeframe) => timeframe === value) ?? null
}

export function getPriceChartTimeframe(value: string | undefined): PriceChartTimeframe {
	return parsePriceChartTimeframe(value) ?? DEFAULT_PRICE_CHART_TIMEFRAME
}

export function isPriceChartIntradayTimeframe(
	timeframe: PriceChartTimeframe
): timeframe is PriceChartIntradayTimeframe {
	return timeframe === '24H' || timeframe === '7D'
}
