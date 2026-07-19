import {
	createSingleSeriesChartOptions,
	createTimeSeriesChartOptions
} from '~/components/ECharts/timeSeriesChartOptions'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { CHART_COLORS } from '~/constants/colors'

export const tvlApyDimensions: MultiSeriesChart2Dataset['dimensions'] = ['timestamp', 'APY', 'TVL']
export const supplyApyDimensions: MultiSeriesChart2Dataset['dimensions'] = ['timestamp', 'Base', 'Reward', 'Intrinsic']
export const supplyApy7dDimensions: MultiSeriesChart2Dataset['dimensions'] = ['timestamp', '7d Supply APY']
export const borrowApyDimensions: MultiSeriesChart2Dataset['dimensions'] = [
	'timestamp',
	'Base cost',
	'Reward offset',
	'Intrinsic'
]
export const netBorrowApyDimensions: MultiSeriesChart2Dataset['dimensions'] = ['timestamp', 'Net borrow cost']

export const tvlApyCharts = [
	{
		type: 'line' as const,
		name: 'APY',
		encode: { x: 'timestamp', y: 'APY' },
		color: '#cc3e82',
		yAxisIndex: 0,
		valueSymbol: '%'
	},
	{
		type: 'line' as const,
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: '#3e79cc',
		yAxisIndex: 1,
		valueSymbol: '$'
	}
] satisfies MultiSeriesChart2SeriesConfig[]

export const supplyApyCharts = [
	{
		type: 'bar' as const,
		name: 'Base',
		encode: { x: 'timestamp', y: 'Base' },
		color: CHART_COLORS[0],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Reward',
		encode: { x: 'timestamp', y: 'Reward' },
		color: CHART_COLORS[1],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Intrinsic',
		encode: { x: 'timestamp', y: 'Intrinsic' },
		color: CHART_COLORS[2],
		stack: 'a'
	}
] satisfies MultiSeriesChart2SeriesConfig[]

export const supplyApy7dCharts = [
	{
		type: 'line' as const,
		name: '7d Supply APY',
		encode: { x: 'timestamp', y: '7d Supply APY' },
		color: CHART_COLORS[0]
	}
] satisfies MultiSeriesChart2SeriesConfig[]

export const borrowApyCharts = [
	{
		type: 'bar' as const,
		name: 'Base cost',
		encode: { x: 'timestamp', y: 'Base cost' },
		color: CHART_COLORS[0],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Reward offset',
		encode: { x: 'timestamp', y: 'Reward offset' },
		color: CHART_COLORS[1],
		stack: 'a'
	},
	{
		type: 'bar' as const,
		name: 'Intrinsic',
		encode: { x: 'timestamp', y: 'Intrinsic' },
		color: CHART_COLORS[2],
		stack: 'a'
	}
] satisfies MultiSeriesChart2SeriesConfig[]

export const netBorrowApyCharts = [
	{
		type: 'line' as const,
		name: 'Net borrow cost',
		encode: { x: 'timestamp', y: 'Net borrow cost' },
		color: CHART_COLORS[0]
	}
] satisfies MultiSeriesChart2SeriesConfig[]

export const percentTimeChartOptions = createTimeSeriesChartOptions('%')
export const singlePercentTimeChartOptions = createSingleSeriesChartOptions('%')
