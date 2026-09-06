import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import type { InflowsChartData, LSTHistoryRow } from './types'

export function buildLstInflowsData({
	inflowsChartData,
	groupBy
}: {
	inflowsChartData: InflowsChartData
	groupBy: ChartTimeGroupingWithCumulative
}) {
	const store = new Map<number, Map<string, number>>()
	const isCumulative = groupBy === 'cumulative'
	const cumulativeTotals = isCumulative ? new Map<string, number>() : null

	const datedEntries = Object.entries(inflowsChartData)
	datedEntries.sort(([left], [right]) => Number(left) - Number(right))
	for (const [dateString, dateEntry] of datedEntries) {
		const date = Number(dateString)
		const dateKey = isCumulative ? date : getBucketTimestampSec(date, groupBy)
		let dateStore = store.get(dateKey)
		if (!dateStore) {
			dateStore = new Map()
			store.set(dateKey, dateStore)
		}
		for (const token in dateEntry) {
			const value = dateEntry[token]
			if (value === undefined) continue

			if (cumulativeTotals) {
				const total = (cumulativeTotals.get(token) ?? 0) + value
				cumulativeTotals.set(token, total)
				dateStore.set(token, total)
			} else {
				dateStore.set(token, (dateStore.get(token) ?? 0) + value)
			}
		}
		if (cumulativeTotals) {
			for (const [token, total] of cumulativeTotals) {
				if (!dateStore.has(token)) dateStore.set(token, total)
			}
		}
	}

	return Array.from(store.entries())
}

export function buildLstBreakdownChartData({
	areaChartData,
	tokens,
	lsdColors
}: {
	areaChartData: Array<LSTHistoryRow>
	tokens: Array<string>
	lsdColors: Record<string, string>
}) {
	const source: Array<Array<number | undefined>> = []
	for (const row of areaChartData) {
		const chartRow = new Array<number | undefined>(tokens.length + 1)
		chartRow[0] = row.date * 1e3
		let tokenIndex = 1
		for (const token of tokens) {
			chartRow[tokenIndex] = row[token]
			tokenIndex++
		}
		source.push(chartRow)
	}

	const charts: Array<{
		type: 'line'
		name: string
		encode: { x: number; y: number }
		color?: string
		stack: string
	}> = []
	let tokenIndex = 1
	for (const name of tokens) {
		const color = lsdColors[name]
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: tokenIndex },
			...(color === undefined ? {} : { color }),
			stack: 'breakdown'
		})
		tokenIndex++
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
	tokens: Array<string>
	lsdColors: Record<string, string>
	barChartStacks: Record<string, string>
}) {
	const source: Array<Array<number | undefined>> = []
	for (const [date, values] of inflowsData) {
		const chartRow = new Array<number | undefined>(tokens.length + 1)
		chartRow[0] = date * 1e3
		let tokenIndex = 1
		for (const token of tokens) {
			chartRow[tokenIndex] = values.get(token)
			tokenIndex++
		}
		source.push(chartRow)
	}

	const cumulativeCharts: Array<{
		type: 'line'
		name: string
		encode: { x: number; y: number }
		color?: string
	}> = []
	const barCharts: Array<{
		type: 'bar'
		name: string
		encode: { x: number; y: number }
		color?: string
		stack?: string
		large: false
	}> = []

	let tokenIndex = 1
	for (const name of tokens) {
		const color = lsdColors[name]
		const stack = barChartStacks[name]
		cumulativeCharts.push({
			type: 'line',
			name,
			encode: { x: 0, y: tokenIndex },
			...(color === undefined ? {} : { color })
		})
		barCharts.push({
			type: 'bar',
			name,
			encode: { x: 0, y: tokenIndex },
			...(color === undefined ? {} : { color }),
			...(stack === undefined ? {} : { stack }),
			large: false
		})
		tokenIndex++
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

export function buildActiveLstChartData({
	view,
	areaChartData,
	inflowsChartData,
	groupBy,
	tokens,
	lsdColors,
	barChartStacks
}: {
	view: 'breakdown' | 'inflows'
	areaChartData: Array<LSTHistoryRow>
	inflowsChartData: InflowsChartData
	groupBy: ChartTimeGroupingWithCumulative
	tokens: Array<string>
	lsdColors: Record<string, string>
	barChartStacks: Record<string, string>
}) {
	if (view === 'breakdown') {
		return { kind: 'breakdown' as const, data: buildLstBreakdownChartData({ areaChartData, tokens, lsdColors }) }
	}
	const inflowsData = buildLstInflowsData({ inflowsChartData, groupBy })
	return {
		kind: 'inflows' as const,
		data: buildLstInflowsSeriesData({ inflowsData, tokens, lsdColors, barChartStacks })
	}
}
