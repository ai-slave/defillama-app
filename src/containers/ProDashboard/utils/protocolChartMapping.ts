import type { ProtocolChartsLabels } from '~/containers/ProtocolOverview/constants'
import type { ProtocolChartType } from '../types'

const PROTOCOL_TO_DASHBOARD_CHART_TYPE: Record<ProtocolChartsLabels, ProtocolChartType | null> = {
	TVL: 'tvl',
	'RWA AUM': null,
	'Total Assets': 'tvl',
	Mcap: 'tokenMcap',
	'Token Price': 'tokenPrice',
	'Token Volume': 'tokenVolume',
	FDV: null,
	Fees: 'fees',
	Revenue: 'revenue',
	'Holders Revenue': 'holdersRevenue',
	'DEX Volume': 'volume',
	'DEX Notional Volume': null,
	'Perp Volume': 'perps',
	'Open Interest': 'openInterest',
	'Options Premium Volume': 'optionsPremium',
	'Options Notional Volume': 'optionsNotional',
	'Options Open Interest': 'optionsOpenInterest',
	'Perp Aggregator Volume': 'perpsAggregators',
	'Bridge Aggregator Volume': 'bridgeAggregators',
	'DEX Aggregator Volume': 'aggregators',
	'Liquidation Volume': null,
	'Collateral Liquidated': null,
	Unlocks: 'unlocks',
	Incentives: 'incentives',
	Staking: null,
	'Active Loans': 'borrowed',
	'Median APY': 'medianApy',
	'USD Inflows': null,
	Treasury: 'treasury',
	'Bridge Deposits': null,
	'Bridge Withdrawals': null,
	'Active Addresses': 'activeUsers',
	'New Addresses': 'newUsers',
	Transactions: 'txs',
	'Gas Used': 'gasUsed',
	Tweets: null,
	'Bridge Volume': null,
	TVS: null
}

export function getSupportedProtocolCharts(
	labels: Array<ProtocolChartsLabels>
): Array<{ label: ProtocolChartsLabels; dashboardType: ProtocolChartType }> {
	return labels
		.map((label) => ({
			label,
			dashboardType: PROTOCOL_TO_DASHBOARD_CHART_TYPE[label]
		}))
		.filter(
			(item): item is { label: ProtocolChartsLabels; dashboardType: ProtocolChartType } => item.dashboardType !== null
		)
}

export function getUnsupportedProtocolCharts(labels: Array<ProtocolChartsLabels>): Array<ProtocolChartsLabels> {
	return labels.filter((label) => PROTOCOL_TO_DASHBOARD_CHART_TYPE[label] === null)
}
