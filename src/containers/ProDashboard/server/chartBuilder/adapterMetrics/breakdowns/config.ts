import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type { ChartBuilderConfig } from '~/containers/ProDashboard/types'

export type AdapterChartBuilderMetric = Exclude<
	ChartBuilderConfig['config']['metric'],
	'tvl' | 'stablecoins' | 'chain-fees' | 'chain-revenue'
>

export type AdapterMetricChartBuilderConfig = {
	endpoint: `${ADAPTER_TYPES}`
	dataType?: `${ADAPTER_DATA_TYPES}`
	metricName: string
	dailyMode: 'sum' | 'last'
}

export const DIMENSIONS_API_METRIC_CONFIG: Readonly<
	Record<AdapterChartBuilderMetric, AdapterMetricChartBuilderConfig>
> = {
	fees: { endpoint: 'fees', metricName: 'fees', dailyMode: 'sum' },
	revenue: { endpoint: 'fees', dataType: 'dailyRevenue', metricName: 'revenue', dailyMode: 'sum' },
	volume: { endpoint: 'dexs', metricName: 'volume', dailyMode: 'sum' },
	perps: { endpoint: 'derivatives', metricName: 'perps volume', dailyMode: 'sum' },
	'options-notional': {
		endpoint: 'options',
		dataType: 'dailyNotionalVolume',
		metricName: 'options notional',
		dailyMode: 'sum'
	},
	'options-premium': {
		endpoint: 'options',
		dataType: 'dailyPremiumVolume',
		metricName: 'options premium',
		dailyMode: 'sum'
	},
	'bridge-aggregators': { endpoint: 'bridge-aggregators', metricName: 'bridge volume', dailyMode: 'sum' },
	'dex-aggregators': { endpoint: 'aggregators', metricName: 'DEX aggregator volume', dailyMode: 'sum' },
	'perps-aggregators': {
		endpoint: 'aggregator-derivatives',
		metricName: 'perps aggregator volume',
		dailyMode: 'sum'
	},
	'user-fees': { endpoint: 'fees', dataType: 'dailyUserFees', metricName: 'user fees', dailyMode: 'sum' },
	'holders-revenue': {
		endpoint: 'fees',
		dataType: 'dailyHoldersRevenue',
		metricName: 'holders revenue',
		dailyMode: 'sum'
	},
	'protocol-revenue': {
		endpoint: 'fees',
		dataType: 'dailyProtocolRevenue',
		metricName: 'protocol revenue',
		dailyMode: 'sum'
	},
	'supply-side-revenue': {
		endpoint: 'fees',
		dataType: 'dailySupplySideRevenue',
		metricName: 'supply side revenue',
		dailyMode: 'sum'
	},
	'open-interest': {
		endpoint: 'open-interest',
		dataType: 'openInterestAtEnd',
		metricName: 'open interest',
		dailyMode: 'last'
	}
}

export function parseAdapterChartBuilderMetric(metric: string): AdapterChartBuilderMetric | null {
	switch (metric) {
		case 'fees':
		case 'revenue':
		case 'volume':
		case 'perps':
		case 'open-interest':
		case 'options-notional':
		case 'options-premium':
		case 'bridge-aggregators':
		case 'dex-aggregators':
		case 'perps-aggregators':
		case 'user-fees':
		case 'holders-revenue':
		case 'protocol-revenue':
		case 'supply-side-revenue':
			return metric
		default:
			return null
	}
}
