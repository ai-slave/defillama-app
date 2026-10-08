import type { RWAOverviewChartConfig } from '~/containers/ProDashboard/types'
import type { RWAAssetChartTarget } from '../api.types'
import type { RWAOverviewChartMetric } from '../chartBreakdown'
import type { RWAChartView, RwaTreemapNestedBy } from '../chartState'
import type { RWAGroupBy } from '../table/groupBy'

/** The overview chart's state as its panel settles it: what the Add to Dashboard button reads. */
export type RwaDashboardChartState = {
	metric: RWAOverviewChartMetric
	chartView: RWAChartView
	/** The treemap's nesting; the card draws a flat treemap only. */
	treemapNestedBy: RwaTreemapNestedBy
	groupBy: RWAGroupBy
	target: RWAAssetChartTarget
	/** The chain's display name on a chain page; the dashboard stores chains by name. */
	chainName: string | null
	activeFilters: boolean
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
}

type RwaDashboardBreakdown = RWAOverviewChartConfig['breakdown']

function getFrontPageBreakdown(groupBy: RWAGroupBy): RwaDashboardBreakdown | null {
	switch (groupBy) {
		case 'chain':
		case 'category':
		case 'platform':
		case 'assetGroup':
			return groupBy
		default:
			return null
	}
}

/**
 * The `rwa-overview` dashboard card that draws what the chart shows, or null when the card would draw something
 * else. The card reads the server split without stablecoins and governance and with bridge TVL, so the chart maps
 * only at those inclusions and without filters: the front page by Chain, Category, Platform or Asset Group, and a
 * chain page by asset (Group by None). A nested treemap stays off, since the card draws it flat.
 */
export function getRwaOverviewDashboardChart(state: RwaDashboardChartState): RWAOverviewChartConfig | null {
	const { metric, chartView } = state
	if (metric !== 'activeMcap' && metric !== 'onChainMcap' && metric !== 'defiActiveTvl') return null
	if (chartView === 'share' || (chartView === 'treemap' && state.treemapNestedBy !== 'none')) return null
	if (state.activeFilters || state.includeStablecoins || state.includeGovernance || !state.includeBridgeTvl) return null

	if (state.target.kind === 'all') {
		const breakdown = getFrontPageBreakdown(state.groupBy)
		if (!breakdown) return null
		return {
			id: `rwa-overview-all-${metric}-${chartView}-${breakdown}`,
			kind: 'rwa-overview',
			metric,
			chartView,
			breakdown
		}
	}

	if (state.target.kind === 'chain' && state.groupBy === 'none' && state.chainName) {
		const chain = state.chainName
		return {
			id: `rwa-overview-${chain}-${metric}-${chartView}-chain`,
			kind: 'rwa-overview',
			metric,
			chartView,
			breakdown: 'chain',
			chain
		}
	}

	return null
}
