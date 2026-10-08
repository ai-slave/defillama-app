import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { CHART_SERIES_LIMIT, OTHERS_COLOR } from '~/constants/colors'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

export const DEFAULT_ADDITIVE_SERIES_LIMIT = CHART_SERIES_LIMIT
const REMAINDER_SERIES_NAME = 'Others'

function readNumericValue(value: MultiSeriesChartDataset['source'][number][number]): number | null | undefined {
	if (value === null) return null
	return typeof value === 'number' ? value : undefined
}

/**
 * A chart export that follows the picker: the first (x) dimension, then each named dimension in the given order.
 * Names the dataset lacks have no values to export and are left out.
 */
export function selectDatasetColumns(
	dataset: MultiSeriesChartDataset,
	names: Iterable<string>
): MultiSeriesChartDataset {
	const indexByName = new Map(dataset.dimensions.map((name, index) => [name, index]))
	const columns: Array<{ name: string; index: number }> = []
	for (const name of names) {
		const index = indexByName.get(name)
		if (index !== undefined && index !== 0) columns.push({ name, index })
	}
	return projectDatasetColumns(dataset, 0, columns)
}

/** The x column and each chart's y column, named by the chart, for exporting what a chart draws. */
export function selectChartDatasetColumns(
	dataset: MultiSeriesChartDataset,
	charts: ReadonlyArray<MultiSeriesChartSeriesConfig>
): MultiSeriesChartDataset {
	const xIndex = charts[0] ? resolveDimensionIndex(charts[0].encode.x, dataset.dimensions) : 0
	return projectDatasetColumns(
		dataset,
		xIndex,
		charts.map((chart) => ({ name: chart.name, index: resolveDimensionIndex(chart.encode.y, dataset.dimensions) }))
	)
}

function projectDatasetColumns(
	dataset: MultiSeriesChartDataset,
	xIndex: number,
	columns: ReadonlyArray<{ name: string; index: number }>
): MultiSeriesChartDataset {
	const dimensions = [dataset.dimensions[xIndex]!]
	const indexes = [xIndex]
	for (const column of columns) {
		dimensions.push(column.name)
		indexes.push(column.index)
	}
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)
	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]!
		const row = new Array<MultiSeriesChartDataset['source'][number][number]>(indexes.length)
		for (let column = 0; column < indexes.length; column++) row[column] = input[indexes[column]!]
		source[rowIndex] = row
	}
	return { dimensions, source }
}

/** Rank named dataset dimensions by their peak absolute value, retaining input order for ties. */
export function rankSeriesByPeakAbsoluteValue(
	dataset: MultiSeriesChartDataset,
	seriesNames: ReadonlyArray<string>
): Array<string> {
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
			const value = readNumericValue(row[series.dimensionIndex])
			if (value == null) continue
			const magnitude = Math.abs(value)
			if (magnitude > series.peak) series.peak = magnitude
		}
	}
	return rankedSeries.sort((left, right) => right.peak - left.peak || left.order - right.order).map(({ name }) => name)
}

function resolveDimensionIndex(
	dimension: MultiSeriesChartSeriesConfig['encode']['x'],
	dimensions: Array<string>
): number {
	const encoded = Array.isArray(dimension) ? dimension[0] : dimension
	if (encoded === undefined) throw new Error('Chart encodes must contain at least one dimension')
	const index = typeof encoded === 'number' ? encoded : dimensions.indexOf(encoded)
	if (index < 0) throw new Error(`Unknown chart dimension: ${String(encoded)}`)
	return index
}

/**
 * A share chart: every row is a share of all `charts`, the whole population. The picked series (the first `limit` in
 * chart order) are drawn, and everything else, including an upstream `Others`, is one `Others` series, so each row
 * totals 100% of the same whole whatever is picked. Nothing picked draws nothing. The export lists every pick
 * without the `limit` fold. The canonical dataset stays untouched; colors and order come from the chart configs.
 */
export function buildSelectedPercentageChart({
	dataset,
	charts,
	selectedCharts,
	missingValuePolicy,
	limit = Number.POSITIVE_INFINITY
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	selectedCharts: ReadonlySet<string>
	missingValuePolicy: 'require-complete' | 'sum-available'
	limit?: number
}): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig>; csvSource: ChartCsvSource } {
	const projected = projectShareChart({ dataset, charts, selectedCharts, missingValuePolicy, limit })
	return {
		...projected,
		csvSource: {
			type: 'dataset',
			prepare: () =>
				limit === Number.POSITIVE_INFINITY
					? projected.dataset
					: projectShareChart({
							dataset,
							charts,
							selectedCharts,
							missingValuePolicy,
							limit: Number.POSITIVE_INFINITY
						}).dataset
		}
	}
}

