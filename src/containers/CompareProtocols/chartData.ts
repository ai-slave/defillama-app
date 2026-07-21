import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { getNDistinctColors } from '~/utils'
import type { RawProtocolResponse } from './api.types'

export function buildCompareProtocolsChartData({
	protocolResponses,
	extraTvlEnabled
}: {
	protocolResponses: RawProtocolResponse[]
	extraTvlEnabled: Record<string, boolean>
}) {
	const chartsByProtocol = new Map<string, Map<number, number>>()
	const seriesNames: string[] = []
	let totalProtocols = 0

	for (const protocolData of protocolResponses) {
		const protocolName = protocolData.name
		let protocolChart = chartsByProtocol.get(protocolName)
		if (!protocolChart) {
			protocolChart = new Map<number, number>()
			chartsByProtocol.set(protocolName, protocolChart)
			seriesNames.push(protocolName)
		}

		for (const chain in protocolData.chainTvls ?? {}) {
			if (chain.includes('-') || chain === 'offers') continue
			if (chain in extraTvlEnabled && !extraTvlEnabled[chain]) continue

			const chainTvl = protocolData.chainTvls[chain].tvl ?? []

			for (const { date, totalLiquidityUSD } of chainTvl) {
				protocolChart.set(date, (protocolChart.get(date) ?? 0) + totalLiquidityUSD)
			}
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
			const timestamp = date * 1e3
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
