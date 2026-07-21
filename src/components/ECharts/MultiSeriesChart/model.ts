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
 * Merge independently timed series into one row-major dataset. The common aligned
 * case avoids a Map and sort; truly sparse time series are sorted once after merging.
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
