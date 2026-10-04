/**
 * Compare Protocols chart composition.
 *
 * - A failed base chart keeps the protocol's series as unavailable, and a failed enabled section makes the composed
 *   points null.
 * - A successful empty base chart can still produce additive-only history; a successful empty section contributes zero.
 * - Rows use explicit null gaps so JSON, the chart and the CSV keep the same selected-series order.
 * - The chart shows no tooltip total: parents and children can overlap.
 */

import type {
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import { PROTOCOL_LIST_ADDITIVE_TVL_KEYS, type ProtocolListAdditiveTvlKey } from '~/containers/ProtocolLists/api.types'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import { buildExtraTvlCharts, buildTvlChart } from '~/containers/ProtocolOverview/tvlChart'
import { getNDistinctColors } from '~/utils'
import { getCompareProtocolExtraTvlKeys, getCompareProtocolTvlSettings } from './requestPlan'

export type CompareProtocolTvlCharts = {
	name: string
	tvlChart: IProtocolValueChart | null
	extraTvlCharts: Partial<Record<ProtocolListAdditiveTvlKey, IProtocolValueChart | null>>
}

function composeProtocolTvlChart({
	tvlChart,
	extraTvlCharts,
	extraTvlEnabled
}: Omit<CompareProtocolTvlCharts, 'name'> & {
	extraTvlEnabled: ReturnType<typeof getCompareProtocolTvlSettings>
}) {
	const availableExtraTvlCharts: Partial<Record<ProtocolListAdditiveTvlKey, IProtocolValueChart>> = {}
	for (const key of PROTOCOL_LIST_ADDITIVE_TVL_KEYS) {
		const chart = extraTvlCharts[key]
		if (chart !== null && chart !== undefined) availableExtraTvlCharts[key] = chart
	}

	let tvlChartInSeconds: IProtocolValueChart = []
	if (tvlChart !== null) {
		if (tvlChart.length > 0) {
			tvlChartInSeconds = tvlChart.map(([timestamp, value]) => [Math.floor(timestamp / 1e3), value])
		} else {
			const additiveTimestamps = new Set<number>()
			for (const key of PROTOCOL_LIST_ADDITIVE_TVL_KEYS) {
				if (!extraTvlEnabled[key]) continue
				for (const [timestamp] of availableExtraTvlCharts[key] ?? []) {
					additiveTimestamps.add(Math.floor(timestamp / 1e3))
				}
			}
			tvlChartInSeconds = Array.from(additiveTimestamps)
				.sort((a, b) => a - b)
				.map((timestamp) => [timestamp, 0])
		}
	}

	return buildTvlChart({
		tvlChartData: tvlChartInSeconds,
		extraTvlCharts: buildExtraTvlCharts(availableExtraTvlCharts),
		selectedExtraTvls: getCompareProtocolExtraTvlKeys(extraTvlEnabled),
		groupBy: 'daily',
		denominationPriceHistory: null
	})
}

function createCompareChartRow(timestamp: number, seriesCount: number): MultiSeriesTimeSeriesRow {
	const row: MultiSeriesTimeSeriesRow = [timestamp]
	while (row.length <= seriesCount) row.push(null)
	return row
}

export function buildCompareProtocolsChartData({
	protocolCharts,
	extraTvlEnabled
}: {
	protocolCharts: Array<CompareProtocolTvlCharts>
	extraTvlEnabled: Parameters<typeof getCompareProtocolTvlSettings>[0]
}) {
	const tvlSettings = getCompareProtocolTvlSettings(extraTvlEnabled)
	const seriesNames = protocolCharts.map((protocol) => protocol.name)
	const distinctColors = getNDistinctColors(protocolCharts.length)
	const rowMap = new Map<number, MultiSeriesTimeSeriesRow>()
	for (const [seriesIndex, protocol] of protocolCharts.entries()) {
		for (const [timestamp, value] of composeProtocolTvlChart({ ...protocol, extraTvlEnabled: tvlSettings })) {
			let row = rowMap.get(timestamp)
			if (!row) {
				row = createCompareChartRow(timestamp, seriesNames.length)
				rowMap.set(timestamp, row)
			}
			row[seriesIndex + 1] = value
		}
	}

	const source = Array.from(rowMap.values()).sort((a, b) => a[0] - b[0])
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	for (const [index, protocolName] of seriesNames.entries()) {
		const color = distinctColors[index]
		if (color === undefined) throw new Error(`Compare protocol palette is missing color ${index}`)
		charts.push({
			type: 'line',
			name: protocolName,
			encode: { x: 0, y: index + 1 },
			stack: protocolName,
			color
		})
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...seriesNames] },
		charts
	}
}
