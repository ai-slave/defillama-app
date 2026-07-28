import type { MultiSeriesChartArrayRow, MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

type PreparedMultiSeriesDataset = {
	dimensions: string[]
	logicalDimensions: string[]
	source: MultiSeriesChartArrayRow[]
	charts: MultiSeriesChartSeriesConfig[]
}

function buildDimensionIndex(dimensions: string[]): Map<string, number> {
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
): number[] {
	const values = Array.isArray(encoded) ? encoded : [encoded]
	return values.map((value) => (typeof value === 'number' ? value : (dimensionIndex?.get(value) ?? -1)))
}

function displayedDimensionIndexes(
	dimensions: string[],
	charts: MultiSeriesChartSeriesConfig[],
	dimensionIndex: Map<string, number> | undefined
): number[] {
	const displayed = new Set<number>()
	for (const chart of charts) {
		for (const index of dimensionIndexes(chart.encode.x, dimensionIndex)) if (index >= 0) displayed.add(index)
		for (const index of dimensionIndexes(chart.encode.y, dimensionIndex)) if (index >= 0) displayed.add(index)
	}
	const indexes: number[] = []
	for (let index = 0; index < dimensions.length; index++) if (displayed.has(index)) indexes.push(index)
	if (indexes.length === 0 && dimensions.length > 0) indexes.push(0)
	return indexes
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
	charts: MultiSeriesChartSeriesConfig[]
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
		dimensions: dataset.dimensions.map((_, index) => `__dimension_${index}`),
		logicalDimensions: dataset.dimensions,
		source: dataset.source,
		charts: renderedCharts
	}
}

/** Project visible columns only at an explicit consumption boundary such as CSV export. */
export function projectMultiSeriesDatasetForCharts(
	dataset: MultiSeriesChartDataset,
	charts: MultiSeriesChartSeriesConfig[]
): MultiSeriesChartDataset {
	const allNumericEncodes = charts.every(usesOnlyNumericEncodes)
	const dimensionIndex = allNumericEncodes ? undefined : buildDimensionIndex(dataset.dimensions)
	const indexes = displayedDimensionIndexes(dataset.dimensions, charts, dimensionIndex)
	if (indexes.length === dataset.dimensions.length) return dataset
	const source = new Array<MultiSeriesChartArrayRow>(dataset.source.length)
	for (const [rowIndex, input] of dataset.source.entries()) {
		const row = new Array<MultiSeriesChartArrayRow[number]>(indexes.length)
		for (const [columnIndex, inputIndex] of indexes.entries()) row[columnIndex] = input[inputIndex]
		source[rowIndex] = row
	}
	const dimensions: string[] = []
	for (const index of indexes) {
		const dimension = dataset.dimensions[index]
		if (dimension === undefined) throw new Error(`Unknown projected chart dimension index: ${index}`)
		dimensions.push(dimension)
	}
	return { dimensions, source }
}
