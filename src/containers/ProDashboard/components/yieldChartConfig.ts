import {
	createSingleSeriesChartOptions,
	createTimeSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'

export const tvlApyDimensions: MultiSeriesChartDataset['dimensions'] = ['timestamp', 'APY', 'TVL']
export const supplyApyDimensions: MultiSeriesChartDataset['dimensions'] = ['timestamp', 'Base', 'Reward', 'Intrinsic']
export const supplyApy7dDimensions: MultiSeriesChartDataset['dimensions'] = ['timestamp', '7d Supply APY']
export const borrowApyDimensions: MultiSeriesChartDataset['dimensions'] = [
	'timestamp',
	'Base cost',
	'Reward offset',
	'Intrinsic'
]
export const netBorrowApyDimensions: MultiSeriesChartDataset['dimensions'] = ['timestamp', 'Net borrow cost']

export const tvlApyCharts = [
	{
		type: 'line' as const,
		name: 'APY',
		encode: { x: 0, y: 1 },
		color: '#cc3e82',
		yAxisIndex: 0,
		valueSymbol: '%'
	},
	{
		type: 'line' as const,
		name: 'TVL',
		encode: { x: 0, y: 2 },
		color: '#3e79cc',
		yAxisIndex: 1,
		valueSymbol: '$'
	}
] satisfies MultiSeriesChartSeriesConfig[]

export const supplyApyCharts = [
	{
		type: 'bar' as const,
		name: 'Base',
		encode: { x: 0, y: 1 },
		color: CHART_COLORS[0],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Reward',
		encode: { x: 0, y: 2 },
		color: CHART_COLORS[1],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Intrinsic',
		encode: { x: 0, y: 3 },
		color: CHART_COLORS[2],
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

export const supplyApy7dCharts = [
	{
		type: 'line' as const,
		name: '7d Supply APY',
		encode: { x: 0, y: 1 },
		color: CHART_COLORS[0]
	}
] satisfies MultiSeriesChartSeriesConfig[]

export const borrowApyCharts = [
	{
		type: 'bar' as const,
		name: 'Base cost',
		encode: { x: 0, y: 1 },
		color: CHART_COLORS[0],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Reward offset',
		encode: { x: 0, y: 2 },
		color: CHART_COLORS[1],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Intrinsic',
		encode: { x: 0, y: 3 },
		color: CHART_COLORS[2],
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

export const netBorrowApyCharts = [
	{
		type: 'line' as const,
		name: 'Net borrow cost',
		encode: { x: 0, y: 1 },
		color: CHART_COLORS[0]
	}
] satisfies MultiSeriesChartSeriesConfig[]

export const percentTimeChartOptions = createTimeSeriesChartOptions('%')
export const singlePercentTimeChartOptions = createSingleSeriesChartOptions('%')
