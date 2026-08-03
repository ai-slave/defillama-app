type LegacyProtocolTableColumnPolicy =
	| { disposition: 'retain'; reason: string }
	| { disposition: 'rename'; target: string; reason: string }
	| { disposition: 'remove'; reason: string }

const SAME_CONTRACT = 'The current Unified row keeps the same product meaning.'
const SEMANTIC_ID = 'The metric is retained under the current semantic column identifier.'
const POINT_7D = 'Classic Pro means current 24h versus the 24h value seven days ago.'
const POINT_30D = 'Classic Pro means current 24h versus the 24h value 30 days ago.'
const FILTERED_SHARE =
	'The classic column divides a positive top-level row by the sum of positive rows remaining after table filters.'
const GLOBAL_VOLUME_SHARE =
	'The value remains protocol activity divided by the global metric total, even when selected chains filter the table rows.'
const CURRENT_SCOPE_VOLUME_SHARE =
	'The value remains protocol activity divided by the metric total for the selected chain scope; all-chain scope uses the global total.'

export const LEGACY_PROTOCOL_TABLE_COLUMN_POLICY: Readonly<Record<string, LegacyProtocolTableColumnPolicy>> = {
	name: { disposition: 'retain', reason: SAME_CONTRACT },
	category: { disposition: 'retain', reason: SAME_CONTRACT },
	oracles: { disposition: 'retain', reason: SAME_CONTRACT },
	chains: { disposition: 'retain', reason: SAME_CONTRACT },
	tvl: { disposition: 'retain', reason: SAME_CONTRACT },
	change_1d: { disposition: 'rename', target: 'change1d', reason: SEMANTIC_ID },
	change_7d: { disposition: 'rename', target: 'change7d', reason: SEMANTIC_ID },
	change_1m: { disposition: 'rename', target: 'change1m', reason: SEMANTIC_ID },
	mcap: { disposition: 'retain', reason: SAME_CONTRACT },
	mcaptvl: { disposition: 'retain', reason: SAME_CONTRACT },
	fees_24h: { disposition: 'rename', target: 'fees24h', reason: SEMANTIC_ID },
	fees_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	fees_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	fees_1y: { disposition: 'retain', reason: SAME_CONTRACT },
	average_1y: { disposition: 'retain', reason: SAME_CONTRACT },
	feesChange_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	feesChange_7d: { disposition: 'rename', target: 'fees24hChange7dAgo', reason: POINT_7D },
	feesChange_1m: { disposition: 'rename', target: 'fees24hChange30dAgo', reason: POINT_30D },
	feesChange_7dover7d: { disposition: 'rename', target: 'feesChange7dOver7d', reason: SEMANTIC_ID },
	feesChange_30dover30d: { disposition: 'rename', target: 'feesChange30dOver30d', reason: SEMANTIC_ID },
	revenue_24h: { disposition: 'rename', target: 'revenue24h', reason: SEMANTIC_ID },
	revenue_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	revenue_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	revenue_1y: { disposition: 'retain', reason: SAME_CONTRACT },
	average_revenue_1y: { disposition: 'retain', reason: SAME_CONTRACT },
	revenueChange_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	revenueChange_7d: { disposition: 'rename', target: 'revenue24hChange7dAgo', reason: POINT_7D },
	revenueChange_1m: { disposition: 'rename', target: 'revenue24hChange30dAgo', reason: POINT_30D },
	revenueChange_7dover7d: { disposition: 'rename', target: 'revenueChange7dOver7d', reason: SEMANTIC_ID },
	revenueChange_30dover30d: { disposition: 'rename', target: 'revenueChange30dOver30d', reason: SEMANTIC_ID },
	userFees_24h: {
		disposition: 'remove',
		reason: 'Fees is already the canonical gross amount paid by users, so this duplicates Fees.'
	},
	cumulativeFees: { disposition: 'retain', reason: SAME_CONTRACT },
	holderRevenue_24h: { disposition: 'retain', reason: 'Holders Revenue is a current public product metric.' },
	holderRevenue_7d: { disposition: 'retain', reason: 'Holders Revenue is a current public product metric.' },
	holdersRevenue30d: { disposition: 'retain', reason: 'Holders Revenue is a current public product metric.' },
	holdersRevenueChange_30dover30d: {
		disposition: 'rename',
		target: 'holderRevenueChange30dOver30d',
		reason: SEMANTIC_ID
	},
	treasuryRevenue_24h: {
		disposition: 'remove',
		reason: 'The value is Protocol Revenue, which can include more than treasury receipts; the label is misleading.'
	},
	supplySideRevenue_24h: {
		disposition: 'remove',
		reason: 'This adapter accounting component is not a supported protocol-ranking product metric.'
	},
	protocolRevenue_24h: {
		disposition: 'remove',
		reason: 'This unsupported identifier appeared only in custom expressions and was never a legacy row field.'
	},
	ps: { disposition: 'retain', reason: SAME_CONTRACT },
	pf: { disposition: 'retain', reason: SAME_CONTRACT },
	earnings_24h: { disposition: 'rename', target: 'earnings24h', reason: 'Earnings remains Revenue minus Incentives.' },
	earnings_7d: { disposition: 'rename', target: 'earnings7d', reason: 'Earnings remains Revenue minus Incentives.' },
	earnings_30d: { disposition: 'rename', target: 'earnings30d', reason: 'Earnings remains Revenue minus Incentives.' },
	earnings_1y: { disposition: 'rename', target: 'earnings1y', reason: 'Earnings remains Revenue minus Incentives.' },
	earningsChange_1d: {
		disposition: 'remove',
		reason: 'The emissions producer has no previous-day comparison period, so an exact Earnings change is unavailable.'
	},
	earningsChange_7d: {
		disposition: 'remove',
		reason:
			'The emissions producer has no seven-days-ago comparison period, so an exact Earnings change is unavailable.'
	},
	earningsChange_1m: {
		disposition: 'remove',
		reason: 'The emissions producer has no 30-days-ago comparison period, so an exact Earnings change is unavailable.'
	},
	volume_24h: { disposition: 'rename', target: 'volume24h', reason: SEMANTIC_ID },
	volume_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	volume_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	volumeChange_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	volumeChange_7d: { disposition: 'rename', target: 'volume24hChange7dAgo', reason: POINT_7D },
	volumeChange_1m: { disposition: 'rename', target: 'volume24hChange30dAgo', reason: POINT_30D },
	cumulativeVolume: { disposition: 'retain', reason: SAME_CONTRACT },
	volumeDominance_24h: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	volumeMarketShare7d: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	aggregators_volume_24h: { disposition: 'retain', reason: SAME_CONTRACT },
	aggregators_volume_change_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	aggregators_volume_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	aggregators_volume_change_7d: {
		disposition: 'rename',
		target: 'aggregatorVolume24hChange7dAgo',
		reason: POINT_7D
	},
	aggregators_volume_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	aggregators_volume_dominance_24h: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	aggregators_volume_marketShare7d: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	bridge_aggregators_volume_24h: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolume24h',
		reason: SEMANTIC_ID
	},
	bridge_aggregators_volume_change_1d: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolumeChange1d',
		reason: SEMANTIC_ID
	},
	bridge_aggregators_volume_7d: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolume7d',
		reason: SEMANTIC_ID
	},
	bridge_aggregators_volume_change_7d: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolume24hChange7dAgo',
		reason: POINT_7D
	},
	bridge_aggregators_volume_30d: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolume30d',
		reason: SEMANTIC_ID
	},
	bridge_aggregators_volume_dominance_24h: {
		disposition: 'rename',
		target: 'bridgeAggregatorVolumeDominance24h',
		reason: CURRENT_SCOPE_VOLUME_SHARE
	},
	options_volume_24h: { disposition: 'retain', reason: SAME_CONTRACT },
	options_volume_change_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	options_volume_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	options_volume_change_7d: { disposition: 'rename', target: 'optionsVolume24hChange7dAgo', reason: POINT_7D },
	options_volume_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	options_volume_dominance_24h: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	perps_volume_24h: { disposition: 'rename', target: 'perpsVolume24h', reason: SEMANTIC_ID },
	perps_volume_7d: { disposition: 'retain', reason: SAME_CONTRACT },
	perps_volume_30d: { disposition: 'retain', reason: SAME_CONTRACT },
	perps_volume_change_1d: { disposition: 'retain', reason: SAME_CONTRACT },
	perps_volume_change_7d: { disposition: 'rename', target: 'perpsVolume24hChange7dAgo', reason: POINT_7D },
	perps_volume_change_1m: { disposition: 'rename', target: 'perpsVolume24hChange30dAgo', reason: POINT_30D },
	perps_volume_dominance_24h: { disposition: 'retain', reason: GLOBAL_VOLUME_SHARE },
	openInterest: { disposition: 'retain', reason: SAME_CONTRACT }
}

