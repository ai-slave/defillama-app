import { describe, expect, test } from 'vitest'
import { migrateDashboardItemConfig } from '~/containers/ProDashboard/dashboardConfig/migrate'
import { getRwaOverviewDashboardChart, type RwaDashboardChartState } from '../rwaDashboardChart'

const FRONT_PAGE: RwaDashboardChartState = {
	metric: 'activeMcap',
	chartView: 'timeSeries',
	treemapNestedBy: 'none',
	groupBy: 'category',
	target: { kind: 'all' },
	chainName: null,
	activeFilters: false,
	includeStablecoins: false,
	includeGovernance: false,
	includeBridgeTvl: true
}

const CHAIN_PAGE: RwaDashboardChartState = {
	...FRONT_PAGE,
	groupBy: 'none',
	target: { kind: 'chain', slug: 'ethereum' },
	chainName: 'Ethereum'
}

describe('getRwaOverviewDashboardChart', () => {
	test('the front page chart pins as an overview breakdown by its Group by', () => {
		expect(getRwaOverviewDashboardChart({ ...FRONT_PAGE, metric: 'onChainMcap', chartView: 'pie' })).toEqual({
			id: 'rwa-overview-all-onChainMcap-pie-category',
			kind: 'rwa-overview',
			metric: 'onChainMcap',
			chartView: 'pie',
			breakdown: 'category'
		})
	})

	test('a chain page under Group by None pins its per-asset split with the chain name', () => {
		expect(getRwaOverviewDashboardChart(CHAIN_PAGE)).toEqual({
			id: 'rwa-overview-Ethereum-activeMcap-timeSeries-chain',
			kind: 'rwa-overview',
			metric: 'activeMcap',
			chartView: 'timeSeries',
			breakdown: 'chain',
			chain: 'Ethereum'
		})
	})

	test.each<[string, Partial<RwaDashboardChartState>]>([
		['a perps metric', { metric: 'openInterest' }],
		['a nested treemap, which the card draws flat', { chartView: 'treemap', treemapNestedBy: 'assetClass' }],
		['Net Flows', { metric: 'flows' }],
		['Flow vs Price', { metric: 'flowVsPrice' }],
		['the Share view', { chartView: 'share' }],
		['Group by None on the front page', { groupBy: 'none' }],
		['Group by Asset Class', { groupBy: 'assetClass' }],
		['an active filter', { activeFilters: true }],
		['stablecoins included', { includeStablecoins: true }],
		['governance included', { includeGovernance: true }],
		['bridge TVL excluded', { includeBridgeTvl: false }],
		['a category page', { target: { kind: 'category', slug: 'treasuries' } }],
		['a platform page', { target: { kind: 'platform', slug: 'ondo' } }],
		['an asset group page', { target: { kind: 'assetGroup', slug: 'stocks' } }]
	])('%s has no dashboard chart', (_name, patch) => {
		expect(getRwaOverviewDashboardChart({ ...FRONT_PAGE, ...patch })).toBeNull()
	})

	test.each<[string, Partial<RwaDashboardChartState>]>([
		['Group by Platform', { groupBy: 'platform' }],
		['Group by Category', { groupBy: 'category' }],
		['Group by Asset Group', { groupBy: 'assetGroup' }]
	])('a chain page under %s has no dashboard chart, the dashboard splits a chain only by asset', (_name, patch) => {
		expect(getRwaOverviewDashboardChart({ ...CHAIN_PAGE, ...patch })).toBeNull()
	})

	test('the pinned config survives the dashboard read and fetches what the page drew', () => {
		const frontPage = getRwaOverviewDashboardChart({ ...FRONT_PAGE, groupBy: 'assetGroup', chartView: 'treemap' })
		const chainPage = getRwaOverviewDashboardChart({ ...CHAIN_PAGE, metric: 'defiActiveTvl' })
		if (!frontPage || !chainPage) throw new Error('expected both charts to map')

		const frontPageRead = migrateDashboardItemConfig(frontPage)
		const chainPageRead = migrateDashboardItemConfig(chainPage)
		expect(frontPageRead).toEqual(frontPage)
		expect(chainPageRead).toEqual(chainPage)
	})
})
