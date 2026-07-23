import { prepareRuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS } from '~/constants/colors'
import { getForkToOriginalTvlPercent } from './tvl'
import type { ForkBreakdownChartData, ForkOverviewPageData } from './types'

interface ForksOverviewDisplayRow {
	name: string
	logo?: string | null
	deprecated?: boolean
	forkedProtocols: number
	parentTvl: number | null
	tvl: number
	ftot: number | null
}

function getFiniteForkTvl(entry: ForkBreakdownChartData[number] | null | undefined, forkName: string): number | null {
	const value = entry?.[forkName]
	// Fork charts are API data plus optional extra-TVL chart data; non-finite values should not corrupt dominance math.
	return Number.isFinite(value) ? value : null
}

export function mergeForkOverviewChartData({
	chartData,
	extraBreakdownByTimestamp,
	shouldApplyExtraSeries
}: {
	chartData: ForkBreakdownChartData
	extraBreakdownByTimestamp: Map<number, Record<string, number>>
	shouldApplyExtraSeries: boolean
}): ForkBreakdownChartData {
	if (!shouldApplyExtraSeries) return chartData

	const mergedRowsByTimestamp = new Map<number, ForkBreakdownChartData[number]>()

	for (const row of chartData) {
		const clone = { timestamp: row.timestamp } as { timestamp: number } & Record<string, number>
		for (const key of Object.keys(row)) clone[key] = row[key]
		mergedRowsByTimestamp.set(row.timestamp, clone)
	}

	for (const [timestamp, extraRow] of extraBreakdownByTimestamp) {
		const mergedRow =
			mergedRowsByTimestamp.get(timestamp) ??
			({ timestamp: timestamp } as { timestamp: number } & Record<string, number>)

		for (const key in extraRow) {
			const value = extraRow[key]
			if (!Number.isFinite(value)) continue
			mergedRow[key] = (mergedRow[key] ?? 0) + value
		}

		mergedRowsByTimestamp.set(timestamp, mergedRow)
	}

	return Array.from(mergedRowsByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)
}

export function buildForksOverviewDisplayData({
	forks,
	forkColors,
	baseTableData,
	chartData
}: {
	forks: ForkOverviewPageData['forks']
	forkColors: ForkOverviewPageData['forkColors']
	baseTableData: ForkOverviewPageData['tableData']
	chartData: ForkBreakdownChartData
}) {
	const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null
	const chartForkKeys = new Set(forks)
	for (const entry of chartData) {
		for (const key in entry) {
			if (key !== 'timestamp') chartForkKeys.add(key)
		}
	}
	const sortedChartForks = Array.from(chartForkKeys).sort(
		(a, b) => (getFiniteForkTvl(latestData, b) ?? 0) - (getFiniteForkTvl(latestData, a) ?? 0)
	)

	const tableDataByName = new Map<string, ForkOverviewPageData['tableData'][number]>()
	for (const row of baseTableData) {
		tableDataByName.set(row.name, row)
	}

	const tableData: ForksOverviewDisplayRow[] = []
	for (const name of sortedChartForks) {
		const baseRow = tableDataByName.get(name)
		const tvl = getFiniteForkTvl(latestData, name) ?? 0
		const parentTvl = baseRow?.parentTvl ?? null

		tableData.push({
			name,
			...(baseRow?.logo ? { logo: baseRow.logo } : {}),
			...(baseRow?.deprecated ? { deprecated: true } : {}),
			forkedProtocols: baseRow?.forkedProtocols ?? 0,
			parentTvl,
			tvl,
			ftot: getForkToOriginalTvlPercent(tvl, parentTvl)
		})
	}

	const tvls: Array<{ name: string; value: number }> = []
	if (latestData) {
		for (const name in latestData) {
			if (name === 'timestamp') continue
			const value = getFiniteForkTvl(latestData, name)
			if (value == null) continue
			tvls.push({ name, value })
		}
	}

	const pieSeries = prepareRuntimePieChartData({ data: tvls, limit: 5 })
	const chartColors = Object.assign({}, forkColors)

	for (let index = 0; index < sortedChartForks.length; index++) {
		const name = sortedChartForks[index]
		if (!chartColors[name]) {
			chartColors[name] = CHART_COLORS[index % CHART_COLORS.length]
		}
	}

	const dominanceSource: Array<Array<number | undefined>> = []
	for (const entry of chartData) {
		const row = new Array<number | undefined>(sortedChartForks.length + 1)
		row[0] = entry.timestamp * 1000
		for (let forkIndex = 0; forkIndex < sortedChartForks.length; forkIndex++) {
			const forkName = sortedChartForks[forkIndex]
			const value = getFiniteForkTvl(entry, forkName)
			if (value == null || value <= 0) continue
			row[forkIndex + 1] = value
		}

		dominanceSource.push(row)
	}

	const dominanceCharts: Array<{
		type: 'line'
		name: string
		encode: { x: number; y: number }
		color: string
		stack: string
	}> = []
	for (let index = 0; index < sortedChartForks.length; index++) {
		const name = sortedChartForks[index]
		dominanceCharts.push({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 },
			color: chartColors[name] ?? CHART_COLORS[index % CHART_COLORS.length],
			stack: 'dominance'
		})
	}

	return {
		tableData,
		pieSeries,
		dominanceDataset: {
			source: dominanceSource,
			dimensions: ['timestamp', ...sortedChartForks]
		},
		dominanceCharts,
		chartColors
	}
}
