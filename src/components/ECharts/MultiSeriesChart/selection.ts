import { buildCsvFromDataset } from '~/components/ChartExport/ChartCsvExportButton'
import { projectMultiSeriesDatasetForCharts } from './datasetAdapter'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

export const DEFAULT_ADDITIVE_SERIES_LIMIT = 30
const REMAINDER_SERIES_NAME = 'Others'

/** Rank named dataset dimensions by their peak absolute value, retaining input order for ties. */
export function rankSeriesByPeakAbsoluteValue(
	dataset: MultiSeriesChartDataset,
	seriesNames: readonly string[]
): string[] {
	const dimensionIndex = new Map(dataset.dimensions.map((name, index) => [name, index]))
	const rankedSeries = seriesNames.map((name, order) => ({
		name,
		order,
		dimensionIndex: dimensionIndex.get(name) ?? -1,
		peak: 0
	}))
	for (const row of dataset.source) {
		for (const series of rankedSeries) {
			if (series.dimensionIndex < 0) continue
			const value = row[series.dimensionIndex] as number | null | undefined
			if (value == null) continue
			const magnitude = Math.abs(value)
			if (magnitude > series.peak) series.peak = magnitude
		}
	}
	return rankedSeries.sort((left, right) => right.peak - left.peak || left.order - right.order).map(({ name }) => name)
}

function resolveDimensionIndex(dimension: MultiSeriesChartSeriesConfig['encode']['x'], dimensions: string[]): number {
	const encoded = Array.isArray(dimension) ? dimension[0] : dimension
	const index = typeof encoded === 'number' ? encoded : dimensions.indexOf(encoded)
	if (index < 0) throw new Error(`Unknown chart dimension: ${String(encoded)}`)
	return index
}

/**
 * Project a peer-relative chart to the selected series and recompute every row over
 * that selected denominator. The canonical dataset remains untouched and colors/order
 * continue to come from the canonical chart configs.
 */
export function buildSelectedPercentageChart({
	dataset,
	charts,
	selectedCharts
}: {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	selectedCharts: ReadonlySet<string>
}): { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const displayedCharts = charts.filter((chart) => selectedCharts.has(chart.name))
	const xIndex = displayedCharts.length > 0 ? resolveDimensionIndex(displayedCharts[0].encode.x, dataset.dimensions) : 0
	const yIndexes = displayedCharts.map((chart) => resolveDimensionIndex(chart.encode.y, dataset.dimensions))
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)

	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]
		const row = new Array<MultiSeriesChartDataset['source'][number][number]>(displayedCharts.length + 1)
		row[0] = input[xIndex]
		let total = 0
		let lastPositiveValueIndex = -1
		for (let seriesIndex = 0; seriesIndex < yIndexes.length; seriesIndex++) {
			const value = input[yIndexes[seriesIndex]] as number | null | undefined
			row[seriesIndex + 1] = value
			if (value != null) {
				total += value
				if (value > 0) lastPositiveValueIndex = seriesIndex + 1
			}
		}

		if (total > 0 && lastPositiveValueIndex !== -1) {
			let normalizedTotal = 0
			for (let valueIndex = 1; valueIndex < row.length; valueIndex++) {
				const value = row[valueIndex] as number | null | undefined
				if (value == null || valueIndex === lastPositiveValueIndex) continue
				const normalized = (value / total) * 100
				row[valueIndex] = normalized
				normalizedTotal += normalized
			}
			row[lastPositiveValueIndex] = 100 - normalizedTotal
		} else {
			for (let valueIndex = 1; valueIndex < row.length; valueIndex++) {
				if (row[valueIndex] != null) row[valueIndex] = 0
			}
		}
		source[rowIndex] = row
	}

	return {
		dataset: {
			dimensions: [dataset.dimensions[xIndex], ...displayedCharts.map((chart) => chart.name)],
			source
		},
		charts: displayedCharts.map((chart, index) => ({
			...chart,
			encode: { x: 0, y: index + 1 }
		}))
	}
}