function projectShareChart({
	dataset,
	charts,
	selectedCharts,
	missingValuePolicy,
	limit
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	selectedCharts: ReadonlySet<string>
	missingValuePolicy: 'require-complete' | 'sum-available'
	limit: number
}): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> } {
	const drawnCharts: Array<MultiSeriesChartSeriesConfig> = []
	const remainderCharts: Array<MultiSeriesChartSeriesConfig> = []
	for (const chart of charts) {
		if (chart.name !== REMAINDER_SERIES_NAME && selectedCharts.has(chart.name) && drawnCharts.length < limit) {
			drawnCharts.push(chart)
		} else remainderCharts.push(chart)
	}
	const xIndex = charts.length > 0 ? resolveDimensionIndex(charts[0]!.encode.x, dataset.dimensions) : 0
	const xDimension = dataset.dimensions[xIndex]
	if (xDimension === undefined) throw new Error('A chart dataset requires an x-axis dimension')
	const hasRemainder = drawnCharts.length > 0 && remainderCharts.length > 0
	const drawnIndexes = drawnCharts.map((chart) => resolveDimensionIndex(chart.encode.y, dataset.dimensions))
	const remainderIndexes = remainderCharts.map((chart) => resolveDimensionIndex(chart.encode.y, dataset.dimensions))
	const width = drawnCharts.length + (hasRemainder ? 1 : 0)
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)

	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]!
		const row = new Array<MultiSeriesChartDataset['source'][number][number]>(width + 1)
		row[0] = input[xIndex]
		source[rowIndex] = row
		if (width === 0) continue
		let total = 0
		let hasUnavailableValue = false
		for (let seriesIndex = 0; seriesIndex < drawnIndexes.length; seriesIndex++) {
			const value = readNumericValue(input[drawnIndexes[seriesIndex]!])
			row[seriesIndex + 1] = value
			if (value == null) hasUnavailableValue = true
			else total += value
		}
		let remainder: number | null = null
		for (const inputIndex of remainderIndexes) {
			const value = readNumericValue(input[inputIndex])
			if (value == null) hasUnavailableValue = true
			else {
				remainder = (remainder ?? 0) + value
				total += value
			}
		}
		if (hasRemainder) row[width] = remainder

		if (hasUnavailableValue && missingValuePolicy === 'require-complete') {
			for (let valueIndex = 1; valueIndex < row.length; valueIndex++) row[valueIndex] = null
			continue
		}
		let lastPositiveValueIndex = -1
		for (let valueIndex = 1; valueIndex < row.length; valueIndex++) {
			const value = readNumericValue(row[valueIndex])
			if (value != null && value > 0) lastPositiveValueIndex = valueIndex
		}
		if (total <= 0 || lastPositiveValueIndex === -1) {
			for (let valueIndex = 1; valueIndex < row.length; valueIndex++) {
				if (row[valueIndex] != null) row[valueIndex] = 0
			}
			continue
		}
		// The last positive share absorbs rounding so a complete row stacks to exactly 100.
		let normalizedTotal = 0
		for (let valueIndex = 1; valueIndex < row.length; valueIndex++) {
			const value = readNumericValue(row[valueIndex])
			if (value == null || valueIndex === lastPositiveValueIndex) continue
			const normalized = (value / total) * 100
			row[valueIndex] = normalized
			normalizedTotal += normalized
		}
		row[lastPositiveValueIndex] = 100 - normalizedTotal
	}

	const outputCharts = drawnCharts.map((chart, index) => ({ ...chart, encode: { x: 0, y: index + 1 } }))
	if (hasRemainder) {
		const template = charts.find((chart) => chart.name === REMAINDER_SERIES_NAME) ?? drawnCharts[0]!
		outputCharts.push({ ...template, name: REMAINDER_SERIES_NAME, encode: { x: 0, y: width }, color: OTHERS_COLOR })
	}
	return {
		dataset: {
			dimensions: [xDimension, ...outputCharts.map((chart) => chart.name)],
			source
		},
		charts: outputCharts
	}
}

