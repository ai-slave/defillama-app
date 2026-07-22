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
	values: readonly (number | null | undefined)[]
}

export type CartesianChartModel = {
	dataset: CanonicalMultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
}

function buildCharts(series: readonly CartesianSeriesSpec[]): MultiSeriesChartSeriesConfig[] {
	const charts = new Array<MultiSeriesChartSeriesConfig>(series.length)
	for (let i = 0; i < series.length; i++) {
		const item = series[i]
		charts[i] = {
			type: item.type,
			name: item.name,
			encode: { x: 0, y: i + 1 },
			color: item.color,
			stack: item.stack,
			yAxisIndex: item.yAxisIndex,
			valueSymbol: item.valueSymbol,
			legendIconUrl: item.legendIconUrl,
			areaStyle: item.areaStyle,
			barMaxWidth: item.barMaxWidth,
			connectNulls: item.connectNulls
		}
	}
	return charts
}

function buildIndependentCharts(
	series: readonly SparseCartesianSeries[],
	timestampMultiplier: 1 | 1000
): MultiSeriesChartSeriesConfig[] {
	const charts = buildCharts(series)
	for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
		const input = series[seriesIndex].data
		const data = new Array<[number, number | null]>(input.length)
		for (let pointIndex = 0; pointIndex < input.length; pointIndex++) {
			data[pointIndex] = [(input[pointIndex][0] as number) * timestampMultiplier, input[pointIndex][1]]
		}
		charts[seriesIndex] = { ...charts[seriesIndex], encode: { x: 0, y: 1 }, data }
	}
	return charts
}

function alignIndependentStackGroups(
	series: readonly SparseCartesianSeries[],
	charts: MultiSeriesChartSeriesConfig[],
	timestampMultiplier: 1 | 1000
) {
	const indexesByStack = new Map<string, number[]>()
	for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
		const stack = series[seriesIndex].stack
		if (!stack) continue
		const indexes = indexesByStack.get(stack)
		if (indexes) indexes.push(seriesIndex)
		else indexesByStack.set(stack, [seriesIndex])
	}

	for (const indexes of indexesByStack.values()) {
		if (indexes.length < 2) continue
		const rows = new Map<number, Array<number | null>>()
		for (let stackIndex = 0; stackIndex < indexes.length; stackIndex++) {
			for (const [inputTimestamp, value] of series[indexes[stackIndex]].data) {
				const timestamp = (inputTimestamp as number) * timestampMultiplier
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
				data[rowIndex] = [sortedRows[rowIndex].timestamp, sortedRows[rowIndex].values[stackIndex]]
			}
			charts[indexes[stackIndex]] = { ...charts[indexes[stackIndex]], data }
		}
	}
}

function assertUniqueSeriesNames(series: readonly CartesianSeriesSpec[]) {
	const names = new Set<string>()
	for (const item of series) {
		if (names.has(item.name)) throw new Error(`Duplicate series name "${item.name}" is not allowed`)
		names.add(item.name)
	}
}

/** Build rows directly from aligned columns without allocating intermediate point tuples. */
export function buildAlignedCartesianChartModel(
	xValues: readonly (number | string)[],
	series: readonly AlignedCartesianSeries[],
	options: { xDimension?: string; timestampMultiplier?: 1 | 1000 } = {}
): CartesianChartModel {
	const xDimension = options.xDimension ?? 'timestamp'
	const timestampMultiplier = options.timestampMultiplier ?? 1000
	assertUniqueSeriesNames(series)
	const source = new Array<MultiSeriesChartArrayRow>(xValues.length)

	for (let rowIndex = 0; rowIndex < xValues.length; rowIndex++) {
		const x = xValues[rowIndex]
		const row = new Array<number | string | null>(series.length + 1)
		row[0] = xDimension === 'timestamp' ? (x as number) * timestampMultiplier : x
		for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
			row[seriesIndex + 1] = series[seriesIndex].values[rowIndex] ?? null
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
	series: readonly SparseCartesianSeries[],
	options: { xDimension?: string; timestampMultiplier?: 1 | 1000 } = {}
): CartesianChartModel {
	const xDimension = options.xDimension ?? 'timestamp'
	const timestampMultiplier = options.timestampMultiplier ?? 1000
	assertUniqueSeriesNames(series)
	const firstData = series[0]?.data
	let isAligned = !!firstData
	for (let seriesIndex = 1; isAligned && seriesIndex < series.length; seriesIndex++) {
		const data = series[seriesIndex].data
		if (data.length !== firstData!.length) {
			isAligned = false
			break
		}
		for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
			if (data[rowIndex][0] !== firstData![rowIndex][0]) {
				isAligned = false
				break
			}
		}
	}

	if (isAligned) {
		const source = new Array<MultiSeriesChartArrayRow>(firstData!.length)
		for (let rowIndex = 0; rowIndex < firstData!.length; rowIndex++) {
			const inputX = firstData![rowIndex][0]
			const x = xDimension === 'timestamp' ? (inputX as number) * timestampMultiplier : inputX
			const row = new Array<number | string | null>(series.length + 1)
			row[0] = x
			for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
				row[seriesIndex + 1] = series[seriesIndex].data[rowIndex][1]
			}
			source[rowIndex] = row
		}
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

	for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
		const item = series[seriesIndex]
		for (const point of item.data) {
			const x = xDimension === 'timestamp' ? (point[0] as number) * timestampMultiplier : point[0]
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
	if (xDimension === 'timestamp') source.sort((a, b) => (a[0] as number) - (b[0] as number))
	return {
		dataset: { dimensions: [xDimension, ...series.map((item) => item.name)], source },
		charts: buildCharts(series)
	}
}
