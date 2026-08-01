import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
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
	chains: string[]
	deprecated?: boolean
	value: number | null
	change_1m: number | null
	subRows?: IExtraTvlProtocolRow[]
}

export interface IExtraTvlByChainPageData {
	protocols: IExtraTvlProtocolRow[]
	chain: string
	chains: Array<{ label: string; to: string }>
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
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
	chains: string[]
	deprecated?: boolean
	value: number | null
	subRows?: ITokenMetricProtocolRow[]
}

export interface IProtocolsWithTokensByChainPageData {
	protocols: ITokenMetricProtocolRow[]
	chain: string
	chains: Array<{ label: string; to: string }>
	categories: string[]
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
	chains: string[]
	chainTvls: Record<string, TvlEntry>
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	mcap: number | null
	listedAt: number
	defillamaId: string
	deprecated?: boolean
	forkedFrom?: string[]
	/** Finite protocol-list TVL sections extracted from chainTvls. */
	extraTvl: Partial<Record<ProtocolListAdditiveTvlKey, TvlEntry>>
	/** Only present on airdrops page. */
	totalRaised?: number | null
}

export interface IRecentProtocolsPageData {
	protocols: IRecentProtocol[]
	chainList: string[]
	categories: string[]
	forkedList: Record<string, boolean>
	claimableAirdrops?: Array<{ name: string; page: string; title?: string }>
}
