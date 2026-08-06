import { CHART_ZOOM_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/adaptedChartTypes'
import {
	createCategoryTooltipFormatter,
	type AdaptedLlamaAICartesianChart,
	type LlamaAICartesianDatasetRow
} from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import type { ChartCapabilities, ChartViewState } from '~/containers/LlamaAI/utils/chartCapabilities'

type GroupingInterval = 'day' | 'week' | 'month' | 'quarter' | 'year'

const GROUP_BY_LABEL: Record<GroupingInterval, AdaptedLlamaAICartesianChart['props']['groupBy']> = {
	day: 'daily',
	week: 'weekly',
	month: 'monthly',
	quarter: 'quarterly',
	year: 'yearly'
}

function cloneChartOptions(chartOptions: AdaptedLlamaAICartesianChart['props']['chartOptions']) {
	if (!chartOptions) return undefined

	const deepCloneValue = <T>(value: T): T => {
		if (Array.isArray(value)) {
			return value.map((item) => deepCloneValue(item)) as T
		}

		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).map(([key, nestedValue]) => [key, deepCloneValue(nestedValue)])
			) as T
		}

		return value
	}

	return deepCloneValue(chartOptions)
}

function cloneCartesianChart(
	chart: AdaptedLlamaAICartesianChart,
	cloneDatasetRows: boolean
): AdaptedLlamaAICartesianChart {
	return {
		...chart,
		props: {
			...chart.props,
			dataset: {
				source: cloneDatasetRows
					? chart.props.dataset.source.map((row) => [...row] as LlamaAICartesianDatasetRow)
					: chart.props.dataset.source,
				dimensions: [...chart.props.dataset.dimensions]
			},
			charts: chart.props.charts?.map((series) => ({ ...series })) ?? [],
			chartOptions: cloneChartOptions(chart.props.chartOptions),
			hallmarks: chart.props.hallmarks ? [...chart.props.hallmarks] : undefined
		},
		seriesMeta: chart.seriesMeta.map((series) => ({ ...series }))
	}
}

function isTimeChart(chart: AdaptedLlamaAICartesianChart) {
	return chart.axisType === 'time' && chart.props.dataset.dimensions[0] === 'timestamp'
}

function readTimestampMs(row: LlamaAICartesianDatasetRow): number | null {
	const timestamp = row[0]
	if (typeof timestamp === 'number') return Number.isFinite(timestamp) ? timestamp : null
	if (typeof timestamp !== 'string') return null

	// Restored sessions created before timestamps were normalized can still contain strings.
	const legacyTimestamp = timestamp.trim()
	if (!legacyTimestamp) return null
	const parsedTimestamp = Number(legacyTimestamp)
	if (Number.isFinite(parsedTimestamp)) return parsedTimestamp < 1e12 ? parsedTimestamp * 1e3 : parsedTimestamp

	const parsedDate = Date.parse(legacyTimestamp)
	return Number.isFinite(parsedDate) ? parsedDate : null
}

