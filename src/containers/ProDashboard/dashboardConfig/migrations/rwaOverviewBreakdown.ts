import type { RWAOverviewChartConfig } from '../../types'
import type { PersistedRWAOverviewChartConfig } from '../persisted'

export function migrateRwaOverviewBreakdown(config: PersistedRWAOverviewChartConfig): RWAOverviewChartConfig {
	const { breakdown, ...rest } = config
	return {
		...rest,
		breakdown: breakdown === 'assetClass' || breakdown === 'assetName' ? 'chain' : breakdown
	}
}
