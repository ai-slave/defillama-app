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
}

export const DIMENSIONS_API_METRIC_CONFIG: Readonly<
	Record<AdapterChartBuilderMetric, AdapterMetricChartBuilderConfig>
> = {
	fees: { endpoint: 'fees', metricName: 'fees' },
	revenue: { endpoint: 'fees', dataType: 'dailyRevenue', metricName: 'revenue' },
	volume: { endpoint: 'dexs', metricName: 'volume' },
	perps: { endpoint: 'derivatives', metricName: 'perps volume' },
	'options-notional': { endpoint: 'options', dataType: 'dailyNotionalVolume', metricName: 'options notional' },
	'options-premium': { endpoint: 'options', dataType: 'dailyPremiumVolume', metricName: 'options premium' },
	'bridge-aggregators': { endpoint: 'bridge-aggregators', metricName: 'bridge volume' },
	'dex-aggregators': { endpoint: 'aggregators', metricName: 'DEX aggregator volume' },
	'perps-aggregators': { endpoint: 'aggregator-derivatives', metricName: 'perps aggregator volume' },
	'user-fees': { endpoint: 'fees', dataType: 'dailyUserFees', metricName: 'user fees' },
	'holders-revenue': { endpoint: 'fees', dataType: 'dailyHoldersRevenue', metricName: 'holders revenue' },
	'protocol-revenue': { endpoint: 'fees', dataType: 'dailyProtocolRevenue', metricName: 'protocol revenue' },
	'supply-side-revenue': { endpoint: 'fees', dataType: 'dailySupplySideRevenue', metricName: 'supply side revenue' },
	'open-interest': { endpoint: 'open-interest', dataType: 'openInterestAtEnd', metricName: 'open interest' }
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
