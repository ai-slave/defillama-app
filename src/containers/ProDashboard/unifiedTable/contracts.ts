export interface ProtocolTableMetrics {
	tvl?: number | null
	tvlPrevDay?: number | null
	tvlPrevWeek?: number | null
	tvlPrevMonth?: number | null
	change1d?: number | null
	change7d?: number | null
	change1m?: number | null
	bridgedTvl?: number | null
	stablesMcap?: number | null
	tvlShare?: number | null
	stablesShare?: number | null
	volume24hShare?: number | null
	volume24h?: number | null
	volume_7d?: number | null
	volume_30d?: number | null
	cumulativeVolume?: number | null
	volumeChange_1d?: number | null
	volume24h7dAgo?: number | null
	volume24h30dAgo?: number | null
	volume24hChange7dAgo?: number | null
	volume24hChange30dAgo?: number | null
	volumeChange7dOver7d?: number | null
	volumeChange30dOver30d?: number | null
	volumeDominance_24h?: number | null
	volumeMarketShare7d?: number | null
	fees24h?: number | null
	fees_7d?: number | null
	fees_30d?: number | null
	fees_1y?: number | null
	feesAnnualized1y?: number | null
	average_1y?: number | null
	cumulativeFees?: number | null
	holderRevenue_24h?: number | null
	holderRevenue_7d?: number | null
	holdersRevenue30d?: number | null
	holderRevenueChange30dOver30d?: number | null
	feesChange_1d?: number | null
	fees24h7dAgo?: number | null
	fees24h30dAgo?: number | null
	fees24hChange7dAgo?: number | null
	fees24hChange30dAgo?: number | null
	feesChange7dOver7d?: number | null
	feesChange30dOver30d?: number | null
	revenue24h?: number | null
	revenue_7d?: number | null
	revenue_30d?: number | null
	revenue_1y?: number | null
	revenueAnnualized1y?: number | null
	average_revenue_1y?: number | null
	cumulativeRevenue?: number | null
	revenueChange_1d?: number | null
	revenue24h7dAgo?: number | null
	revenue24h30dAgo?: number | null
	revenue24hChange7dAgo?: number | null
	revenue24hChange30dAgo?: number | null
	revenueChange7dOver7d?: number | null
	revenueChange30dOver30d?: number | null
	perpsVolume24h?: number | null
	perps_volume_7d?: number | null
	perps_volume_30d?: number | null
	perps_volume_change_1d?: number | null
	perpsVolume24h7dAgo?: number | null
	perpsVolume24h30dAgo?: number | null
	perpsVolume24hChange7dAgo?: number | null
	perpsVolume24hChange30dAgo?: number | null
	perpsVolumeChange7dOver7d?: number | null
	perpsVolumeChange30dOver30d?: number | null
	perps_volume_dominance_24h?: number | null
	openInterest?: number | null
	aggregators_volume_24h?: number | null
	aggregators_volume_7d?: number | null
	aggregators_volume_30d?: number | null
	aggregators_volume_change_1d?: number | null
	aggregatorVolume24h7dAgo?: number | null
	aggregatorVolume24h30dAgo?: number | null
	aggregatorVolume24hChange7dAgo?: number | null
	aggregatorVolume24hChange30dAgo?: number | null
	aggregatorVolumeChange7dOver7d?: number | null
	aggregators_volume_dominance_24h?: number | null
	aggregators_volume_marketShare7d?: number | null
	derivatives_aggregators_volume_24h?: number | null
	derivatives_aggregators_volume_7d?: number | null
	derivatives_aggregators_volume_30d?: number | null
	derivatives_aggregators_volume_change_1d?: number | null
	derivativesAggregatorVolume24h7dAgo?: number | null
	derivativesAggregatorVolume24h30dAgo?: number | null
	derivativesAggregatorVolume24hChange7dAgo?: number | null
	derivativesAggregatorVolume24hChange30dAgo?: number | null
	derivativesAggregatorVolumeChange7dOver7d?: number | null
	derivativesAggregatorVolumeChange30dOver30d?: number | null
	options_volume_24h?: number | null
	options_volume_7d?: number | null
	options_volume_30d?: number | null
	options_volume_change_1d?: number | null
	optionsVolume24h7dAgo?: number | null
	optionsVolume24h30dAgo?: number | null
	optionsVolume24hChange7dAgo?: number | null
	optionsVolume24hChange30dAgo?: number | null
	optionsVolumeChange7dOver7d?: number | null
	options_volume_dominance_24h?: number | null
	mcap?: number | null
	fdv?: number | null
	mcaptvl?: number | null
	pf?: number | null
	ps?: number | null
	protocolCount?: number | null
	earnings24h?: number | null
	earnings7d?: number | null
	earnings30d?: number | null
	earnings1y?: number | null
	bridgeAggregatorVolume24h?: number | null
	bridgeAggregatorVolume7d?: number | null
	bridgeAggregatorVolume30d?: number | null
	bridgeAggregatorVolumeChange1d?: number | null
	bridgeAggregatorVolume24h7dAgo?: number | null
	bridgeAggregatorVolume24hChange7dAgo?: number | null
	bridgeAggregatorVolumeDominance24h?: number | null
}

