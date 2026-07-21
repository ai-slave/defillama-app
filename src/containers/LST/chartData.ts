import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import type { InflowsChartData } from './types'

export function buildLstInflowsData({
	inflowsChartData,
	groupBy
}: {
	inflowsChartData: InflowsChartData
	groupBy: ChartTimeGroupingWithCumulative
}) {
	const store = new Map<number, Map<string, number>>()
	const isCumulative = groupBy === 'cumulative'
	const totalByToken = new Map<string, number>()

	for (const date in inflowsChartData) {
		const dateEntry = inflowsChartData[date]
		const dateKey = isCumulative ? +date : getBucketTimestampSec(+date, groupBy)
		let dateStore = store.get(dateKey)
		if (!dateStore) {
			dateStore = new Map()
			store.set(dateKey, dateStore)
		}
		for (const token in dateEntry) {
			const value = dateEntry[token]

			if (isCumulative) {
				const total = (totalByToken.get(token) ?? 0) + value
				totalByToken.set(token, total)
				dateStore.set(token, total)
			} else {
				dateStore.set(token, (dateStore.get(token) ?? 0) + value)
			}
		}
	}

	return Array.from(store.entries()).sort((a, b) => a[0] - b[0])
}

export function buildLstBreakdownChartData({
	areaChartData,
	tokens,
	lsdColors
}: {
	areaChartData: Array<Record<string, number>>
	tokens: string[]
	lsdColors: Record<string, string>
}) {
	const source = new Array<Array<number | undefined>>(areaChartData.length)
	for (let i = 0; i < areaChartData.length; i++) {
		const row = areaChartData[i]
		const chartRow = new Array<number | undefined>(tokens.length + 1)
		chartRow[0] = row.date * 1e3
		for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
			chartRow[tokenIndex + 1] = row[tokens[tokenIndex]]
		}
		source[i] = chartRow
	}

	const charts: Array<{
		type: 'line'
		name: string
		encode: { x: number; y: number }
		color: string
		stack: string
	}> = []
	for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
		const name = tokens[tokenIndex]
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: tokenIndex + 1 },
			color: lsdColors[name],
			stack: 'breakdown'
		})
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...tokens]
		},
		charts
	}
}

export function buildLstInflowsSeriesData({
	inflowsData,
	tokens,
	lsdColors,
	barChartStacks
}: {
	inflowsData: Array<[number, Map<string, number>]>
	tokens: string[]
	lsdColors: Record<string, string>
	barChartStacks: Record<string, string>
}) {
	const source = new Array<Array<number | undefined>>(inflowsData.length)
	for (let i = 0; i < inflowsData.length; i++) {
		const [date, values] = inflowsData[i]
		const chartRow = new Array<number | undefined>(tokens.length + 1)
		chartRow[0] = date * 1e3
		for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
			chartRow[tokenIndex + 1] = values.get(tokens[tokenIndex])
		}
		source[i] = chartRow
	}

	const cumulativeCharts: Array<{
		type: 'line'
		name: string
		encode: { x: number; y: number }
		color: string
	}> = []
	const barCharts: Array<{
		type: 'bar'
		name: string
		encode: { x: number; y: number }
		color: string
		stack: string
		large: false
	}> = []

	for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
		const name = tokens[tokenIndex]
		cumulativeCharts.push({
			type: 'line',
			name,
			encode: { x: 0, y: tokenIndex + 1 },
			color: lsdColors[name]
		})
		barCharts.push({
			type: 'bar',
			name,
			encode: { x: 0, y: tokenIndex + 1 },
			color: lsdColors[name],
			stack: barChartStacks[name],
			large: false
		})
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...tokens]
		},
		cumulativeCharts,
		barCharts
	}
}
