import type { RWAChartMetricKey, RWAOverviewBreakdownRequest } from '~/containers/RWA/api.types'
import type { RWAOverviewChartBreakdown } from './types'

export function getProRwaBreakdown(breakdown: RWAOverviewChartBreakdown): RWAOverviewBreakdownRequest['breakdown'] {
	return breakdown === 'assetClass' || breakdown === 'assetName' ? 'chain' : breakdown
}

export function getProRwaBreakdownQueryKey(
	breakdown: RWAOverviewChartBreakdown,
	metric: RWAChartMetricKey,
	chain?: string
) {
	return ['pro-dashboard', 'rwa-breakdown-chart', getProRwaBreakdown(breakdown), metric, chain || 'All'] as const
}
