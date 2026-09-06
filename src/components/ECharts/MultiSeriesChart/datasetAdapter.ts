import type { MultiSeriesChartArrayRow, MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

type PreparedMultiSeriesDataset = {
	dimensions: Array<{ name: string; displayName?: string }>
	logicalDimensions: Array<string>
	source: Array<MultiSeriesChartArrayRow>
	charts: Array<MultiSeriesChartSeriesConfig>
}

function buildDimensionIndex(dimensions: Array<string>): Map<string, number> {
	const index = new Map<string, number>()
	for (const [dimensionIndex, dimension] of dimensions.entries()) {
		// String encodes have always selected the first matching display label.
		if (!index.has(dimension)) index.set(dimension, dimensionIndex)
	}
	return index
}

function dimensionIndexes(
	encoded: MultiSeriesChartSeriesConfig['encode']['x'],
	dimensionIndex: Map<string, number> | undefined
): Array<number> {
	const values = Array.isArray(encoded) ? encoded : [encoded]
	return values.map((value) => (typeof value === 'number' ? value : (dimensionIndex?.get(value) ?? -1)))
}

function remapEncode(
	encoded: MultiSeriesChartSeriesConfig['encode']['x'],
	dimensionIndex: Map<string, number> | undefined
): MultiSeriesChartSeriesConfig['encode']['x'] {
	if (Array.isArray(encoded)) return dimensionIndexes(encoded, dimensionIndex)
	return typeof encoded === 'number' ? encoded : (dimensionIndex?.get(encoded) ?? -1)
}

function usesOnlyNumericEncodes(chart: MultiSeriesChartSeriesConfig) {
	const x = Array.isArray(chart.encode.x) ? chart.encode.x : [chart.encode.x]
	const y = Array.isArray(chart.encode.y) ? chart.encode.y : [chart.encode.y]
	return x.every((value) => typeof value === 'number') && y.every((value) => typeof value === 'number')
}

/** Assign private ECharts dimensions without copying history when only series visibility changes. */
export function prepareMultiSeriesDataset(
	dataset: MultiSeriesChartDataset,
	charts: Array<MultiSeriesChartSeriesConfig>
): PreparedMultiSeriesDataset {
	const allNumericEncodes = charts.every(usesOnlyNumericEncodes)
	const dimensionIndex = allNumericEncodes ? undefined : buildDimensionIndex(dataset.dimensions)

	// Keep the full chart order through renderer adaptation. Fallback colors are assigned from
	// this stable order after selection, while non-selected encodes are never rendered.
	let renderedCharts = charts
	if (!allNumericEncodes) {
		renderedCharts = new Array<MultiSeriesChartSeriesConfig>(charts.length)
		for (const [chartIndex, chart] of charts.entries()) {
			renderedCharts[chartIndex] = {
				...chart,
				encode: {
					x: remapEncode(chart.encode.x, dimensionIndex),
					y: remapEncode(chart.encode.y, dimensionIndex)
				}
			}
		}
	}

	return {
		dimensions: dataset.dimensions.map((displayName, index) => ({ name: `__dimension_${index}`, displayName })),
		logicalDimensions: dataset.dimensions,
		source: dataset.source,
		charts: renderedCharts
	}
}
