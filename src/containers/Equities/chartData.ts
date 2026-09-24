import { formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { getTooltipAxisValue, getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { formatIsoDate, formatMonthYear } from '~/utils/dateFormat'
import type { PriceChartIntradayTimeframe } from '~/utils/priceChartTimeframes'
import type {
	EquitiesDimensionMetric,
	EquitiesDimensionPeriod,
	EquitiesPriceHistory,
	IEquitiesDimensionsResponse
} from './api.types'
import type { IEquitiesIntradayPriceHistoryChart, IEquitiesPriceHistoryChart } from './types'

const FUNDAMENTAL_CHART_LABELS: Record<EquitiesDimensionMetric, string> = {
	revenue: 'Revenue',
	holdersRevenue: 'Holders Revenue',
	earnings: 'Earnings',
	basicSharesOutstanding: 'Shares Outstanding'
}

// Shares outstanding is a share count, so it must not render with the USD symbol the other metrics use.
export const FUNDAMENTAL_CHART_VALUE_SYMBOLS: Record<EquitiesDimensionMetric, string> = {
	revenue: '$',
	holdersRevenue: '$',
	earnings: '$',
	basicSharesOutstanding: ''
}

export function buildPriceHistoryChart(priceHistory: EquitiesPriceHistory): IEquitiesPriceHistoryChart {
	const source: Array<Array<number>> = new Array(priceHistory.length)
	let targetIndex = priceHistory.length - 1
	// The API is newest-first; filling backward emits chart order without a copied reverse array.
	for (const [date, close] of priceHistory) {
		source[targetIndex] = [Date.parse(date), close]
		targetIndex--
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', 'Close']
		},
		charts: [
			{
				type: 'line',
				name: 'Close',
				encode: { x: 'timestamp', y: 'Close' }
			}
		]
	}
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatIntradaySessionLabel(timestampMs: number): string {
	const date = new Date(timestampMs)
	const hours = date.getUTCHours().toString().padStart(2, '0')
	const minutes = date.getUTCMinutes().toString().padStart(2, '0')
	return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${hours}:${minutes}`
}

export function formatIntradayAxisTimeOnly(label: string): string {
	return label.slice(label.lastIndexOf(' ') + 1)
}

export function buildIntradayPriceHistoryChart(
	priceHistory: EquitiesPriceHistory,
	timeframe: PriceChartIntradayTimeframe
): IEquitiesIntradayPriceHistoryChart {
	const timeSeries = buildPriceHistoryChart(priceHistory)
	const source: Array<Array<string | number | null>> = new Array(timeSeries.dataset.source.length)
	for (let index = 0; index < timeSeries.dataset.source.length; index++) {
		const row = timeSeries.dataset.source[index]!
		source[index] = [formatIntradaySessionLabel(row[0] as number), row[1] ?? null]
	}

	return {
		dataset: {
			source,
			dimensions: ['session', 'Close']
		},
		charts: [
			{
				type: 'line',
				name: 'Close',
				encode: { x: 'session', y: 'Close' }
			}
		],
		csvDataset: timeSeries.dataset,
		timeOnlyAxisLabels: timeframe === '24H'
	}
}

export function buildEquitiesDimensionsChart(
	dimensions: IEquitiesDimensionsResponse,
	metric: EquitiesDimensionMetric,
	period: EquitiesDimensionPeriod
): IEquitiesPriceHistoryChart {
	const label = FUNDAMENTAL_CHART_LABELS[metric]
	const valueSymbol = FUNDAMENTAL_CHART_VALUE_SYMBOLS[metric]
	const points = dimensions[metric]?.[period] ?? []
	const source: Array<Array<number | null>> = new Array(points.length)
	let targetIndex = points.length - 1
	for (const [date, value] of points) {
		source[targetIndex] = [Date.parse(`${date}T00:00:00Z`), value]
		targetIndex--
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', label]
		},
		charts: [
			{
				type: 'bar',
				name: label,
				encode: { x: 'timestamp', y: label },
				valueSymbol
			}
		]
	}
}

const REPORTING_PERIOD_LABELS: Record<EquitiesDimensionPeriod, string> = {
	quarterly: 'Quarter ending',
	annual: 'Year ending'
}

/**
 * Fundamentals are fiscal periods dated by their end (Twelve Data's `fiscal_date`), not calendar buckets, so the
 * tooltip names the period by its ending month. The provider normalizes that date to a month end, which can differ
 * from the company's exact cutoff, so the day is left out.
 */
export function createReportingPeriodTooltipFormatter(period: EquitiesDimensionPeriod, valueSymbol: string) {
	return (params: unknown) => {
		const [item] = normalizeTooltipItems(params)
		if (!item?.seriesName) return ''
		const value = Number(getTooltipRawYValue(item, item.seriesName))
		const ending = formatMonthYear(getTooltipAxisValue(item), { input: 'milliseconds' })
		return `${REPORTING_PERIOD_LABELS[period]} ${ending}<li style="list-style:none">${item.marker ?? ''}${item.seriesName}&nbsp;&nbsp;${formatTooltipValue(value, valueSymbol)}</li>`
	}
}

/** One row per reported period, keeping the provider's full period-ending date. */
export function buildEquitiesDimensionsCsvRows(
	chart: IEquitiesPriceHistoryChart
): Array<Array<string | number | null>> {
	const rows: Array<Array<string | number | null>> = [['Period ending', chart.dataset.dimensions[1]!]]
	for (const [timestamp, value] of chart.dataset.source) {
		rows.push([formatIsoDate(timestamp as number, { input: 'milliseconds' }), value ?? null])
	}
	return rows
}