interface ProtocolTableSourceRowBase {
	id: string
	name: string
	protocolId: string
	displayName: string
	logo: string
	category: string | null
	chains: string[]
	oracles: string[]
	parentProtocolId: string | null
	parentProtocolName: string | null
	parentProtocolLogo: string | null
	excludeTvlFromParent?: true
	metrics: ProtocolTableMetrics
}

export interface ProtocolAggregateTableRow extends ProtocolTableSourceRowBase {
	rowType: 'protocol'
	chain: null
}

export interface ProtocolChainTableRow extends ProtocolTableSourceRowBase {
	rowType: 'protocol-chain'
	chain: string
}

export type ProtocolTableSourceRow = ProtocolAggregateTableRow | ProtocolChainTableRow

export const EMPTY_CANONICAL_CHAIN_METRICS = {
	tvl: null,
	tvlPrevDay: null,
	tvlPrevWeek: null,
	tvlPrevMonth: null,
	change1d: null,
	change7d: null,
	change1m: null,
	bridgedTvl: null,
	stablesMcap: null,
	tvlShare: null,
	stablesShare: null,
	volume24hShare: null,
	volume24h: null,
	volume_7d: null,
	volume_30d: null,
	cumulativeVolume: null,
	volumeChange_1d: null,
	volume24h7dAgo: null,
	volume24h30dAgo: null,
	volume24hChange7dAgo: null,
	volume24hChange30dAgo: null,
	volumeChange7dOver7d: null,
	volumeChange30dOver30d: null,
	volumeDominance_24h: null,
	volumeMarketShare7d: null,
	fees24h: null,
	fees_7d: null,
	fees_30d: null,
	fees_1y: null,
	feesAnnualized1y: null,
	average_1y: null,
	cumulativeFees: null,
	feesChange_1d: null,
	fees24h7dAgo: null,
	fees24h30dAgo: null,
	fees24hChange7dAgo: null,
	fees24hChange30dAgo: null,
	feesChange7dOver7d: null,
	feesChange30dOver30d: null,
	revenue24h: null,
	revenue_7d: null,
	revenue_30d: null,
	revenue_1y: null,
	revenueAnnualized1y: null,
	average_revenue_1y: null,
	cumulativeRevenue: null,
	revenueChange_1d: null,
	revenue24h7dAgo: null,
	revenue24h30dAgo: null,
	revenue24hChange7dAgo: null,
	revenue24hChange30dAgo: null,
	revenueChange7dOver7d: null,
	revenueChange30dOver30d: null,
	perpsVolume24h: null,
	perps_volume_7d: null,
	perps_volume_30d: null,
	perps_volume_change_1d: null,
	perpsVolume24h7dAgo: null,
	perpsVolume24h30dAgo: null,
	perpsVolume24hChange7dAgo: null,
	perpsVolume24hChange30dAgo: null,
	perpsVolumeChange7dOver7d: null,
	perpsVolumeChange30dOver30d: null,
	perps_volume_dominance_24h: null,
	openInterest: null,
	aggregators_volume_24h: null,
	aggregators_volume_7d: null,
	aggregators_volume_30d: null,
	aggregators_volume_change_1d: null,
	aggregatorVolume24h7dAgo: null,
	aggregatorVolume24h30dAgo: null,
	aggregatorVolume24hChange7dAgo: null,
	aggregatorVolume24hChange30dAgo: null,
	aggregatorVolumeChange7dOver7d: null,
	aggregators_volume_dominance_24h: null,
	aggregators_volume_marketShare7d: null,
	derivatives_aggregators_volume_24h: null,
	derivatives_aggregators_volume_7d: null,
	derivatives_aggregators_volume_30d: null,
	derivatives_aggregators_volume_change_1d: null,
	derivativesAggregatorVolume24h7dAgo: null,
	derivativesAggregatorVolume24h30dAgo: null,
	derivativesAggregatorVolume24hChange7dAgo: null,
	derivativesAggregatorVolume24hChange30dAgo: null,
	derivativesAggregatorVolumeChange7dOver7d: null,
	derivativesAggregatorVolumeChange30dOver30d: null,
	options_volume_24h: null,
	options_volume_7d: null,
	options_volume_30d: null,
	options_volume_change_1d: null,
	optionsVolume24h7dAgo: null,
	optionsVolume24h30dAgo: null,
	optionsVolume24hChange7dAgo: null,
	optionsVolume24hChange30dAgo: null,
	optionsVolumeChange7dOver7d: null,
	options_volume_dominance_24h: null,
	protocolCount: null
} satisfies ProtocolTableMetrics

