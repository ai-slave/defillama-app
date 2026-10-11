import {
	createSingleSeriesChartOptions,
	createTimeSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'

type YieldSeries = Omit<MultiSeriesChartSeriesConfig, 'encode'>

// Each series reads the dataset column after timestamp at its own position, so encodes and dimensions come from one list.
function encodeInDatasetOrder<T extends YieldSeries>(series: Array<T>) {
	return series.map((config, index) => ({ ...config, encode: { x: 0, y: index + 1 } }))
}

function datasetDimensions(series: Array<YieldSeries>): MultiSeriesChartDataset['dimensions'] {
	return ['timestamp', ...series.map((config) => config.name)]
}

const tvlApySeries = [
	{ type: 'line' as const, name: 'APY', color: CHART_COLORS[0], yAxisIndex: 0, valueSymbol: '%' },
	{ type: 'line' as const, name: 'TVL', color: CHART_COLORS[1], yAxisIndex: 1, valueSymbol: '$' }
] satisfies Array<YieldSeries>

const supplyApySeries = [
	{ type: 'bar' as const, name: 'Base', color: CHART_COLORS[0], stack: 'a' },
	{ type: 'bar' as const, name: 'Reward', color: CHART_COLORS[1], stack: 'a' },
	{ type: 'bar' as const, name: 'Intrinsic', color: CHART_COLORS[2], stack: 'a' }
] satisfies Array<YieldSeries>

const supplyApy7dSeries = [
	{ type: 'line' as const, name: '7d Supply APY', color: CHART_COLORS[0] }
] satisfies Array<YieldSeries>

const borrowApySeries = [
	{ type: 'bar' as const, name: 'Base Cost', color: CHART_COLORS[0], stack: 'a' },
	{ type: 'bar' as const, name: 'Reward Offset', color: CHART_COLORS[1], stack: 'a' },
	{ type: 'bar' as const, name: 'Intrinsic', color: CHART_COLORS[2], stack: 'a' }
] satisfies Array<YieldSeries>

const netBorrowApySeries = [
	{ type: 'line' as const, name: 'Net Borrow Cost', color: CHART_COLORS[0] }
] satisfies Array<YieldSeries>

export const tvlApyDimensions = datasetDimensions(tvlApySeries)
export const supplyApyDimensions = datasetDimensions(supplyApySeries)
export const supplyApy7dDimensions = datasetDimensions(supplyApy7dSeries)
export const borrowApyDimensions = datasetDimensions(borrowApySeries)
export const netBorrowApyDimensions = datasetDimensions(netBorrowApySeries)

export const tvlApyCharts = encodeInDatasetOrder(tvlApySeries)
export const supplyApyCharts = encodeInDatasetOrder(supplyApySeries)
export const supplyApy7dCharts = encodeInDatasetOrder(supplyApy7dSeries)
export const borrowApyCharts = encodeInDatasetOrder(borrowApySeries)
export const netBorrowApyCharts = encodeInDatasetOrder(netBorrowApySeries)

export const percentTimeChartOptions = createTimeSeriesChartOptions('%')
export const singlePercentTimeChartOptions = createSingleSeriesChartOptions('%')
