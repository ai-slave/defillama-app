import type { MultiSeriesChartArrayRow, MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

type PreparedMultiSeriesDataset = {
	dimensions: string[]
	logicalDimensions: string[]
	source: MultiSeriesChartArrayRow[]
	charts: MultiSeriesChartSeriesConfig[]
}

function buildDimensionIndex(dimensions: string[]): Map<string, number> {
	const index = new Map<string, number>()
	for (let i = 0; i < dimensions.length; i++) {
		// String encodes have always selected the first matching display label.
		if (!index.has(dimensions[i])) index.set(dimensions[i], i)
	}
	return index
}

function dimensionIndexes(
	encoded: MultiSeriesChartSeriesConfig['encode']['x'],
	dimensionIndex: Map<string, number> | undefined
): number[] {
	const values = Array.isArray(encoded) ? encoded : [encoded]
	const indexes = new Array<number>(values.length)
	for (let i = 0; i < values.length; i++) {
		indexes[i] =
			typeof values[i] === 'number' ? (values[i] as number) : (dimensionIndex?.get(values[i] as string) ?? -1)
	}
	return indexes
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
	const indexes = dimensionIndexes(encoded, dimensionIndex)
	return Array.isArray(encoded) ? indexes : indexes[0]
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
		for (let i = 0; i < charts.length; i++) {
			const chart = charts[i]
			renderedCharts[i] = {
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
	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]
		const row = new Array<MultiSeriesChartArrayRow[number]>(indexes.length)
		for (let columnIndex = 0; columnIndex < indexes.length; columnIndex++)
			row[columnIndex] = input[indexes[columnIndex]]
		source[rowIndex] = row
	}
	return { dimensions: indexes.map((index) => dataset.dimensions[index]), source }
}
