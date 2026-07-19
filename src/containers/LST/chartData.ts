import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/types'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import type { InflowsChartData } from './types'

export function buildLstInflowsData({
	inflowsChartData,
	groupBy
}: {
	inflowsChartData: InflowsChartData
	groupBy: ChartTimeGroupingWithCumulative
}) {
	const store = new Map<number, Record<string, number>>()
	const isCumulative = groupBy === 'cumulative'
	const totalByToken = createChartRecord<number>()

	for (const date in inflowsChartData) {
		const dateEntry = inflowsChartData[date]
		const dateKey = isCumulative ? +date : getBucketTimestampSec(+date, groupBy)
		let dateStore = store.get(dateKey)
		for (const token in dateEntry) {
			const value = dateEntry[token]
			if (!dateStore) {
				dateStore = createChartRecord<number>()
				store.set(dateKey, dateStore)
			}

			if (isCumulative) {
				const carry = totalByToken[token] ?? 0
				dateStore[token] = (dateStore[token] ?? 0) + value + carry
				totalByToken[token] = (totalByToken[token] ?? 0) + value
			} else {
				dateStore[token] = (dateStore[token] ?? 0) + value
			}
		}
	}

	const finalData: Array<Record<string, number>> = []
	const entries = Array.from(store.entries()).sort((a, b) => a[0] - b[0])
	for (const [date, dateStore] of entries) {
		dateStore.date = date
		finalData.push(dateStore)
	}

	return finalData
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
	const selectedTokens = new Set(tokens)
	const source = new Array<Record<string, number>>(areaChartData.length)
	for (let i = 0; i < areaChartData.length; i++) {
		const row = areaChartData[i]
		const chartRow = createChartRow<number>(row.date * 1e3)
		for (const name in row) {
			if (name !== 'date' && selectedTokens.has(name)) chartRow[name] = row[name]
		}
		source[i] = chartRow
	}

	const charts: Array<{
		type: 'line'
		name: string
		encode: { x: string; y: string }
		color: string
		stack: string
	}> = []
	for (const name of tokens) {
		charts.push({
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
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
	inflowsData: Array<Record<string, number>>
	tokens: string[]
	lsdColors: Record<string, string>
	barChartStacks: Record<string, string>
}) {
	const selectedTokens = new Set(tokens)
	const source = new Array<Record<string, number>>(inflowsData.length)
	for (let i = 0; i < inflowsData.length; i++) {
		const row = inflowsData[i]
		const chartRow = createChartRow<number>(row.date * 1e3)
		for (const name in row) {
			if (name !== 'date' && selectedTokens.has(name)) chartRow[name] = row[name]
		}
		source[i] = chartRow
	}

	const cumulativeCharts: Array<{
		type: 'line'
		name: string
		encode: { x: string; y: string }
		color: string
	}> = []
	const barCharts: Array<{
		type: 'bar'
		name: string
		encode: { x: string; y: string }
		color: string
		stack: string
		large: false
	}> = []

	for (const name of tokens) {
		cumulativeCharts.push({
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: lsdColors[name]
		})
		barCharts.push({
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
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