export const LEGACY_PROTOCOL_TABLE_FILTERED_SHARE_POLICY: Readonly<
	Record<string, Extract<LegacyProtocolTableColumnPolicy, { disposition: 'rename' }>>
> = {
	tvl_share: { disposition: 'rename', target: 'filteredShare_tvl', reason: FILTERED_SHARE },
	mcap_share: { disposition: 'rename', target: 'filteredShare_mcap', reason: FILTERED_SHARE },
	fees_24h_share: { disposition: 'rename', target: 'filteredShare_fees24h', reason: FILTERED_SHARE },
	fees_7d_share: { disposition: 'rename', target: 'filteredShare_fees_7d', reason: FILTERED_SHARE },
	fees_30d_share: { disposition: 'rename', target: 'filteredShare_fees_30d', reason: FILTERED_SHARE },
	fees_1y_share: { disposition: 'rename', target: 'filteredShare_fees_1y', reason: FILTERED_SHARE },
	average_1y_share: { disposition: 'rename', target: 'filteredShare_average_1y', reason: FILTERED_SHARE },
	cumulativeFees_share: { disposition: 'rename', target: 'filteredShare_cumulativeFees', reason: FILTERED_SHARE },
	revenue_24h_share: { disposition: 'rename', target: 'filteredShare_revenue24h', reason: FILTERED_SHARE },
	revenue_7d_share: { disposition: 'rename', target: 'filteredShare_revenue_7d', reason: FILTERED_SHARE },
	revenue_30d_share: { disposition: 'rename', target: 'filteredShare_revenue_30d', reason: FILTERED_SHARE },
	revenue_1y_share: { disposition: 'rename', target: 'filteredShare_revenue_1y', reason: FILTERED_SHARE },
	volume_24h_share: { disposition: 'rename', target: 'filteredShare_volume24h', reason: FILTERED_SHARE },
	volume_7d_share: { disposition: 'rename', target: 'filteredShare_volume_7d', reason: FILTERED_SHARE },
	cumulativeVolume_share: { disposition: 'rename', target: 'filteredShare_cumulativeVolume', reason: FILTERED_SHARE },
	earnings_24h_share: { disposition: 'rename', target: 'filteredShare_earnings24h', reason: FILTERED_SHARE },
	earnings_7d_share: { disposition: 'rename', target: 'filteredShare_earnings7d', reason: FILTERED_SHARE },
	earnings_30d_share: { disposition: 'rename', target: 'filteredShare_earnings30d', reason: FILTERED_SHARE },
	earnings_1y_share: { disposition: 'rename', target: 'filteredShare_earnings1y', reason: FILTERED_SHARE },
	aggregators_volume_24h_share: {
		disposition: 'rename',
		target: 'filteredShare_aggregators_volume_24h',
		reason: FILTERED_SHARE
	},
	aggregators_volume_7d_share: {
		disposition: 'rename',
		target: 'filteredShare_aggregators_volume_7d',
		reason: FILTERED_SHARE
	},
	aggregators_volume_30d_share: {
		disposition: 'rename',
		target: 'filteredShare_aggregators_volume_30d',
		reason: FILTERED_SHARE
	},
	bridge_aggregators_volume_24h_share: {
		disposition: 'rename',
		target: 'filteredShare_bridgeAggregatorVolume24h',
		reason: FILTERED_SHARE
	},
	bridge_aggregators_volume_7d_share: {
		disposition: 'rename',
		target: 'filteredShare_bridgeAggregatorVolume7d',
		reason: FILTERED_SHARE
	},
	bridge_aggregators_volume_30d_share: {
		disposition: 'rename',
		target: 'filteredShare_bridgeAggregatorVolume30d',
		reason: FILTERED_SHARE
	},
	options_volume_24h_share: {
		disposition: 'rename',
		target: 'filteredShare_options_volume_24h',
		reason: FILTERED_SHARE
	},
	options_volume_7d_share: {
		disposition: 'rename',
		target: 'filteredShare_options_volume_7d',
		reason: FILTERED_SHARE
	},
	options_volume_30d_share: {
		disposition: 'rename',
		target: 'filteredShare_options_volume_30d',
		reason: FILTERED_SHARE
	}
}

function isLegacyProtocolTableColumnId(id: string): id is keyof typeof LEGACY_PROTOCOL_TABLE_COLUMN_POLICY {
	return Object.hasOwn(LEGACY_PROTOCOL_TABLE_COLUMN_POLICY, id)
}

function isLegacyProtocolTableFilteredShareId(
	id: string
): id is keyof typeof LEGACY_PROTOCOL_TABLE_FILTERED_SHARE_POLICY {
	return Object.hasOwn(LEGACY_PROTOCOL_TABLE_FILTERED_SHARE_POLICY, id)
}

export function getLegacyProtocolTableColumnPolicy(id: string): LegacyProtocolTableColumnPolicy | undefined {
	if (isLegacyProtocolTableColumnId(id)) return LEGACY_PROTOCOL_TABLE_COLUMN_POLICY[id]
	if (isLegacyProtocolTableFilteredShareId(id)) return LEGACY_PROTOCOL_TABLE_FILTERED_SHARE_POLICY[id]
	return undefined
}

export function isRemovedLegacyProtocolTableColumn(id: string): boolean {
	return getLegacyProtocolTableColumnPolicy(id)?.disposition === 'remove'
}
