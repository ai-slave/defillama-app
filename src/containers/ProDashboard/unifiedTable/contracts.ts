export interface ProtocolTableMetrics {
	tvl?: number | null
	tvlPrevDay?: number | null
	tvlPrevWeek?: number | null
	tvlPrevMonth?: number | null
	tvlPrev90d?: number | null
	tvlPrev180d?: number | null
	tvlPrevYear?: number | null
	tvlPrevYtd?: number | null
	change1d?: number | null
	change7d?: number | null
	change1m?: number | null
	change90d?: number | null
	change180d?: number | null
	change1y?: number | null
	changeYtd?: number | null
	stakingTvl?: number | null
	borrowedTvl?: number | null
	pool2Tvl?: number | null
	treasuryTvl?: number | null
	vestingTvl?: number | null
	bridgedTvl?: number | null
	stablesMcap?: number | null
	tvlShare?: number | null
	stablesShare?: number | null
	volume24hShare?: number | null
	volume24h?: number | null
	volume_7d?: number | null
	volume_30d?: number | null
	volume_90d?: number | null
	volume_1y?: number | null
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
	fees_90d?: number | null
	fees_180d?: number | null
	fees_1y?: number | null
	fees_ytd?: number | null
	feesAnnualized1y?: number | null
	average_1y?: number | null
	cumulativeFees?: number | null
	holderRevenue_24h?: number | null
	holderRevenue_7d?: number | null
	holdersRevenue30d?: number | null
	holderRevenue_90d?: number | null
	holderRevenue_180d?: number | null
	holderRevenue_1y?: number | null
	holderRevenue_ytd?: number | null
	cumulativeHolderRevenue?: number | null
	holderRevenueAnnualized1y?: number | null
	holderRevenueChange_1d?: number | null
	holderRevenueChange7dOver7d?: number | null
	holderRevenueChange30dOver30d?: number | null
	holderRevenueChange90dOver90d?: number | null
	holderRevenueChange180dOver180d?: number | null
	holderRevenueChange1yOver1y?: number | null
	holderRevenueChangeYtd?: number | null
	feesChange_1d?: number | null
	fees24h7dAgo?: number | null
	fees24h30dAgo?: number | null
	fees24hChange7dAgo?: number | null
	fees24hChange30dAgo?: number | null
	feesChange7dOver7d?: number | null
	feesChange30dOver30d?: number | null
	feesChange90dOver90d?: number | null
	feesChange180dOver180d?: number | null
	feesChange1yOver1y?: number | null
	feesChangeYtd?: number | null
	revenue24h?: number | null
	revenue_7d?: number | null
	revenue_30d?: number | null
	revenue_90d?: number | null
	revenue_180d?: number | null
	revenue_1y?: number | null
	revenue_ytd?: number | null
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
	revenueChange90dOver90d?: number | null
	revenueChange180dOver180d?: number | null
	revenueChange1yOver1y?: number | null
	revenueChangeYtd?: number | null
	perpsVolume24h?: number | null
	perps_volume_7d?: number | null
	perps_volume_30d?: number | null
	perps_volume_90d?: number | null
	perps_volume_1y?: number | null
	cumulativePerpsVolume?: number | null
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
	aggregators_volume_90d?: number | null
	aggregators_volume_1y?: number | null
	cumulativeAggregatorVolume?: number | null
	aggregators_volume_change_1d?: number | null
	aggregatorVolume24h7dAgo?: number | null
	aggregatorVolume24h30dAgo?: number | null
	aggregatorVolume24hChange7dAgo?: number | null
	aggregatorVolume24hChange30dAgo?: number | null
	aggregatorVolumeChange7dOver7d?: number | null
	aggregatorVolumeChange30dOver30d?: number | null
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
	options_volume_90d?: number | null
	options_volume_1y?: number | null
	cumulativeOptionsVolume?: number | null
	optionsNotionalVolume24h?: number | null
	optionsNotionalVolume7d?: number | null
	optionsNotionalVolume30d?: number | null
	options_volume_change_1d?: number | null
	optionsVolume24h7dAgo?: number | null
	optionsVolume24h30dAgo?: number | null
	optionsVolume24hChange7dAgo?: number | null
	optionsVolume24hChange30dAgo?: number | null
	optionsVolumeChange7dOver7d?: number | null
	optionsVolumeChange30dOver30d?: number | null
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
	emissions24h?: number | null
	emissions7d?: number | null
	emissions30d?: number | null
	emissions90d?: number | null
	emissions180d?: number | null
	emissions1y?: number | null
	emissionsYtd?: number | null
	cumulativeEmissions?: number | null
	emissionsAnnualized1y?: number | null
	emissionsPrev24h?: number | null
	emissionsPrev7d?: number | null
	emissionsPrev30d?: number | null
	emissionsChange1d?: number | null
	emissionsChange7dOver7d?: number | null
	emissionsChange30dOver30d?: number | null
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
	tvlPrev90d: null,
	tvlPrev180d: null,
	tvlPrevYear: null,
	tvlPrevYtd: null,
	change1d: null,
	change7d: null,
	change1m: null,
	change90d: null,
	change180d: null,
	change1y: null,
	changeYtd: null,
	stakingTvl: null,
	borrowedTvl: null,
	pool2Tvl: null,
	treasuryTvl: null,
	vestingTvl: null,
	bridgedTvl: null,
	stablesMcap: null,
	tvlShare: null,
	stablesShare: null,
	volume24hShare: null,
	volume24h: null,
	volume_7d: null,
	volume_30d: null,
	volume_90d: null,
	volume_1y: null,
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
	fees_90d: null,
	fees_180d: null,
	fees_1y: null,
	fees_ytd: null,
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
	feesChange90dOver90d: null,
	feesChange180dOver180d: null,
	feesChange1yOver1y: null,
	feesChangeYtd: null,
	revenue24h: null,
	revenue_7d: null,
	revenue_30d: null,
	revenue_90d: null,
	revenue_180d: null,
	revenue_1y: null,
	revenue_ytd: null,
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
	revenueChange90dOver90d: null,
	revenueChange180dOver180d: null,
	revenueChange1yOver1y: null,
	revenueChangeYtd: null,
	perpsVolume24h: null,
	perps_volume_7d: null,
	perps_volume_30d: null,
	perps_volume_90d: null,
	perps_volume_1y: null,
	cumulativePerpsVolume: null,
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
	aggregators_volume_90d: null,
	aggregators_volume_1y: null,
	cumulativeAggregatorVolume: null,
	aggregators_volume_change_1d: null,
	aggregatorVolume24h7dAgo: null,
	aggregatorVolume24h30dAgo: null,
	aggregatorVolume24hChange7dAgo: null,
	aggregatorVolume24hChange30dAgo: null,
	aggregatorVolumeChange7dOver7d: null,
	aggregatorVolumeChange30dOver30d: null,
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
	options_volume_90d: null,
	options_volume_1y: null,
	cumulativeOptionsVolume: null,
	optionsNotionalVolume24h: null,
	optionsNotionalVolume7d: null,
	optionsNotionalVolume30d: null,
	options_volume_change_1d: null,
	optionsVolume24h7dAgo: null,
	optionsVolume24h30dAgo: null,
	optionsVolume24hChange7dAgo: null,
	optionsVolume24hChange30dAgo: null,
	optionsVolumeChange7dOver7d: null,
	optionsVolumeChange30dOver30d: null,
	options_volume_dominance_24h: null,
	emissions24h: null,
	emissions7d: null,
	emissions30d: null,
	emissions90d: null,
	emissions180d: null,
	emissions1y: null,
	emissionsYtd: null,
	cumulativeEmissions: null,
	emissionsAnnualized1y: null,
	emissionsPrev24h: null,
	emissionsPrev7d: null,
	emissionsPrev30d: null,
	emissionsChange1d: null,
	emissionsChange7dOver7d: null,
	emissionsChange30dOver30d: null,
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
		incentives?: {
			childProtocolIds: string[]
			metrics: Pick<
				ProtocolTableMetrics,
				| 'emissions24h'
				| 'emissions7d'
				| 'emissions30d'
				| 'emissions90d'
				| 'emissions180d'
				| 'emissions1y'
				| 'emissionsYtd'
				| 'cumulativeEmissions'
				| 'emissionsAnnualized1y'
				| 'emissionsPrev24h'
				| 'emissionsPrev7d'
				| 'emissionsPrev30d'
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

export interface LegacyChainMetrics {
	bridgedTvl: number | null
	stablesMcap: number | null
	tvlShare: number | null
	stablesShare: number | null
	volume24hShare: number | null
	protocolCount: number | null
}

export interface LegacyProtocolsUnifiedTableResponse {
	rows: ProtocolTableSourceRow[]
	chainMetrics?: Record<string, LegacyChainMetrics>
}

/** Keep pre-capability clients working while deployed tabs and cached bundles age out. */
export function createLegacyProtocolsUnifiedTableResponse(data: {
	rows: ProtocolTableSourceRow[]
	chainMetrics?: Record<string, ChainMetrics>
}): LegacyProtocolsUnifiedTableResponse {
	if (!data.chainMetrics) return { rows: data.rows }

	const chainMetrics: Record<string, LegacyChainMetrics> = {}
	for (const chain in data.chainMetrics) {
		const entry = data.chainMetrics[chain]
		const metrics = entry?.availability === 'available' ? entry.metrics : null
		chainMetrics[chain] = {
			bridgedTvl: metrics?.bridgedTvl ?? null,
			stablesMcap: metrics?.stablesMcap ?? null,
			tvlShare: metrics?.tvlShare ?? null,
			stablesShare: metrics?.stablesShare ?? null,
			volume24hShare: metrics?.volume24hShare ?? null,
			protocolCount: metrics?.protocolCount ?? null
		}
	}

	return { rows: data.rows, chainMetrics }
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