/** Bound an additive peer chart while retaining the exact selected tail as Others. */
export function buildSelectedAdditiveChart({
	dataset,
	charts,
	seriesOrder,
	selectedCharts,
	limit = DEFAULT_ADDITIVE_SERIES_LIMIT,
	includeUpstreamRemainder = false
}: {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	seriesOrder: readonly string[]
	selectedCharts: ReadonlySet<string>
	limit?: number
	includeUpstreamRemainder?: boolean
}): { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const chartByName = new Map(charts.map((chart) => [chart.name, chart]))
	const selectedNames = seriesOrder.filter(
		(name) => name !== REMAINDER_SERIES_NAME && selectedCharts.has(name) && chartByName.has(name)
	)
	const namedLimit = Math.max(1, limit)
	const includesUpstreamRemainder = includeUpstreamRemainder && chartByName.has(REMAINDER_SERIES_NAME)
	if (selectedNames.length <= namedLimit && !includesUpstreamRemainder) {
		return {
			dataset,
			charts: selectedNames.map((name) => chartByName.get(name)!)
		}
	}
	const visibleNames = selectedNames.slice(0, namedLimit)
	const remainderNames = selectedNames.slice(namedLimit)
	if (includesUpstreamRemainder) remainderNames.push(REMAINDER_SERIES_NAME)
	const hasRemainder = remainderNames.length > 0
	const templateChart = chartByName.get(visibleNames[0]) ?? charts[0]
	const xIndex = templateChart ? resolveDimensionIndex(templateChart.encode.x, dataset.dimensions) : 0
	const inputIndexByName = new Map(
		charts.map((chart) => [chart.name, resolveDimensionIndex(chart.encode.y, dataset.dimensions)])
	)
	const dimensions = [dataset.dimensions[xIndex], ...visibleNames, ...(hasRemainder ? [REMAINDER_SERIES_NAME] : [])]
	const visibleIndexes = visibleNames.map((name) => inputIndexByName.get(name) ?? -1)
	const remainderIndexes = remainderNames.map((name) => inputIndexByName.get(name) ?? -1)
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)

	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]
		const row = new Array<MultiSeriesChartDataset['source'][number][number]>(dimensions.length)
		row[0] = input[xIndex]
		for (let seriesIndex = 0; seriesIndex < visibleIndexes.length; seriesIndex++) {
			const inputIndex = visibleIndexes[seriesIndex]
			row[seriesIndex + 1] = inputIndex >= 0 ? input[inputIndex] : undefined
		}
		if (hasRemainder) {
			let remainder = 0
			let hasValue = false
			for (const inputIndex of remainderIndexes) {
				if (inputIndex < 0) continue
				const value = input[inputIndex] as number | null | undefined
				if (value == null) continue
				remainder += value
				hasValue = true
			}
			row[row.length - 1] = hasValue ? remainder : undefined
		}
		source[rowIndex] = row
	}

	const outputCharts = visibleNames.map((name, index) => ({
		...chartByName.get(name)!,
		encode: { x: 0, y: index + 1 }
	}))
	if (hasRemainder) {
		const template = chartByName.get(REMAINDER_SERIES_NAME) ?? templateChart
		if (template) {
			outputCharts.push({
				...template,
				name: REMAINDER_SERIES_NAME,
				encode: { x: 0, y: outputCharts.length + 1 },
				color: '#AAAAAA'
			})
		}
	}

	return { dataset: { dimensions, source }, charts: outputCharts }
}

export function buildSelectedSeriesCsv({
	dataset,
	charts,
	selectedCharts,
	filename
}: {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	selectedCharts: Set<string>
	filename: string
}) {
	const displayedCharts = charts.filter((chart) => selectedCharts.has(chart.name))
	const exportDataset = projectMultiSeriesDatasetForCharts(dataset, displayedCharts)
	return buildCsvFromDataset({
		dimensions: exportDataset.dimensions,
		source: exportDataset.source,
		filenameBase: filename
	})
}
