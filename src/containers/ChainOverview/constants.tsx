import { CHART_COLORS } from '~/constants/colors'
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

export function getChainOverviewPaletteColor(index: number): string {
	const color = CHART_COLORS[index]
	if (color === undefined) {
		throw new Error(`Missing ChainOverview chart color at palette index ${index}`)
	}
	return color
}

export const chainOverviewChartColors = {
	TVL: getChainOverviewPaletteColor(0),
	'Stablecoins Mcap': getChainOverviewPaletteColor(1),
	'Chain Fees': getChainOverviewPaletteColor(2),
	'Chain Revenue': getChainOverviewPaletteColor(3),
	'Holders Revenue': getChainOverviewPaletteColor(25),
	'DEXs Volume': getChainOverviewPaletteColor(4),
	'Perps Volume': getChainOverviewPaletteColor(5),
	'Token Incentives': getChainOverviewPaletteColor(6),
	'App Revenue': getChainOverviewPaletteColor(7),
	'App Fees': getChainOverviewPaletteColor(8),
	'Bridged TVL': getChainOverviewPaletteColor(9),
	'Active Addresses': getChainOverviewPaletteColor(10),
	'New Addresses': getChainOverviewPaletteColor(11),
	Transactions: getChainOverviewPaletteColor(12),
	Raises: getChainOverviewPaletteColor(13),
	'Net Inflows': getChainOverviewPaletteColor(14),
	'Core Developers': getChainOverviewPaletteColor(15),
	'Devs Commits': getChainOverviewPaletteColor(16),
	'Token Mcap': getChainOverviewPaletteColor(17),
	'Token Price': getChainOverviewPaletteColor(18),
	'Token Volume': getChainOverviewPaletteColor(19)
} satisfies {
	[K in ChainChartLabels]: string
}