export class ChartDataTransformer {
	static applyViewState(
		adaptedChart: AdaptedLlamaAICartesianChart,
		state: ChartViewState,
		capabilities: ChartCapabilities
	): AdaptedLlamaAICartesianChart
	static applyViewState(
		adaptedChart: AdaptedChartData,
		state: ChartViewState,
		capabilities: ChartCapabilities
	): AdaptedChartData
	static applyViewState(
		adaptedChart: AdaptedChartData,
		state: ChartViewState,
		capabilities: ChartCapabilities
	): AdaptedChartData {
		// Always transform from the immutable adapted chart. This avoids state toggles
		// compounding on top of prior transformed output and drifting over time.
		if (adaptedChart.chartType === 'pie') return adaptedChart

		if (adaptedChart.chartType !== 'cartesian') {
			return adaptedChart
		}

		const shouldGroup = state.grouping !== 'day' && capabilities.allowGrouping
		const shouldAccumulate = state.cumulative && capabilities.allowCumulative
		const shouldConvertToPercentage = state.percentage && capabilities.allowPercentage
		const shouldStack = !shouldConvertToPercentage && state.stacked && capabilities.allowStack
		const displayedHallmarks = state.showHallmarks ? adaptedChart.props.hallmarks : undefined
		if (!shouldGroup && !shouldAccumulate && !shouldConvertToPercentage && !shouldStack) {
			if (displayedHallmarks === adaptedChart.props.hallmarks) return adaptedChart
			return { ...adaptedChart, props: { ...adaptedChart.props, hallmarks: displayedHallmarks } }
		}

		let transformedChart = cloneCartesianChart(
			adaptedChart,
			shouldGroup || shouldAccumulate || shouldConvertToPercentage
		)

		// Apply view-state transforms in display order so each step sees canonical input.
		if (shouldGroup) {
			transformedChart = this.groupByInterval(transformedChart, state.grouping)
		}

		if (shouldAccumulate) {
			transformedChart = this.applyCumulativeToSeries(transformedChart)
		}

		if (shouldConvertToPercentage) {
			transformedChart = this.toPercentage(transformedChart, state.stacked)
		} else if (shouldStack) {
			transformedChart = this.toStacked(transformedChart)
		}

		const primarySeries = [] as typeof transformedChart.seriesMeta
		let hasSecondaryAxis = false
		for (const series of transformedChart.seriesMeta) {
			if ((series.yAxisIndex ?? 0) > 0) hasSecondaryAxis = true
			else primarySeries.push(series)
		}
		const isPercentage = shouldConvertToPercentage
		// Clamp axis to 0-100 only when all percentage values fall within that range
		// (i.e. classic share-of-total with no negative source values).
		let canClampAxis = isPercentage && !hasSecondaryAxis
		if (canClampAxis) {
			rows: for (const row of transformedChart.props.dataset.source) {
				for (const series of primarySeries) {
					const value = row[series.seriesIndex + 1]
					if (typeof value === 'number' && (value < 0 || value > 100)) {
						canClampAxis = false
						break rows
					}
				}
			}
		}
		const percentageTooltipFormatter =
			isPercentage && transformedChart.axisType === 'category'
				? createCategoryTooltipFormatter('%', transformedChart.props.charts ?? [])
				: undefined

		const percentageChartOptions: Record<string, any> | undefined = isPercentage
			? {
					grid: chartGrid({ top: 24, bottom: CHART_ZOOM_RESERVE }),
					...(percentageTooltipFormatter ? { tooltip: { formatter: percentageTooltipFormatter } } : {}),
					...(!hasSecondaryAxis
						? {
								yAxis: {
									...(canClampAxis ? { max: 100, min: 0 } : {}),
									axisLabel: { formatter: '{value}%' }
								}
							}
						: {})
				}
			: undefined

		const chartOptions = percentageChartOptions
			? { ...transformedChart.props.chartOptions, ...percentageChartOptions }
			: transformedChart.props.chartOptions

		return {
			...transformedChart,
			props: {
				...transformedChart.props,
				valueSymbol: shouldConvertToPercentage ? '%' : adaptedChart.props.valueSymbol,
				hallmarks: displayedHallmarks,
				// Axis scaling is renderer policy. Keeping it out of this data transformer avoids
				// stale log options when stacked/percentage modes require a zero baseline.
				chartOptions
			}
		}
	}

	private static groupByInterval(
		chart: AdaptedLlamaAICartesianChart,
		interval: GroupingInterval
	): AdaptedLlamaAICartesianChart {
		const nextChart = chart
		nextChart.props.groupBy = GROUP_BY_LABEL[interval]

		if (!isTimeChart(nextChart) || interval === 'day') {
			return nextChart
		}

		const groupBy =
			interval === 'week'
				? 'weekly'
				: interval === 'month'
					? 'monthly'
					: interval === 'quarter'
						? 'quarterly'
						: 'yearly'
		const groupedSource: LlamaAICartesianDatasetRow[] = []

		// Adapted time datasets are chronological, so equal buckets are contiguous and
		// can be aggregated without a Map, per-series tuple arrays, or a reconstruction sort.
		for (const inputRow of nextChart.props.dataset.source) {
			const timestamp = readTimestampMs(inputRow)
			if (timestamp == null) continue
			const bucketTimestamp = getBucketTimestampMs(timestamp, groupBy)
			let outputRow = groupedSource[groupedSource.length - 1]
			if (outputRow?.[0] !== bucketTimestamp) {
				outputRow = new Array<number | null>(nextChart.seriesMeta.length + 1)
				outputRow[0] = bucketTimestamp
				groupedSource.push(outputRow)
			}

			for (const meta of nextChart.seriesMeta) {
				const valueIndex = meta.seriesIndex + 1
				const value = inputRow[valueIndex]
				if (typeof value !== 'number' || Number.isNaN(value)) continue

				if (meta.metricClass === 'flow') {
					const previousValue = outputRow[valueIndex]
					outputRow[valueIndex] = (typeof previousValue === 'number' ? previousValue : 0) + value
				} else {
					outputRow[valueIndex] = value
				}
			}
		}

		nextChart.props.dataset.source = groupedSource

		nextChart.rowCount = nextChart.props.dataset.source.length
		return nextChart
	}

