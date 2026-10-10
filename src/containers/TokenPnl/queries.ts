import { fetchCoinsChart } from '~/api'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_DOWN, CHART_UP } from '~/constants/colors'
import type { ComparisonEntry, PricePoint, TimelinePoint } from './types'

const DAY_IN_SECONDS = 86_400

export type TokenPnlResult = {
	priceSeries: Array<PricePoint>
	timeline: Array<TimelinePoint>
	metrics: {
		startPrice: number
		endPrice: number
		percentChange: number
		absoluteChange: number
		maxDrawdown: number
		volatility: number
		rangeHigh: number
		rangeLow: number
		holdingPeriodDays: number
		/** null under a year: the window's return is not annualised. */
		annualizedReturn: number | null
	}
	currentPrice: number
	chartData: { dataset: IMultiSeriesChartProps['dataset']; charts: IMultiSeriesChartProps['charts'] }
	yAxisConfig: {
		min: number
		max: number
		interval: number
	}
}

export type TokenPnlComparisonResult = Pick<
	ComparisonEntry,
	'id' | 'percentChange' | 'absoluteChange' | 'startPrice' | 'endPrice'
>

export function formatPriceSeriesFromCoinsChart(
	prices: Array<{ timestamp: number; price: number }> | undefined
): Array<PricePoint> {
	return prices ?? []
}

export function buildAscendingPriceChartSource(series: Array<PricePoint>, start: number, end: number) {
	const source: Array<[number, number]> = []
	const firstPrice = series[0].price
	const lastPrice = series[series.length - 1].price
	let addedStart = false
	let addedEnd = false
	const pushPoint = (timestamp: number, price: number) => source.push([timestamp * 1e3, price])

	// The API series is ascending. Merge the two synthetic range boundaries into that stream
	// instead of sorting the completed array, including when search-width points cross a boundary.
	for (const point of series) {
		if (!addedStart && start < point.timestamp) {
			pushPoint(start, firstPrice)
			addedStart = true
		}
		if (!addedEnd && end < point.timestamp) {
			pushPoint(end, lastPrice)
			addedEnd = true
		}
		if (point.timestamp === start) addedStart = true
		if (point.timestamp === end) addedEnd = true
		pushPoint(point.timestamp, point.price)
	}

	if (!addedStart) pushPoint(start, firstPrice)
	if (!addedEnd) pushPoint(end, lastPrice)
	return source
}

export async function fetchPriceSeries(
	tokenId: string,
	start: number | null,
	end: number | null
): Promise<Array<PricePoint>> {
	if (!tokenId || start == null || end == null || end <= start) return []
	const key = `coingecko:${tokenId}`
	const rangeSeconds = end - start
	const intervalSeconds =
		rangeSeconds <= 7 * DAY_IN_SECONDS ? 3600 : rangeSeconds <= 90 * DAY_IN_SECONDS ? 14_400 : DAY_IN_SECONDS
	const span = Math.max(1, Math.min(5000, Math.ceil(rangeSeconds / intervalSeconds)))
	const response = await fetchCoinsChart({
		coin: key,
		start,
		span,
		searchWidth: '600'
	})
	return formatPriceSeriesFromCoinsChart(response?.coins?.[key]?.prices)
}

const calculateMaxDrawdown = (series: Array<PricePoint>): number => {
	if (series.length === 0) return 0
	let peak = series[0].price
	let maxDrawdown = 0
	for (const point of series) {
		if (point.price > peak) {
			peak = point.price
			continue
		}
		if (peak === 0) continue
		const drawdown = ((point.price - peak) / peak) * 100
		if (drawdown < maxDrawdown) maxDrawdown = drawdown
	}
	return Math.abs(maxDrawdown)
}

const SECONDS_PER_YEAR = 365 * DAY_IN_SECONDS

const calculateAnnualizedVolatility = (series: Array<PricePoint>): number => {
	if (series.length < 2) return 0
	const returns: Array<number> = []
	let totalDeltaSec = 0
	let deltaCount = 0
	for (let i = 1; i < series.length; i++) {
		const prev = series[i - 1]
		const curr = series[i]
		if (prev.price === 0 || !Number.isFinite(prev.price) || !Number.isFinite(curr.price)) continue
		returns.push((curr.price - prev.price) / prev.price)
		const dt = curr.timestamp - prev.timestamp
		if (Number.isFinite(dt) && dt > 0) {
			totalDeltaSec += dt
			deltaCount++
		}
	}
	if (returns.length < 2) return 0
	const avgIntervalSec = deltaCount > 0 ? totalDeltaSec / deltaCount : DAY_IN_SECONDS
	const periodsPerYear = SECONDS_PER_YEAR / avgIntervalSec
	const mean = returns.reduce((acc, value) => acc + value, 0) / returns.length
	const variance = returns.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (returns.length - 1 || 1)
	const periodVol = Math.sqrt(variance)
	return periodVol * Math.sqrt(periodsPerYear) * 100
}

