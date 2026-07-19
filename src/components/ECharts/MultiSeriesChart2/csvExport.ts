import type { MultiSeriesChart2SeriesConfig } from '../types'

function addEncodedDimensions(
	encoded: MultiSeriesChart2SeriesConfig['encode']['x'] | MultiSeriesChart2SeriesConfig['encode']['y'],
	datasetDimensions: string[],
	output: Set<string>
) {
	const values = Array.isArray(encoded) ? encoded : [encoded]
	for (const value of values) {
		if (typeof value === 'string') {
			output.add(value)
		} else {
			const dimension = datasetDimensions[value]
			if (dimension != null) output.add(dimension)
		}
	}
}

export function getDisplayedDatasetDimensions(
	datasetDimensions: string[],
	displayedCharts: MultiSeriesChart2SeriesConfig[]
): string[] {
	const displayedDimensions = new Set<string>()
	for (const chart of displayedCharts) {
		addEncodedDimensions(chart.encode.x, datasetDimensions, displayedDimensions)
		addEncodedDimensions(chart.encode.y, datasetDimensions, displayedDimensions)
	}
	return datasetDimensions.filter((dimension) => displayedDimensions.has(dimension))
}