export type CanonicalChainMetricKey = keyof typeof EMPTY_CANONICAL_CHAIN_METRICS
export type CanonicalChainMetrics = Pick<ProtocolTableMetrics, CanonicalChainMetricKey>

export type ChainMetrics =
	| { availability: 'available'; metrics: CanonicalChainMetrics }
	| { availability: 'unavailable' }

export interface ParentProtocolMetrics {
	mcap: number | null
	fdv: number | null
	oracles?: string[]
	supplements?: {
		openInterest?: {
			childProtocolIds: string[]
			childProtocolIdsByChain: Record<string, string[]>
			metrics: Pick<ProtocolTableMetrics, 'openInterest'>
			metricsByChain: Record<string, Pick<ProtocolTableMetrics, 'openInterest'>>
		}
		earnings?: {
			childProtocolIds: string[]
			childProtocolIdsByChain: Record<string, string[]>
			metrics: Pick<ProtocolTableMetrics, 'earnings24h' | 'earnings7d' | 'earnings30d' | 'earnings1y'>
			metricsByChain: Record<
				string,
				Pick<ProtocolTableMetrics, 'earnings24h' | 'earnings7d' | 'earnings30d' | 'earnings1y'>
			>
		}
		bridgeAggregatorVolume?: {
			childProtocolIds: string[]
			childProtocolIdsByChain: Record<string, string[]>
			metrics: Pick<
				ProtocolTableMetrics,
				| 'bridgeAggregatorVolume24h'
				| 'bridgeAggregatorVolume7d'
				| 'bridgeAggregatorVolume30d'
				| 'bridgeAggregatorVolumeChange1d'
				| 'bridgeAggregatorVolume24h7dAgo'
				| 'bridgeAggregatorVolume24hChange7dAgo'
				| 'bridgeAggregatorVolumeDominance24h'
			>
			metricsByChain: Record<
				string,
				Pick<
					ProtocolTableMetrics,
					| 'bridgeAggregatorVolume24h'
					| 'bridgeAggregatorVolume7d'
					| 'bridgeAggregatorVolume30d'
					| 'bridgeAggregatorVolumeChange1d'
					| 'bridgeAggregatorVolume24h7dAgo'
					| 'bridgeAggregatorVolume24hChange7dAgo'
					| 'bridgeAggregatorVolumeDominance24h'
				>
			>
		}
	}
}

export interface ProtocolsUnifiedTableResponse {
	strategy: 'protocols'
	rows: ProtocolTableSourceRow[]
	parentMetrics: Record<string, ParentProtocolMetrics>
	chainMetrics?: Record<string, ChainMetrics>
}

export function createProtocolsUnifiedTableResponse(data: {
	rows: ProtocolTableSourceRow[]
	parentMetrics: Record<string, ParentProtocolMetrics>
	chainMetrics?: Record<string, ChainMetrics>
}): ProtocolsUnifiedTableResponse {
	for (const row of data.rows) {
		// Metrics is a plain producer-owned object; avoid allocating entry tuples for every table row.
		for (const key in row.metrics) {
			const metricKey = key as keyof ProtocolTableMetrics
			if (row.metrics[metricKey] === null) delete row.metrics[metricKey]
		}
	}
	return data.chainMetrics
		? { strategy: 'protocols', rows: data.rows, parentMetrics: data.parentMetrics, chainMetrics: data.chainMetrics }
		: { strategy: 'protocols', rows: data.rows, parentMetrics: data.parentMetrics }
}
