export type FeeRevenueMetricId = 'chainFees' | 'chainRevenue' | 'chainHoldersRevenue' | 'appFees' | 'appRevenue' | 'rev'
export type ChainOverviewFeeRevenueMetricId = Exclude<FeeRevenueMetricId, 'rev'>
export type FeeRevenueChartLabel = 'Chain Fees' | 'Chain Revenue' | 'Holders Revenue' | 'App Fees' | 'App Revenue'
export type FeeRevenueRankingLabel = FeeRevenueChartLabel | 'REV'
export type FeeRevenueConcept = 'chain-native' | 'app-aggregation' | 'rev'
export type FeeRevenueMetadataFlag = 'chainFees' | 'chainRevenue' | 'chainHoldersRevenue' | 'fees' | 'revenue'
export type FeeRevenueRankingRoute =
	| '/fees/chains'
	| '/revenue/chains'
	| '/app-fees/chains'
	| '/app-revenue/chains'
	| '/rev/chains'
export type FeeRevenueRankingBuilder = 'chain-native' | 'app-aggregation' | 'rev'
export type FeeRevenueAdapterType = 'fees'
export type ChainNativeFeeRevenueRankingDataType = 'dailyFees' | 'dailyRevenue'
export type AppAggregationFeeRevenueRankingDataType = 'dailyAppFees' | 'dailyAppRevenue'
export type FeeRevenueRankingDataType = ChainNativeFeeRevenueRankingDataType | AppAggregationFeeRevenueRankingDataType

type FeeRevenueRankingBase = {
	route: FeeRevenueRankingRoute
	name: string
	tab: 'Chains'
	totalTrackedKey: string
}

export type FeeRevenueRankingSemantics =
	| (FeeRevenueRankingBase & {
			builder: 'chain-native'
			dataType: ChainNativeFeeRevenueRankingDataType
	  })
	| (FeeRevenueRankingBase & {
			builder: 'app-aggregation'
			dataType: AppAggregationFeeRevenueRankingDataType
	  })
	| (FeeRevenueRankingBase & {
			builder: 'rev'
			dataType?: never
	  })

export type AdapterProtocolChainChartSource = {
	kind: 'adapter-protocol'
	entity: 'chain'
	adapterType: FeeRevenueAdapterType
	dataType?: 'dailyRevenue' | 'dailyHoldersRevenue'
}

export type AdapterChainChartSource = {
	kind: 'adapter-chain'
	adapterType: FeeRevenueAdapterType
	dataType: AppAggregationFeeRevenueRankingDataType
}

export type FeeRevenueChartSource = AdapterProtocolChainChartSource | AdapterChainChartSource

export type ChainOverviewFeeRevenueSemantics = {
	chartKey: string
	queryKey: string
	// Names the server request's timing; only metrics the server fetches have one.
	phase?: string
	excludeAllChains: boolean
	source: FeeRevenueChartSource
}

export type FeeRevenueMetric = {
	id: FeeRevenueMetricId
	label: FeeRevenueRankingLabel
	concept: FeeRevenueConcept
	metadataFlag: FeeRevenueMetadataFlag
	// Chain Holders Revenue has no chain-native ranking page.
	ranking?: FeeRevenueRankingSemantics
	chainOverview?: ChainOverviewFeeRevenueSemantics
}

export type ChainOverviewFeeRevenueMetric = FeeRevenueMetric & {
	id: ChainOverviewFeeRevenueMetricId
	label: FeeRevenueChartLabel
	chainOverview: ChainOverviewFeeRevenueSemantics
}

export type ChainNativeFeeRevenueMetric = ChainOverviewFeeRevenueMetric & {
	id: 'chainFees' | 'chainRevenue' | 'chainHoldersRevenue'
	concept: 'chain-native'
	metadataFlag: 'chainFees' | 'chainRevenue' | 'chainHoldersRevenue'
	chainOverview: ChainOverviewFeeRevenueSemantics & {
		source: AdapterProtocolChainChartSource
	}
}
