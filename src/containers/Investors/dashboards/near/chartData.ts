import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { formatBarChart, formatLineChart } from '~/components/ECharts/shared/timeSeries'
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

export function aggregateBreakdown(chart: BreakdownChart, topN: number): Array<{ name: string; value: number }> {
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

export function channelsToBars(breakdown: ChannelBreakdown): { categories: Array<string>; values: Array<number> } {
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

export function timeframeStartIndex(dates: Array<string>, timeframe: Timeframe): number {
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

export function filterTimeSeries(
	dates: Array<string>,
	series: Array<number>,
	timeframe: Timeframe
): Array<[number, number]> {
	const start = timeframeStartIndex(dates, timeframe)
	const result = new Array<[number, number]>(dates.length - start)
	for (let index = start; index < dates.length; index++) {
		result[index - start] = [Math.floor(Date.parse(`${dates[index]}T00:00:00Z`) / 1000), series[index] ?? 0]
	}
	return result
}

export type RevenueChartSeries = {
	feesDates: Array<string>
	cumulativeFees: Array<number>
	protocolFeesSeries: Array<number>
	intentFeesSeries: Array<number>
	revenueDates: Array<string>
	cumulativeRevenue: Array<number>
	burnRevenueSeries: Array<number>
	intentsRevenueSeries: Array<number>
}

/**
 * The fees and revenue charts. Like the protocol and chain charts, bars sum each period and the cumulative line keeps
 * its last value, both on the shared period key, so the chart's period label describes every series.
 */
export function buildRevenueChartModels(series: RevenueChartSeries, timeframe: Timeframe, aggregation: Aggregation) {
	const periodTotals = (dates: Array<string>, values: Array<number>) =>
		formatBarChart({
			data: filterTimeSeries(dates, values, timeframe),
			groupBy: aggregation,
			denominationPriceHistory: null
		})
	const periodLevels = (dates: Array<string>, values: Array<number>) =>
		formatLineChart({
			data: filterTimeSeries(dates, values, timeframe),
			groupBy: aggregation,
			denominationPriceHistory: null
		})
	return {
		feesModel: buildSparseCartesianChartModel(
			[
				{
					name: 'Cumulative Fees',
					type: 'line' as const,
					color: '#00C1DE',
					data: periodLevels(series.feesDates, series.cumulativeFees),
					yAxisIndex: 0,
					excludeFromTooltipTotal: true
				},
				{
					name: 'Protocol Fees',
					type: 'bar' as const,
					color: '#4691ce',
					data: periodTotals(series.feesDates, series.protocolFeesSeries),
					yAxisIndex: 1,
					stack: 'fees',
					barMaxWidth: 40
				},
				{
					name: 'Intent Fees',
					type: 'bar' as const,
					color: '#4cae4f',
					data: periodTotals(series.feesDates, series.intentFeesSeries),
					yAxisIndex: 1,
					stack: 'fees',
					barMaxWidth: 40
				}
			],
			{ timestampMultiplier: 1 }
		),
		revenueModel: buildSparseCartesianChartModel(
			[
				{
					name: 'Cumulative Revenue',
					type: 'line' as const,
					color: '#00C1DE',
					data: periodLevels(series.revenueDates, series.cumulativeRevenue),
					yAxisIndex: 0,
					excludeFromTooltipTotal: true
				},
				{
					name: 'Protocol Revenue',
					type: 'bar' as const,
					color: '#4691ce',
					data: periodTotals(series.revenueDates, series.burnRevenueSeries),
					yAxisIndex: 1,
					stack: 'revenue',
					barMaxWidth: 40
				},
				{
					name: 'Intent Revenue',
					type: 'bar' as const,
					color: '#4cae4f',
					data: periodTotals(series.revenueDates, series.intentsRevenueSeries),
					yAxisIndex: 1,
					stack: 'revenue',
					barMaxWidth: 40
				}
			],
			{ timestampMultiplier: 1 }
		)
	}
}
