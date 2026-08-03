import type { RWAChartMetricKey } from '~/containers/RWA/api.types'
import type { RWAOverviewChartBreakdown } from './types'

export function getProRwaBreakdownQueryKey(
	breakdown: RWAOverviewChartBreakdown,
	metric: RWAChartMetricKey,
	chain?: string
) {
	return ['pro-dashboard', 'rwa-breakdown-chart', breakdown, metric, chain || 'All'] as const
}