/**
 * Bound an additive peer chart while retaining the exact selected tail as Others. The export lists every selected
 * series without that fold, plus the upstream remainder while the chart shows it.
 */
export function buildSelectedAdditiveChart({
	dataset,
	charts,
	seriesOrder,
	selectedCharts,
	limit = DEFAULT_ADDITIVE_SERIES_LIMIT,
	includeUpstreamRemainder = false
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	seriesOrder: ReadonlyArray<string>
	selectedCharts: ReadonlySet<string>
	limit?: number
	includeUpstreamRemainder?: boolean
}): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig>; csvSource: ChartCsvSource } {
	const chartByName = new Map(charts.map((chart) => [chart.name, chart]))
	const selectedSeries: Array<MultiSeriesChartSeriesConfig> = []
	for (const name of seriesOrder) {
		const chart = chartByName.get(name)
		if (name !== REMAINDER_SERIES_NAME && selectedCharts.has(name) && chart) selectedSeries.push(chart)
	}
	const selectedNames = selectedSeries.map((chart) => chart.name)
	const namedLimit = Math.max(1, limit)
	const includesUpstreamRemainder = includeUpstreamRemainder && chartByName.has(REMAINDER_SERIES_NAME)
	const csvSource: ChartCsvSource = {
		type: 'dataset',
		prepare: () =>
			selectChartDatasetColumns(
				dataset,
				includesUpstreamRemainder ? [...selectedSeries, chartByName.get(REMAINDER_SERIES_NAME)!] : selectedSeries
			)
	}
	if (selectedNames.length <= namedLimit && !includesUpstreamRemainder) {
		return { dataset, charts: selectedSeries, csvSource }
	}
	const visibleSeries = selectedSeries.slice(0, namedLimit)
	const visibleNames = visibleSeries.map((chart) => chart.name)
	const remainderNames = selectedNames.slice(namedLimit)
	if (includesUpstreamRemainder) remainderNames.push(REMAINDER_SERIES_NAME)
	const hasRemainder = remainderNames.length > 0
	const templateChart = selectedSeries[0] ?? charts[0]
	const xIndex = templateChart ? resolveDimensionIndex(templateChart.encode.x, dataset.dimensions) : 0
	const xDimension = dataset.dimensions[xIndex]
	if (xDimension === undefined) throw new Error('A chart dataset requires an x-axis dimension')
	const inputIndexByName = new Map(
		charts.map((chart) => [chart.name, resolveDimensionIndex(chart.encode.y, dataset.dimensions)])
	)
	const getInputIndex = (name: string) => {
		const index = inputIndexByName.get(name)
		if (index === undefined) throw new Error(`Missing chart dimension for selected series: ${name}`)
		return index
	}
	const dimensions = [xDimension, ...visibleNames, ...(hasRemainder ? [REMAINDER_SERIES_NAME] : [])]
	const visibleIndexes = visibleNames.map(getInputIndex)
	const remainderIndexes = remainderNames.map(getInputIndex)
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)

	for (const [rowIndex, input] of dataset.source.entries()) {
		const row = new Array<MultiSeriesChartDataset['source'][number][number]>(dimensions.length)
		row[0] = input[xIndex]
		for (const [seriesIndex, inputIndex] of visibleIndexes.entries()) {
			row[seriesIndex + 1] = input[inputIndex]
		}
		if (hasRemainder) {
			let remainder = 0
			let hasValue = false
			let hasUnavailableValue = false
			for (const inputIndex of remainderIndexes) {
				const value = readNumericValue(input[inputIndex])
				if (value == null) {
					hasUnavailableValue = true
					continue
				}
				remainder += value
				hasValue = true
			}
			row[row.length - 1] = hasUnavailableValue ? null : hasValue ? remainder : undefined
		}
		source[rowIndex] = row
	}

	const outputCharts = visibleSeries.map((chart, index) => ({
		...chart,
		encode: { x: 0, y: index + 1 }
	}))
	if (hasRemainder) {
		const template = chartByName.get(REMAINDER_SERIES_NAME) ?? templateChart
		if (template) {
			outputCharts.push({
				...template,
				name: REMAINDER_SERIES_NAME,
				encode: { x: 0, y: outputCharts.length + 1 },
				color: OTHERS_COLOR
			})
		}
	}

	return { dataset: { dimensions, source }, charts: outputCharts, csvSource }
}
