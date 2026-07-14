import { DAY_MS, findTimeSeriesPointNear, getFreshTimeSeriesCurrentPoint, toUnixMsTimestamp } from '~/utils/timeSeries'
import { fetchCategoryCoinPrices, fetchCategoryInfo, fetchCategoryPerformance, fetchCoinInfo } from './api'
import type { ICategoryInfoApiItem, PriceEntry, TimeSeriesEntry } from './api.types'
import type { CategoryPerformanceProps, IPctChangeRow, PerformanceTimeSeries } from './types'

export async function getCategoryInfo(): Promise<ICategoryInfoApiItem[]> {
	return fetchCategoryInfo()
}

type NarrativePeriod = '7' | '30' | 'ytd' | '365'

function getNarrativePeriodStartTimestamp(currentTimestampMs: number, period: NarrativePeriod): number {
	if (period !== 'ytd') return currentTimestampMs - Number(period) * DAY_MS
	const currentDate = new Date(currentTimestampMs)
	return Date.UTC(currentDate.getUTCFullYear(), 0, 1)
}

export function getCumulativeChangeOfPeriod(
	performanceTimeSeries: PerformanceTimeSeries,
	period: NarrativePeriod,
	name: string,
	currentTimeMs: number = Date.now()
): number | null {
	const series = performanceTimeSeries[period]
	if (!Array.isArray(series) || series.length === 0) return null

	const current = getFreshTimeSeriesCurrentPoint(series, (point) => point.date, { currentTimeMs })
	if (!current) return null
	const currentTimestamp = toUnixMsTimestamp(current.date)
	const comparison = findTimeSeriesPointNear(
		series,
		getNarrativePeriodStartTimestamp(currentTimestamp, period),
		(point) => point.date
	)
	if (!comparison) return null

	const value = current[name]
	const comparisonValue = comparison[name]
	return typeof value === 'number' &&
		Number.isFinite(value) &&
		typeof comparisonValue === 'number' &&
		Number.isFinite(comparisonValue)
		? value
		: null
}

export async function getCategoryPerformance(): Promise<CategoryPerformanceProps> {
	const periods = ['7', '30', 'ytd', '365'] as const

	const [performanceEntries, info] = await Promise.all([
		Promise.all(
			periods.map(
				async (period): Promise<[string, TimeSeriesEntry[]]> => [period, await fetchCategoryPerformance(period)]
			)
		),
		fetchCategoryInfo()
	])

	const performanceTimeSeries: PerformanceTimeSeries = Object.fromEntries(performanceEntries)

	const pctChanges: IPctChangeRow[] = info.map((i) => ({
		...i,
		change1W: getCumulativeChangeOfPeriod(performanceTimeSeries, '7', i.name),
		change1M: getCumulativeChangeOfPeriod(performanceTimeSeries, '30', i.name),
		change1Y: getCumulativeChangeOfPeriod(performanceTimeSeries, '365', i.name),
		changeYtd: getCumulativeChangeOfPeriod(performanceTimeSeries, 'ytd', i.name)
	}))

	return {
		pctChanges,
		performanceTimeSeries,
		areaChartLegend: info.map((i) => i.name),
		isCoinPage: false
	}
}

export function calculateCumulativePercentageChange(
	data: PriceEntry[],
	mapping: Record<string, string>,
	timeframe: number | 'ytd',
	currentTimeMs: number = Date.now()
): TimeSeriesEntry[] {
	const sortedData = data.toSorted((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime())

	// group by id
	const groupedData: Record<string, Array<{ timestamp: number; price: number }>> = {}
	for (const [id, timestamp, price] of sortedData) {
		if (!groupedData[id]) groupedData[id] = []
		groupedData[id].push({
			timestamp: new Date(timestamp).getTime(),
			price
		})
	}

	// calculate cumulative percentage change for each id
	const results: Record<number, Record<string, number>> = {}
	for (const [id, prices] of Object.entries(groupedData)) {
		const current = getFreshTimeSeriesCurrentPoint(prices, (point) => point.timestamp, { currentTimeMs })
		if (!current) continue
		const period = timeframe === 'ytd' ? 'ytd' : String(timeframe)
		if (period !== '7' && period !== '30' && period !== '365' && period !== 'ytd') continue
		const initial = findTimeSeriesPointNear(
			prices,
			getNarrativePeriodStartTimestamp(current.timestamp, period),
			(point) => point.timestamp
		)
		if (!initial) continue

		const initialPrice = initial.price
		if (initialPrice === 0) continue
		const coinName = mapping[id]
		if (!coinName) continue
		for (const { timestamp, price } of prices) {
			if (timestamp < initial.timestamp || timestamp > current.timestamp) continue
			if (!results[timestamp]) results[timestamp] = {}
			results[timestamp][coinName] = ((price - initialPrice) / initialPrice) * 100
		}
	}

	// format for chart
	const chartData: TimeSeriesEntry[] = []
	for (const [timestamp, values] of Object.entries(results)) {
		chartData.push({
			date: Math.floor(parseInt(timestamp, 10) / 1e3),
			...values
		})
	}
	return chartData.sort((a, b) => a.date - b.date)
}

export async function getCoinPerformance(categoryId: string): Promise<CategoryPerformanceProps> {
	const [prices, coinInfo, categories] = await Promise.all([
		fetchCategoryCoinPrices(categoryId),
		fetchCoinInfo(categoryId),
		getCategoryInfo()
	])

	const coinsUniqueIncludingDenomCoins: Record<string, string> = Object.fromEntries(coinInfo.map((c) => [c.id, c.name]))

	const ts7 = calculateCumulativePercentageChange(prices, coinsUniqueIncludingDenomCoins, 7)
	const ts30 = calculateCumulativePercentageChange(prices, coinsUniqueIncludingDenomCoins, 30)
	const ts365 = calculateCumulativePercentageChange(prices, coinsUniqueIncludingDenomCoins, 365)
	const tsYtd = calculateCumulativePercentageChange(prices, coinsUniqueIncludingDenomCoins, 'ytd')

	const performanceTimeSeries: PerformanceTimeSeries = {
		'7': ts7,
		'30': ts30,
		'365': ts365,
		ytd: tsYtd
	}

	const pctChanges: IPctChangeRow[] = coinInfo.map((i) => ({
		...i,
		change1W: getCumulativeChangeOfPeriod(performanceTimeSeries, '7', i.name),
		change1M: getCumulativeChangeOfPeriod(performanceTimeSeries, '30', i.name),
		change1Y: getCumulativeChangeOfPeriod(performanceTimeSeries, '365', i.name),
		changeYtd: getCumulativeChangeOfPeriod(performanceTimeSeries, 'ytd', i.name)
	}))

	return {
		pctChanges,
		performanceTimeSeries,
		areaChartLegend: (() => {
			const legend: string[] = []
			for (const i of coinInfo) {
				if (i.name !== 'Bitcoin' && i.name !== 'Ethereum' && i.name !== 'Solana') legend.push(i.name)
			}
			return legend
		})(),
		isCoinPage: true,
		categoryName: categories.find((i) => i.id === categoryId)?.name
	}
}
