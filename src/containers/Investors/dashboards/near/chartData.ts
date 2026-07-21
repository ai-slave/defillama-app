import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { BreakdownChart, ChannelBreakdown, ChartData } from './ecosystemApi'

export type Timeframe = '7d' | '30d' | 'ytd' | '1y' | 'all'
export type Aggregation = 'daily' | 'weekly' | 'monthly'

export function singleSeriesDataset(chart: ChartData, dimension: string): MultiSeriesChartDataset | undefined {
	const values = chart.series[0]?.data
	if (!values) return undefined
	return {
		dimensions: ['timestamp', dimension],
		source: chart.dates.map((date, index) => [Date.parse(`${date}T00:00:00Z`), values[index]])
	}
}

export function aggregateBreakdown(chart: BreakdownChart, topN: number): { name: string; value: number }[] {
	const totals = chart.series.map((series) => ({
		name: series.name,
		value: series.data.reduce((sum, value) => sum + (value ?? 0), 0)
	}))
	totals.sort((a, b) => b.value - a.value)
	if (totals.length <= topN) return totals
	const top = totals.slice(0, topN)
	const othersValue = totals.slice(topN).reduce((sum, item) => sum + item.value, 0)
	if (othersValue > 0) top.push({ name: 'Others', value: othersValue })
	return top
}

export function channelsToBars(breakdown: ChannelBreakdown): { categories: string[]; values: number[] } {
	const sorted = breakdown.channels.toSorted((a, b) => b.fees - a.fees)
	return {
		categories: sorted.map((channel) => channel.referral || 'unknown'),
		values: sorted.map((channel) => channel.fees)
	}
}

export function lastSeriesValue(chart: ChartData | undefined, seriesName: string): number | undefined {
	if (!chart) return undefined
	const series = chart.series.find((item) => item.name === seriesName)
	if (!series) return undefined
	for (let i = series.data.length - 1; i >= 0; i--) {
		const value = series.data[i]
		if (value != null && !Number.isNaN(value)) return value
	}
	return undefined
}

export function timeframeStartIndex(dates: string[], timeframe: Timeframe): number {
	if (timeframe === 'ytd') {
		const yearStart = `${new Date().getUTCFullYear()}-01-01`
		const index = dates.findIndex((date) => date >= yearStart)
		return index === -1 ? dates.length : index
	}

	let count: number
	switch (timeframe) {
		case '7d':
			count = 7
			break
		case '30d':
			count = 30
			break
		case '1y':
			count = 365
			break
		case 'all':
			count = dates.length
			break
	}
	return Math.max(0, dates.length - count)
}

export function filterTimeSeries(dates: string[], series: number[], timeframe: Timeframe): Array<[number, number]> {
	const start = timeframeStartIndex(dates, timeframe)
	const result = new Array<[number, number]>(dates.length - start)
	for (let index = start; index < dates.length; index++) {
		result[index - start] = [Math.floor(Date.parse(`${dates[index]}T00:00:00Z`) / 1000), series[index] ?? 0]
	}
	return result
}

export function aggregateTimeSeries(
	dates: string[],
	series: number[],
	timeframe: Timeframe,
	aggregation: Aggregation
): Array<[number, number]> {
	if (aggregation === 'daily') return filterTimeSeries(dates, series, timeframe)

	const start = timeframeStartIndex(dates, timeframe)
	const result: Array<[number, number]> = []
	for (let index = start; index < dates.length; index++) {
		const date = new Date(`${dates[index]}T00:00:00Z`)
		let key: string

		if (aggregation === 'weekly') {
			const day = date.getUTCDay()
			const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1)
			key = new Date(date.setUTCDate(diff)).toISOString().slice(0, 10)
		} else {
			key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
		}

		const timestamp = Math.floor(Date.parse(`${key}T00:00:00Z`) / 1000)
		const previous = result[result.length - 1]
		if (previous?.[0] === timestamp) previous[1] += series[index] ?? 0
		else result.push([timestamp, series[index] ?? 0])
	}

	return result
}
