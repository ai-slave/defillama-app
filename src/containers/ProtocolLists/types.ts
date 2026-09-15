import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { RaisesSummary } from '~/containers/Raises/summary'
import type { ProtocolListAdditiveTvlKey } from './api.types'

// ---------------------------------------------------------------------------
// ExtraTvl pages (total-borrowed, total-staked, pool2)
// ---------------------------------------------------------------------------

export type ExtraTvlMetric = 'borrowed' | 'staking' | 'pool2'

export interface IExtraTvlProtocolRow {
	name: string
	logo: string | null
	slug: string
	category: string | null
	chains: Array<string>
	deprecated?: boolean
	value: number | null
	change_1m: number | null
	subRows?: Array<IExtraTvlProtocolRow>
}

export interface IExtraTvlByChainPageData {
	protocols: Array<IExtraTvlProtocolRow>
	chain: string
	chains: Array<{ label: string; to: string }>
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	totalValue: number
	change24h: number | null
	metric: ExtraTvlMetric
}

// ---------------------------------------------------------------------------
// ProtocolsWithTokens pages (mcaps, fdv, token-prices, outstanding-fdv)
// ---------------------------------------------------------------------------

export type TokenMetricType = 'mcap' | 'fdv' | 'price' | 'outstanding-fdv'

export interface ITokenMetricProtocolRow {
	name: string
	logo: string | null
	slug: string
	category: string | null
	chains: Array<string>
	deprecated?: boolean
	value: number | null
	subRows?: Array<ITokenMetricProtocolRow>
}

export interface IProtocolsWithTokensByChainPageData {
	protocols: Array<ITokenMetricProtocolRow>
	chain: string
	chains: Array<{ label: string; to: string }>
	categories: Array<string>
	type: TokenMetricType
}

// ---------------------------------------------------------------------------
// RecentProtocols / Airdrops pages
// ---------------------------------------------------------------------------

interface TvlEntry {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

export interface IRecentProtocol {
	name: string
	symbol: string
	logo: string | null
	url: string
	category: string
	chains: Array<string>
	chainTvls: Record<string, TvlEntry>
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	mcap: number | null
	listedAt: number
	defillamaId: string
	deprecated?: boolean
	forkedFrom?: Array<string>
	/** Finite protocol-list TVL sections extracted from chainTvls. */
	extraTvl: Partial<Record<ProtocolListAdditiveTvlKey, TvlEntry>>
	/** Only present on airdrops page. */
	raiseSummary?: RaisesSummary
}

export interface IRecentProtocolsPageData {
	protocols: Array<IRecentProtocol>
	chainList: Array<string>
	categories: Array<string>
	forkedList: Record<string, boolean>
}
