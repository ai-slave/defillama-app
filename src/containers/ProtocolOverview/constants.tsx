// MAKE SURE TO UPDATE ON SERVER TOO https://github.com/DefiLlama/defillama-server/blob/master/defi/src/updateSearch.ts
export const protocolCharts = {
	TVL: 'tvl',
	'RWA AUM': 'rwaAum',
	'Total Assets': 'totalAssets',
	TVS: 'tvs',
	Mcap: 'mcap',
	'Token Price': 'tokenPrice',
	'Token Volume': 'tokenVolume',
	FDV: 'fdv',
	Fees: 'fees',
	Revenue: 'revenue',
	'Holders Revenue': 'holdersRevenue',
	'DEX Volume': 'dexVolume',
	'DEX Notional Volume': 'dexNotionalVolume',
	'Perp Volume': 'perpVolume',
	'Open Interest': 'openInterest',
	'Options Premium Volume': 'optionsPremiumVolume',
	'Options Notional Volume': 'optionsNotionalVolume',
	'Perp Aggregator Volume': 'perpAggregatorVolume',
	'Bridge Aggregator Volume': 'bridgeAggregatorVolume',
	'DEX Aggregator Volume': 'dexAggregatorVolume',
	'Liquidation Volume': 'liquidationVolume',
	'Collateral Liquidated': 'collateralLiquidated',
	Unlocks: 'unlocks',
	Incentives: 'incentives',
	Staking: 'staking_tvl',
	'Active Loans': 'borrowed_tvl',
	'Median APY': 'medianApy',
	'USD Inflows': 'usdInflows',
	Treasury: 'treasury',
	'Bridge Deposits': 'bridgeDeposits',
	'Bridge Withdrawals': 'bridgeWithdrawals',
	'Active Addresses': 'activeAddresses',
	'New Addresses': 'newAddresses',
	Transactions: 'transactions',
	'Gas Used': 'gasUsed',
	Tweets: 'tweets',
	'NFT Volume': 'nftVolume',
	'Bridge Volume': 'bridgeVolume'
} as const

export type ProtocolChartsLabels = keyof typeof protocolCharts

export type ProtocolChartsQueryParams = (typeof protocolCharts)[keyof typeof protocolCharts]

export const yAxisByChart: {
	[K in keyof typeof protocolCharts]: ProtocolChartsLabels
} = {
	TVL: 'TVL',
	'RWA AUM': 'TVL',
	'Total Assets': 'TVL',
	TVS: 'TVL',
	Mcap: 'Mcap',
	FDV: 'Mcap',
	'Active Loans': 'TVL',
	Staking: 'TVL',
	'Token Price': 'Token Price',
	'Token Volume': 'Token Volume',
	'Bridge Deposits': 'Bridge Deposits',
	'Bridge Withdrawals': 'Bridge Deposits',
	Fees: 'Fees',
	Revenue: 'Fees',
	'Holders Revenue': 'Fees',
	Incentives: 'Fees',
	'DEX Volume': 'DEX Volume',
	'DEX Notional Volume': 'DEX Volume',
	'Perp Volume': 'DEX Volume',
	'Open Interest': 'Open Interest',
	'Options Premium Volume': 'DEX Volume',
	'Options Notional Volume': 'DEX Volume',
	'Perp Aggregator Volume': 'DEX Volume',
	'Bridge Aggregator Volume': 'DEX Volume',
	'DEX Aggregator Volume': 'DEX Volume',
	'Liquidation Volume': 'DEX Volume',
	'Collateral Liquidated': 'DEX Volume',
	Unlocks: 'Unlocks',
	'Active Addresses': 'Active Addresses',
	'New Addresses': 'Active Addresses',
	Transactions: 'Transactions',
	'Gas Used': 'Gas Used',
	'Median APY': 'Median APY',
	'USD Inflows': 'USD Inflows',
	Treasury: 'Treasury',
	Tweets: 'Tweets',
	'NFT Volume': 'NFT Volume',
	'Bridge Volume': 'DEX Volume'
}

export const protocolChartCategories = {
	Core: ['TVL', 'RWA AUM', 'Total Assets', 'TVS', 'Treasury', 'Staking', 'Active Loans', 'USD Inflows', 'Median APY'],
	Token: ['Mcap', 'FDV', 'Token Price', 'Token Volume', 'Unlocks', 'Incentives'],
	Revenue: ['Fees', 'Revenue', 'Holders Revenue'],
	Volume: [
		'DEX Volume',
		'DEX Notional Volume',
		'Perp Volume',
		'Open Interest',
		'Options Premium Volume',
		'Options Notional Volume',
		'Perp Aggregator Volume',
		'Bridge Aggregator Volume',
		'DEX Aggregator Volume',
		'NFT Volume',
		'Bridge Volume'
	],
	Liquidations: ['Liquidation Volume', 'Collateral Liquidated'],
	Bridge: ['Bridge Deposits', 'Bridge Withdrawals'],
	Activity: ['Active Addresses', 'New Addresses', 'Transactions', 'Gas Used', 'Tweets']
} as const satisfies Record<string, ReadonlyArray<ProtocolChartsLabels>>

export type ProtocolChartCategory = keyof typeof protocolChartCategories

export const protocolChartCategoryOrder: Array<ProtocolChartCategory> = [
	'Core',
	'Token',
	'Revenue',
	'Volume',
	'Liquidations',
	'Bridge',
	'Activity'
]

export const PROTOCOL_CHART_LABELS: Array<ProtocolChartsLabels> = protocolChartCategoryOrder.flatMap(
	(category) => protocolChartCategories[category]
)

export const BAR_CHARTS: Array<ProtocolChartsLabels> = [
	'DEX Volume',
	'Perp Volume',
	'Fees',
	'Revenue',
	'Holders Revenue',
	'Incentives',
	'Active Addresses',
	'New Addresses',
	'Transactions',
	'Gas Used',
	'USD Inflows',
	'Bridge Deposits',
	'Bridge Withdrawals',
	'Token Volume',
	'Tweets',
	'NFT Volume',
	'DEX Aggregator Volume',
	'DEX Notional Volume',
	'Options Premium Volume',
	'Options Notional Volume',
	'Perp Aggregator Volume',
	'Bridge Aggregator Volume',
	'Bridge Volume',
	'Liquidation Volume',
	'Collateral Liquidated'
]

// Oracle protocols with their own TVS entries (display name -> oracle name)
export const oracleProtocols: Readonly<Record<string, string>> = {
	Chainlink: 'Chainlink',
	Pyth: 'Pyth',
	Api3: 'Api3',
	'RedStone Oracles': 'RedStone'
}