const calculateYAxisConfigFromPrices = (
	rangeLow: number,
	rangeHigh: number
): { min: number; max: number; interval: number } => {
	if (!Number.isFinite(rangeLow) || !Number.isFinite(rangeHigh)) return { min: 0, max: 0, interval: 1000 }

	const min = rangeLow
	const max = rangeHigh
	const range = max - min

	if (range === 0) {
		const padding = max === 0 ? 1 : Math.abs(max) * 0.1
		return {
			min: Math.min(0, min - padding),
			max: max + padding,
			interval: padding
		}
	}

	const magnitude = 10 ** Math.floor(Math.log10(range))
	const normalized = range / magnitude
	const interval =
		normalized <= 1 ? magnitude * 0.2 : normalized <= 2 ? magnitude * 0.5 : normalized <= 5 ? magnitude : magnitude * 2

	return {
		min: Math.floor(min / interval) * interval,
		max: Math.ceil(max / interval) * interval,
		interval
	}
}

export async function computeTokenPnl(params: {
	id: string
	start: number | null
	end: number | null
}): Promise<TokenPnlResult | null> {
	const { id, start, end } = params
	if (!id || start == null || end == null || end <= start) return null

	const series = await fetchPriceSeries(id, start, end)
	if (series.length === 0) {
		return {
			priceSeries: [],
			timeline: [],
			metrics: {
				startPrice: 0,
				endPrice: 0,
				percentChange: 0,
				absoluteChange: 0,
				maxDrawdown: 0,
				volatility: 0,
				rangeHigh: 0,
				rangeLow: 0,
				holdingPeriodDays: 0,
				annualizedReturn: null
			},
			currentPrice: 0,
			chartData: {
				dataset: { source: [], dimensions: ['timestamp', 'Token Price'] },
				charts: [
					{
						type: 'line' as const,
						name: 'Token Price',
						encode: { x: 'timestamp', y: 'Token Price' },
						stack: 'Token Price',
						color: CHART_UP
					}
				]
			},
			yAxisConfig: { min: 0, max: 0, interval: 1000 }
		}
	}

	const startPrice = series[0].price
	const endPrice = series[series.length - 1].price
	const percentChange = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0
	const absoluteChange = endPrice - startPrice
	const holdingPeriodDays = Math.max(1, Math.round((end - start) / DAY_IN_SECONDS))
	// A return is annualised only over a year or more, as the GIPS standard requires. Compounding a shorter window to a
	// year turns a 5% week into over +1,000% and a big one-day move into Infinity. The floor keeps a total loss at -100%.
	const annualizedReturn =
		holdingPeriodDays >= 365
			? (Math.max(Number.EPSILON, 1 + percentChange / 100) ** (365 / holdingPeriodDays) - 1) * 100
			: null

	const timeline: Array<TimelinePoint> = []
	let rangeHigh = Number.NEGATIVE_INFINITY
	let rangeLow = Number.POSITIVE_INFINITY

	for (let index = 0; index < series.length; index++) {
		const point = series[index]
		if (point.price > rangeHigh) rangeHigh = point.price
		if (point.price < rangeLow) rangeLow = point.price
		if (index === 0) {
			timeline.push({ ...point, change: 0, percentChange: 0 })
		} else {
			const prev = series[index - 1]
			const delta = point.price - prev.price
			const pct = prev.price !== 0 ? (delta / prev.price) * 100 : 0
			timeline.push({ ...point, change: delta, percentChange: pct })
		}
	}

	const chartData = {
		dataset: {
			source: buildAscendingPriceChartSource(series, start, end),
			dimensions: ['timestamp', 'Token Price']
		},
		charts: [
			{
				type: 'line' as const,
				name: 'Token Price',
				encode: { x: 0, y: 1 },
				stack: 'Token Price',
				// The line and its area fill take the period's direction. The result is cached across theme
				// changes, so it uses the fixed fills rather than the mode-aware line colours.
				color: endPrice >= startPrice ? CHART_UP : CHART_DOWN
			}
		]
	}

	return {
		priceSeries: series,
		timeline,
		metrics: {
			startPrice,
			endPrice,
			percentChange,
			absoluteChange,
			maxDrawdown: calculateMaxDrawdown(series),
			volatility: calculateAnnualizedVolatility(series),
			rangeHigh,
			rangeLow,
			holdingPeriodDays,
			annualizedReturn
		},
		currentPrice: endPrice,
		chartData,
		yAxisConfig: calculateYAxisConfigFromPrices(rangeLow, rangeHigh)
	}
}

export async function buildComparisonEntry(params: {
	tokenId: string
	start: number | null
	end: number | null
}): Promise<TokenPnlComparisonResult | null> {
	const { tokenId, start, end } = params
	const series = await fetchPriceSeries(tokenId, start, end)
	if (series.length === 0) return null

	const startPrice = series[0].price
	const endPrice = series[series.length - 1].price
	const percentChange = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0
	const absoluteChange = endPrice - startPrice

	return {
		id: tokenId,
		percentChange,
		absoluteChange,
		startPrice,
		endPrice
	}
}
