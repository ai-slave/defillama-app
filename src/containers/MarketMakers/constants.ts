import type { MetricFormatKind } from './format'
import type { Metric } from './types'

export const DISPLAY_MODES = ['value', 'percentile', 'rank'] as const
export type DisplayMode = (typeof DISPLAY_MODES)[number]

export const TIMEFRAMES = ['All Time', 'Prev. 7d', 'Prev. 30d', 'Prev. 60d'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]
export const DEFAULT_TIMEFRAME: Timeframe = 'Prev. 30d'

export const THRESHOLDS = ['2%', '1%', '0.5%'] as const
export type Threshold = (typeof THRESHOLDS)[number]
export const THRESHOLD_TO_BUCKET: Record<Threshold, 'depth200' | 'depth100' | 'depth50'> = {
	'2%': 'depth200',
	'1%': 'depth100',
	'0.5%': 'depth50'
}

export type ColumnConfig = {
	metricKey: string
	marketKey?: string
	label: string
	kind: MetricFormatKind
}

export function selectCellNumber(metric: Metric | null | undefined, mode: DisplayMode): number | null {
	if (!metric) return null
	if (mode === 'value') return metric.value
	if (mode === 'percentile') return metric.percentile
	return metric.rank
}

export const VOLUME_COLUMNS: Array<ColumnConfig> = [
	{
		metricKey: 'orderFillVolumeMaker',
		marketKey: 'orderFillVolumeMakerMarketPercentage',
		label: 'Avg Maker',
		kind: 'usd'
	},
	{
		metricKey: 'orderFillVolumeTaker',
		marketKey: 'orderFillVolumeTakerMarketPercentage',
		label: 'Avg Taker',
		kind: 'usd'
	},
	{
		metricKey: 'orderFillVolumeTotal',
		marketKey: 'orderFillVolumeTotalMarketPercentage',
		label: 'Avg Maker & Taker',
		kind: 'usd'
	},
	{ metricKey: 'volumeLoanUtilization', label: 'Volume Loan Utilization', kind: 'percent' }
]

export const SPREAD_COLUMNS: Array<ColumnConfig> = [
	{ metricKey: 'bidAskSpread', label: 'Bid-Ask Spread', kind: 'spread' },
	{ metricKey: 'uptime', label: 'Uptime %', kind: 'percent' }
]

export const KPI_COLUMNS: Array<ColumnConfig> = [
	{ metricKey: 'bidAskDepth50', label: '0.50% Bid & Ask Depth', kind: 'percent' },
	{ metricKey: 'bidAskDepth100', label: '1.00% Bid & Ask Depth', kind: 'percent' },
	{ metricKey: 'bidAskDepth200', label: '2.00% Bid & Ask Depth', kind: 'percent' },
	{ metricKey: 'bidAskSpread', label: 'Bid-Ask Spread', kind: 'percent' },
	{ metricKey: 'uptime', label: 'Combined Uptime', kind: 'percent' }
]

export const DEPTH_COLUMNS: Array<ColumnConfig> = [
	{ metricKey: 'bidDepth', marketKey: 'bidDepthMarketPercentage', label: 'Avg Bid Depth', kind: 'usd' },
	{ metricKey: 'askDepth', marketKey: 'askDepthMarketPercentage', label: 'Avg Ask Depth', kind: 'usd' },
	{ metricKey: 'bidAskDepth', marketKey: 'bidAskDepthMarketPercentage', label: 'Avg Bid & Ask Depth', kind: 'usd' },
	{ metricKey: 'uptime', label: 'Uptime %', kind: 'percent' },
	{ metricKey: 'depthLoanUtilization', label: 'Depth Loan Utilization', kind: 'percent' }
]
