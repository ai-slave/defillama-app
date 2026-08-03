import type { ProtocolChartsLabels } from '~/containers/ProtocolOverview/constants'
import type { ProtocolChartType } from '../types'

const PROTOCOL_TO_DASHBOARD_CHART_TYPE: Record<ProtocolChartsLabels, ProtocolChartType | null> = {
	TVL: 'tvl',
	'Total Assets': 'tvl',
	Mcap: 'tokenMcap',
	'Token Price': 'tokenPrice',
	'Token Volume': 'tokenVolume',
	'Token Liquidity': 'liquidity',
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
	'Total Proposals': null,
	'Successful Proposals': null,
	'Max Votes': null,
	'Active Addresses': 'activeUsers',
	'New Addresses': 'newUsers',
	Transactions: 'txs',
	'Gas Used': 'gasUsed',
	Tweets: null,
	'NFT Volume': null,
	'Bridge Volume': null,
	TVS: null
}

export function getSupportedProtocolCharts(
	labels: ProtocolChartsLabels[]
): { label: ProtocolChartsLabels; dashboardType: ProtocolChartType }[] {
	return labels
		.map((label) => ({
			label,
			dashboardType: PROTOCOL_TO_DASHBOARD_CHART_TYPE[label]
		}))
		.filter(
			(item): item is { label: ProtocolChartsLabels; dashboardType: ProtocolChartType } => item.dashboardType !== null
		)
}

export function getUnsupportedProtocolCharts(labels: ProtocolChartsLabels[]): ProtocolChartsLabels[] {
	return labels.filter((label) => PROTOCOL_TO_DASHBOARD_CHART_TYPE[label] === null)
}
