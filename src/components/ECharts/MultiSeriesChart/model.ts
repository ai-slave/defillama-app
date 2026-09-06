import type { CanonicalMultiSeriesChartDataset, MultiSeriesChartArrayRow, MultiSeriesChartSeriesConfig } from './types'

type CartesianSeriesSpec = {
	name: string
	type: 'line' | 'bar'
	color?: string
	stack?: string
	yAxisIndex?: number
	valueSymbol?: string
	legendIconUrl?: string
	areaStyle?: MultiSeriesChartSeriesConfig['areaStyle']
	barMaxWidth?: number
	connectNulls?: boolean
}

export type SparseCartesianSeries = CartesianSeriesSpec & {
	data: ReadonlyArray<readonly [number | string, number | null]>
}

type AlignedCartesianSeries = CartesianSeriesSpec & {
	values: ReadonlyArray<number | null | undefined>
}

export type CartesianChartModel = {
	dataset: CanonicalMultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
}

function buildCharts(series: ReadonlyArray<CartesianSeriesSpec>): Array<MultiSeriesChartSeriesConfig> {
	return series.map((item, seriesIndex) => {
		const chart: MultiSeriesChartSeriesConfig = {
			type: item.type,
			name: item.name,
			encode: { x: 0, y: seriesIndex + 1 }
		}
		if (item.color !== undefined) chart.color = item.color
		if (item.stack !== undefined) chart.stack = item.stack
		if (item.yAxisIndex !== undefined) chart.yAxisIndex = item.yAxisIndex
		if (item.valueSymbol !== undefined) chart.valueSymbol = item.valueSymbol
		if (item.legendIconUrl !== undefined) chart.legendIconUrl = item.legendIconUrl
		if (item.areaStyle !== undefined) chart.areaStyle = item.areaStyle
		if (item.barMaxWidth !== undefined) chart.barMaxWidth = item.barMaxWidth
		if (item.connectNulls !== undefined) chart.connectNulls = item.connectNulls
		return chart
	})
}

function buildIndependentCharts(
	series: ReadonlyArray<SparseCartesianSeries>,
	timestampMultiplier: 1 | 1000
): Array<MultiSeriesChartSeriesConfig> {
	const charts = buildCharts(series)
	for (const [seriesIndex, item] of series.entries()) {
		const input = item.data
		const data = new Array<[number, number | null]>(input.length)
		for (let pointIndex = 0; pointIndex < input.length; pointIndex++) {
			const point = input[pointIndex]!
			data[pointIndex] = [Number(point[0]) * timestampMultiplier, point[1]]
		}
		data.sort((a, b) => a[0] - b[0])
		const chart = charts[seriesIndex]
		if (!chart) throw new Error(`Missing chart config for series index ${seriesIndex}`)
		charts[seriesIndex] = { ...chart, encode: { x: 0, y: 1 }, data }
	}
	return charts
}

function alignIndependentStackGroups(
	series: ReadonlyArray<SparseCartesianSeries>,
	charts: Array<MultiSeriesChartSeriesConfig>,
	timestampMultiplier: 1 | 1000
) {
	const indexesByStack = new Map<string, Array<number>>()
	for (const [seriesIndex, item] of series.entries()) {
		const stack = item.stack
		if (!stack) continue
		const indexes = indexesByStack.get(stack)
		if (indexes) indexes.push(seriesIndex)
		else indexesByStack.set(stack, [seriesIndex])
	}

	for (const indexes of indexesByStack.values()) {
		if (indexes.length < 2) continue
		const rows = new Map<number, Array<number | null>>()
		for (let stackIndex = 0; stackIndex < indexes.length; stackIndex++) {
			for (const [inputTimestamp, value] of series[indexes[stackIndex]!]!.data) {
				const timestamp = Number(inputTimestamp) * timestampMultiplier
				let row = rows.get(timestamp)
				if (!row) {
					row = new Array<number | null>(indexes.length).fill(null)
					rows.set(timestamp, row)
				}
				row[stackIndex] = value
			}
		}
		const sortedRows = Array.from(rows, ([timestamp, values]) => ({ timestamp, values })).sort(
			(a, b) => a.timestamp - b.timestamp
		)
		for (let stackIndex = 0; stackIndex < indexes.length; stackIndex++) {
			const data = new Array<[number, number | null]>(sortedRows.length)
			for (let rowIndex = 0; rowIndex < sortedRows.length; rowIndex++) {
				const row = sortedRows[rowIndex]!
				data[rowIndex] = [row.timestamp, row.values[stackIndex]!]
			}
			const seriesIndex = indexes[stackIndex]!
			charts[seriesIndex] = { ...charts[seriesIndex]!, data }
		}
	}
}