	private static applyCumulativeToSeries(chart: AdaptedLlamaAICartesianChart): AdaptedLlamaAICartesianChart {
		const nextChart = chart
		if (!isTimeChart(nextChart)) return nextChart
		const cumulativeSeries = nextChart.seriesMeta.filter(
			(meta) => meta.metricClass === 'flow' && meta.baseType === 'bar'
		)
		if (cumulativeSeries.length === 0) return nextChart

		const cumulativeNames = new Set(cumulativeSeries.map((meta) => meta.name))
		const cumulativeTotals = new Array<number>(nextChart.seriesMeta.length).fill(0)
		const seriesCount = nextChart.seriesMeta.length
		const source = nextChart.props.dataset.source
		let writeIndex = 0

		for (const row of source) {
			const timestamp = readTimestampMs(row)
			if (timestamp == null) continue
			row[0] = timestamp

			for (const meta of cumulativeSeries) {
				const valueIndex = meta.seriesIndex + 1
				const value = row[valueIndex]
				const total =
					cumulativeTotals[meta.seriesIndex] + (typeof value === 'number' && !Number.isNaN(value) ? value : 0)
				cumulativeTotals[meta.seriesIndex] = total
				row[valueIndex] = total
			}

			source[writeIndex++] = row
		}
		source.length = writeIndex
		nextChart.props.charts =
			nextChart.props.charts?.map((series) => {
				if (!cumulativeNames.has(series.name)) return series
				const { hideAreaStyle: _hideAreaStyle, stack: _stack, ...rest } = series
				return {
					...rest,
					type: 'line' as const,
					// Single-series cumulative charts can use the default gradient area fill.
					// For multi-series cumulative charts, keep plain lines to avoid overlapping filled areas.
					...(seriesCount > 1 ? { hideAreaStyle: true } : {})
				}
			}) ?? []

		nextChart.rowCount = nextChart.props.dataset.source.length
		return nextChart
	}

	// Series keep their config order when stacked — it is user- and model-controlled
	// (saved reorders, series_sort/series_order at generation), never re-derived here.
	private static toStacked(chart: AdaptedLlamaAICartesianChart): AdaptedLlamaAICartesianChart {
		chart.props.charts =
			chart.props.charts?.map((series) => {
				const isPrimaryAxis = (series.yAxisIndex ?? 0) === 0
				if (!isPrimaryAxis) {
					const { stack: _stack, ...rest } = series
					return rest
				}
				return { ...series, stack: 'total' }
			}) ?? []
		return chart
	}

	private static toPercentage(
		chart: AdaptedLlamaAICartesianChart,
		shouldStack: boolean = true
	): AdaptedLlamaAICartesianChart {
		const nextChart = chart
		const primarySeries = nextChart.seriesMeta.filter((series) => (series.yAxisIndex ?? 0) === 0)
		if (primarySeries.length === 0) return nextChart

		const primarySeriesNames = new Set(primarySeries.map((series) => series.name))

		// Use sum-of-absolutes as denominator so negative values produce signed
		// percentages (e.g. -200M / 700M → -28.6%).  For all-positive data this
		// is identical to a plain sum.
		let allPositive = true
		for (const row of nextChart.props.dataset.source) {
			let absTotal = 0
			for (const series of primarySeries) {
				const value = row[series.seriesIndex + 1]
				if (typeof value !== 'number' || Number.isNaN(value)) continue
				absTotal += Math.abs(value)
				if (value < 0) allPositive = false
			}

			for (const series of primarySeries) {
				const valueIndex = series.seriesIndex + 1
				const value = row[valueIndex]
				const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0
				row[valueIndex] = absTotal > 0 ? (numericValue / absTotal) * 100 : 0
			}
		}

		// Time-series charts use the legacy stacked-area convention for percentages.
		// Category-axis charts keep their native primitive (bars stay bars).
		const isCategoryAxis = nextChart.axisType === 'category'

		nextChart.props.charts =
			nextChart.props.charts?.map((series) => {
				if (!primarySeriesNames.has(series.name)) return series

				const { hideAreaStyle: _hideAreaStyle, stack: _stack, ...rest } = series
				const nextType = isCategoryAxis ? series.type : ('line' as const)
				const isLineType = nextType === 'line'
				return {
					...rest,
					type: nextType,
					valueSymbol: '%',
					...(shouldStack && allPositive ? { stack: 'total' } : isLineType ? { hideAreaStyle: true } : {})
				}
			}) ?? []

		nextChart.props.valueSymbol = '%'
		return nextChart
	}
}
