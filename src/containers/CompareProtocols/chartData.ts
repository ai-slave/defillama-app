import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import { buildExtraTvlCharts, buildTvlChart } from '~/containers/ProtocolOverview/tvlChart'
import { getNDistinctColors } from '~/utils'

export type CompareProtocolTvlCharts = {
	name: string
	tvlChart: IProtocolValueChart | null
	extraTvlCharts: Record<string, IProtocolValueChart | null>
}

function composeProtocolTvlChart({
	tvlChart,
	extraTvlCharts,
	extraTvlEnabled
}: Omit<CompareProtocolTvlCharts, 'name'> & { extraTvlEnabled: Record<string, boolean> }) {
	const currentTvlByChain: Record<string, number> = {}
	for (const key in extraTvlEnabled) {
		if (extraTvlEnabled[key]) currentTvlByChain[key] = 0
	}
	const tvlChartInSeconds = tvlChart?.map(
		([timestamp, value]) => [Math.floor(timestamp / 1e3), value] as [number, number]
	)

	return buildTvlChart({
		tvlChartData: tvlChartInSeconds ?? [],
		extraTvlCharts: buildExtraTvlCharts(extraTvlCharts),
		tvlSettings: extraTvlEnabled,
		currentTvlByChain,
		groupBy: 'daily',
		denominationPriceHistory: null
	})
}

export function buildCompareProtocolsChartData({
	protocolCharts,
	extraTvlEnabled
}: {
	protocolCharts: CompareProtocolTvlCharts[]
	extraTvlEnabled: Record<string, boolean>
}) {
	const chartsByProtocol = new Map<string, Map<number, number>>()
	const seriesNames: string[] = []
	let totalProtocols = 0

	for (const protocolData of protocolCharts) {
		const protocolName = protocolData.name
		let protocolChart = chartsByProtocol.get(protocolName)
		if (!protocolChart) {
			protocolChart = new Map<number, number>()
			chartsByProtocol.set(protocolName, protocolChart)
			seriesNames.push(protocolName)
		}

		for (const [timestamp, value] of composeProtocolTvlChart({ ...protocolData, extraTvlEnabled })) {
			protocolChart.set(timestamp, value ?? 0)
		}
		totalProtocols++
	}

	const distinctColors = getNDistinctColors(totalProtocols)
	const rowMap = new Map<number, MultiSeriesChartDataset['source'][number]>()
	for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
		const protocolName = seriesNames[seriesIndex]
		const protocolChart = chartsByProtocol.get(protocolName)
		if (!protocolChart) continue

		for (const [date, value] of protocolChart) {
			const timestamp = date
			let row = rowMap.get(timestamp)
			if (!row) {
				row = new Array(seriesNames.length + 1)
				row[0] = timestamp
				rowMap.set(timestamp, row)
			}
			row[seriesIndex + 1] = value
		}
	}

	const source = Array.from(rowMap.values()).sort((a, b) => (a[0] as number) - (b[0] as number))
	const charts: MultiSeriesChartSeriesConfig[] = []
	for (let index = 0; index < seriesNames.length; index++) {
		const protocolName = seriesNames[index]
		charts.push({
			type: 'line',
			name: protocolName,
			encode: { x: 0, y: index + 1 },
			stack: protocolName,
			color: distinctColors[index]
		})
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...seriesNames] },
		charts
	}
}