function assertUniqueSeriesNames(series: ReadonlyArray<CartesianSeriesSpec>) {
	const names = new Set<string>()
	for (const item of series) {
		if (names.has(item.name)) throw new Error(`Duplicate series name "${item.name}" is not allowed`)
		names.add(item.name)
	}
}

/** Build rows directly from aligned columns without allocating intermediate point tuples. */
export function buildAlignedCartesianChartModel(
	xValues: ReadonlyArray<number | string>,
	series: ReadonlyArray<AlignedCartesianSeries>,
	options: { xDimension?: string; timestampMultiplier?: 1 | 1000 } = {}
): CartesianChartModel {
	const xDimension = options.xDimension ?? 'timestamp'
	const timestampMultiplier = options.timestampMultiplier ?? 1000
	assertUniqueSeriesNames(series)
	const source = new Array<MultiSeriesChartArrayRow>(xValues.length)

	for (const [rowIndex, x] of xValues.entries()) {
		const row = new Array<number | string | null>(series.length + 1)
		row[0] = xDimension === 'timestamp' ? Number(x) * timestampMultiplier : x
		for (const [seriesIndex, item] of series.entries()) {
			row[seriesIndex + 1] = item.values[rowIndex] ?? null
		}
		source[rowIndex] = row
	}

	return {
		dataset: { dimensions: [xDimension, ...series.map((item) => item.name)], source },
		charts: buildCharts(series)
	}
}

/**
 * Keep independently timed line calendars positional so sibling timestamps do not become gaps.
 * Already-aligned inputs retain the compact row-major representation.
 */
export function buildSparseCartesianChartModel(
	series: ReadonlyArray<SparseCartesianSeries>,
	options: { xDimension?: string; timestampMultiplier?: 1 | 1000 } = {}
): CartesianChartModel {
	const xDimension = options.xDimension ?? 'timestamp'
	const timestampMultiplier = options.timestampMultiplier ?? 1000
	assertUniqueSeriesNames(series)
	const firstData = series[0]?.data
	let isAligned = firstData !== undefined
	if (firstData) {
		for (const [seriesIndex, item] of series.entries()) {
			if (seriesIndex === 0 || !isAligned) continue
			const data = item.data
			if (data.length !== firstData.length) {
				isAligned = false
				break
			}
			for (const [rowIndex, point] of data.entries()) {
				if (point[0] !== firstData[rowIndex]![0]) {
					isAligned = false
					break
				}
			}
		}
	}

	if (isAligned && firstData) {
		const source = new Array<MultiSeriesChartArrayRow>(firstData.length)
		for (const [rowIndex, firstPoint] of firstData.entries()) {
			const inputX = firstPoint[0]
			const x = xDimension === 'timestamp' ? Number(inputX) * timestampMultiplier : inputX
			const row = new Array<number | string | null>(series.length + 1)
			row[0] = x
			for (const [seriesIndex, item] of series.entries()) {
				row[seriesIndex + 1] = item.data[rowIndex]![1]
			}
			source[rowIndex] = row
		}
		if (xDimension === 'timestamp') source.sort((a, b) => Number(a[0]) - Number(b[0]))
		return {
			dataset: { dimensions: [xDimension, ...series.map((item) => item.name)], source },
			charts: buildCharts(series)
		}
	}

	if (xDimension === 'timestamp') {
		const charts = buildIndependentCharts(series, timestampMultiplier)
		// ECharts stacks direct series by data index, so each stack group needs one shared calendar.
		// Missing stacked-line observations remain null gaps; unrelated non-stacked lines stay independent.
		alignIndependentStackGroups(series, charts, timestampMultiplier)
		return {
			dataset: { dimensions: [xDimension, ...series.map((item) => item.name)], source: [] },
			charts
		}
	}

	const rowsByX = new Map<number | string, MultiSeriesChartArrayRow>()

	for (const [seriesIndex, item] of series.entries()) {
		for (const point of item.data) {
			const x = point[0]
			let row = rowsByX.get(x)
			if (!row) {
				row = new Array<number | string | null | undefined>(series.length + 1)
				row[0] = x
				rowsByX.set(x, row)
			}
			row[seriesIndex + 1] = point[1]
		}
	}

	const source = Array.from(rowsByX.values())
	return {
		dataset: { dimensions: [xDimension, ...series.map((item) => item.name)], source },
		charts: buildCharts(series)
	}
}
