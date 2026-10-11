import { chartColor } from '~/constants/colors'
import { feeRevenueMetrics } from '~/metrics/feesRevenue'

// MAKE SURE TO UPDATE ON SERVER TOO https://github.com/DefiLlama/defillama-server/blob/master/defi/src/updateSearch.ts
export const chainCharts = {
	TVL: 'tvl',
	'Stablecoins Mcap': 'stablecoinsMcap',
	'Chain Fees': feeRevenueMetrics.chainFees.chainOverview.chartKey,
	'Chain Revenue': feeRevenueMetrics.chainRevenue.chainOverview.chartKey,
	'Holders Revenue': feeRevenueMetrics.chainHoldersRevenue.chainOverview.chartKey,
	'DEXs Volume': 'dexsVolume',
	'Perps Volume': 'perpsVolume',
	'Token Incentives': 'tokenIncentives',
	'App Revenue': feeRevenueMetrics.appRevenue.chainOverview.chartKey,
	'App Fees': feeRevenueMetrics.appFees.chainOverview.chartKey,
	'Bridged TVL': 'bridgedTVL',
	'Active Addresses': 'activeAddresses',
	'New Addresses': 'newAddresses',
	Transactions: 'transactions',
	Raises: 'raises',
	'Net Inflows': 'netInflows',
	'Core Developers': 'devsMetrics',
	'Devs Commits': 'devsCommits',
	'Token Mcap': 'chainTokenMcap',
	'Token Price': 'chainTokenPrice',
	'Token Volume': 'chainTokenVolume'
} as const

export type ChainChartLabels = keyof typeof chainCharts

export const yAxisByChart: {
	[K in keyof typeof chainCharts]: ChainChartLabels
} = {
	TVL: 'TVL',
	'Stablecoins Mcap': 'Stablecoins Mcap',
	'Chain Fees': feeRevenueMetrics.chainFees.label,
	'Chain Revenue': feeRevenueMetrics.chainFees.label,
	'Holders Revenue': feeRevenueMetrics.chainFees.label,
	'DEXs Volume': 'DEXs Volume',
	'Perps Volume': 'Perps Volume',
	'Token Incentives': 'Token Incentives',
	'App Revenue': feeRevenueMetrics.chainFees.label,
	'App Fees': feeRevenueMetrics.chainFees.label,
	'Bridged TVL': 'Bridged TVL',
	'Active Addresses': 'Active Addresses',
	'New Addresses': 'Active Addresses',
	Transactions: 'Transactions',
	Raises: 'Raises',
	'Net Inflows': 'Net Inflows',
	'Core Developers': 'Core Developers',
	'Devs Commits': 'Devs Commits',
	'Token Mcap': 'Token Mcap',
	'Token Price': 'Token Price',
	'Token Volume': 'Token Volume'
}

export const BAR_CHARTS: Array<ChainChartLabels> = [
	feeRevenueMetrics.chainFees.label,
	feeRevenueMetrics.chainRevenue.label,
	feeRevenueMetrics.chainHoldersRevenue.label,
	'DEXs Volume',
	'Perps Volume',
	'Token Incentives',
	feeRevenueMetrics.appRevenue.label,
	feeRevenueMetrics.appFees.label,
	'Active Addresses',
	'New Addresses',
	'Transactions',
	'Raises',
	'Net Inflows',
	'Core Developers',
	'Devs Commits',
	'Token Volume'
]

export const DISABLED_CUMULATIVE_CHARTS: Array<ChainChartLabels> = ['Core Developers', 'Devs Commits']

/** Picked metrics take chart colors in pick order, so a series, its chip and its axis share one color and up to ten
    picks stay distinguishable. A fixed color per metric cannot: the catalog has more metrics than the palette. */
export function getChainChartColors(toggledCharts: ReadonlyArray<ChainChartLabels>) {
	const colors: Partial<Record<ChainChartLabels, string>> = {}
	for (const [index, chart] of toggledCharts.entries()) colors[chart] = chartColor(index)
	return colors
}
