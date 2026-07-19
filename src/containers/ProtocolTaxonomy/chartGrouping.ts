import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/types'
import { getBucketTimestampMs } from '~/components/ECharts/utils'
import type { IProtocolTaxonomyPageData } from './types'

type ProtocolTaxonomyCharts = IProtocolTaxonomyPageData['charts']
type ProtocolTaxonomyChartSeries = ProtocolTaxonomyCharts['charts'][number] & { encode: { x: string; y: string } }
type ProtocolTaxonomyChartRow = { timestamp: number } & Record<string, number | null>
type ProtocolTaxonomyGroupedChartsResult = {
	charts: ProtocolTaxonomyCharts
	hasBarCharts: boolean
}

export function buildProtocolTaxonomyGroupedCharts({
	charts,
	groupBy
}: {
	charts: ProtocolTaxonomyCharts
	groupBy: ChartTimeGroupingWithCumulative
}): ProtocolTaxonomyGroupedChartsResult {
	const chartSeries = (charts.charts ?? []) as ProtocolTaxonomyChartSeries[]
	const barDimensions = new Set<string>()
	const dimensionOrder: string[] = []

	for (const series of chartSeries) {
		const yDimension = series.encode.y

		dimensionOrder.push(yDimension)
		if (series.type === 'bar') {
			barDimensions.add(yDimension)
		}
	}

	if (barDimensions.size === 0) return { charts, hasBarCharts: false }

	let hasBarCharts = false
	const sourceRows = charts.dataset.source as ProtocolTaxonomyChartRow[]
	const source: ProtocolTaxonomyChartRow[] = []
	const cumulativeTotals = createChartRecord<number>()
	const isCumulative = groupBy === 'cumulative'

	for (const inputRow of sourceRows) {
		const timestamp = groupBy === 'cumulative' ? inputRow.timestamp : getBucketTimestampMs(inputRow.timestamp, groupBy)
		let outputRow = source[source.length - 1]
		let hasOutputAtTimestamp = outputRow?.timestamp === timestamp

		for (const series of chartSeries) {
			const dimension = series.encode.y
			const value = inputRow[dimension]
			if (value == null) continue

			if (!hasOutputAtTimestamp) {
				outputRow = createChartRow<number | null>(timestamp)
				source.push(outputRow)
				hasOutputAtTimestamp = true
			}

			if (series.type === 'bar') {
				hasBarCharts = true
				if (isCumulative) {
					const total = (cumulativeTotals[dimension] ?? 0) + value
					cumulativeTotals[dimension] = total
					outputRow![dimension] = total
				} else {
					outputRow![dimension] = (outputRow![dimension] ?? 0) + value
				}
			} else {
				outputRow![dimension] = value
			}
		}
	}

	if (!hasBarCharts) return { charts, hasBarCharts: false }

	for (const row of source) {
		for (const dimension of dimensionOrder) {
			if (!(dimension in row)) row[dimension] = null
		}
	}

	return {
		charts: {
			...charts,
			dataset: {
				source,
				dimensions: ['timestamp', ...dimensionOrder]
			},
			charts: chartSeries.map((series) => ({
				...series,
				type: series.type === 'bar' && isCumulative ? 'line' : series.type
			}))
		},
		hasBarCharts: true
	}
}
