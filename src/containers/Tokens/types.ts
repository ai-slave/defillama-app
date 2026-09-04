import type { TokenRightsPieTone } from '~/containers/TokenRights/utils'

export const TOKENS_PAGE_RESPONSE_SCHEMA_VERSION = 13
export const TOKENS_CHART_GECKO_LOGO_PREFIX = '@'

export interface TokenMarketSummary {
	symbol: string
	marketCapRank: number | null
	currentPrice: number | null
	priceChange7d: number | null
	priceChange30d: number | null
	marketCap: number | null
	fdv: number | null
	circulatingSupply: number | null
	totalSupply: number | null
	maxSupply: number | null
	ath: number | null
	athDate: string | null
}

export const TOKENS_SORT_KEYS = [
	'rank',
	'name',
	'price',
	'priceChange1h',
	'priceChange24h',
	'priceChange7d',
	'priceChange30d',
	'marketCap',
	'fdv',
	'outstandingFdv',
	'unlockedPercent',
	'spotVolume24h',
	'perpsVolume24h',
	'openInterest24h',
	'fees24h',
	'revenue24h',
	'holdersRevenue24h',
	'trsPercent',
	'unlock30dUsd',
	'upcomingUnlockUsd'
] as const

export type TokensSortBy = (typeof TOKENS_SORT_KEYS)[number]

export const TOKENS_NUMERIC_FILTER_FIELDS = [
	'price',
	'priceChange24h',
	'priceChange7d',
	'priceChange30d',
	'marketCap',
	'fdv',
	'outstandingFdv',
	'unlockedPercent',
	'spotVolume24h',
	'perpsVolume24h',
	'openInterest24h',
	'fees24h',
	'revenue24h',
	'holdersRevenue24h',
	'trsPercent',
	'unlock30dUsd',
	'upcomingUnlockUsd'
] as const

export type TokensNumericFilterField = (typeof TOKENS_NUMERIC_FILTER_FIELDS)[number]

export interface TokensNumericFilter {
	field: TokensNumericFilterField
	min: number | null
	max: number | null
}
export type TokensDisplayTone = 'positive' | 'negative' | 'neutral'

export interface TokensRightsSummary {
	protocolName: string
	identityTokens: string[]
	utilityItems: string[]
	primaryValue: string | null
	primaryDetails: string | null
	governance: boolean
	governanceTokens: string[]
	treasury: boolean
	treasuryTokens: string[]
	revenue: boolean
	revenueTokens: string[]
	feeSwitchStatus: string
	buybacks: boolean
	buybackTokens: string[]
	dividends: boolean
	dividendTokens: string[]
	burns: boolean
	burnsStatus: string
	equityRevenueCapture: string
	equityTone: TokenRightsPieTone
	fundraisingLabel: string | null
	associatedEntities: string[]
}

export interface TokensTableRowDisplay {
	price: string | null
	priceChange24h: string | null
	priceChange24hTone: TokensDisplayTone
	priceChange7d: string | null
	priceChange7dTone: TokensDisplayTone
	priceChange30d: string | null
	priceChange30dTone: TokensDisplayTone
	marketCap: string | null
	fdv: string | null
	outstandingFdv: string | null
	unlockedPercent: string | null
	unlockedPercentWidth: string | null
	spotVolume24h: string | null
	perpsVolume24h: string | null
	openInterest24h: string | null
	fees24h: string | null
	revenue24h: string | null
	holdersRevenue24h: string | null
	trsPercent: string | null
	trsPercentWidth: string | null
	unlock30dUsd: string | null
	upcomingUnlockUsd: string | null
}

interface TokensRowCore {
	id: string
	rank: number | null
	name: string
	symbol: string
	logo: string | null
	href: string | null
	tokenRightsHref: string | null
	price: number | null
	priceChange1h: number | null
	priceChange24h: number | null
	priceChange7d: number | null
	priceChange30d: number | null
	marketCap: number | null
	fdv: number | null
	outstandingFdv: number | null
	unlockedPercent: number | null
	spotVolume24h: number | null
	perpsVolume24h: number | null
	openInterest24h: number | null
	fees24h: number | null
	revenue24h: number | null
	holdersRevenue24h: number | null
	trsPercent: number | null
	rights: TokensRightsSummary | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
	isStablecoin: boolean
}

export interface TokensTableRow extends TokensRowCore {
	rowNumber: number
	display: TokensTableRowDisplay
}

export interface TokensChartDataset {
	names: string[]
	symbols: string[]
	logoSources: string[]
	hrefs: Array<string | null>
	marketCaps: number[]
	priceChanges: {
		'24h': Array<number | null>
		'7d': Array<number | null>
		'30d': Array<number | null>
	}
	stablecoins: boolean[]
}

export interface TokensSourceRow extends TokensRowCore {
	searchKey: string
	chains: string[]
	primaryChain: string | null
	categories: string[]
}

export interface TokensFilterOption {
	id: string
	label: string
	description?: string
}

export interface TokensSortIndex {
	rows: TokensSourceRow[]
	sortBy: TokensSortBy
	nullStart: number
}

export type TokensSortIndexes = Record<TokensSortBy, TokensSortIndex>

export interface TokensPageStats {
	totalMarketCap: number
	marketCapWeightedChange24h: number | null
	spotVolume24h: number
	perpsVolume24h: number
	openInterest24h: number
	unlock30dUsd: number
	upcomingUnlockUsd: number
}

export interface TokensPageStatsDisplay {
	totalMarketCap: string
	marketCapWeightedChange24h: string | null
	marketCapWeightedChange24hTone: TokensDisplayTone
	spotVolume24h: string
	perpsVolume24h: string
	openInterest24h: string
	unlock30dUsd: string
	upcomingUnlockUsd: string
}

export interface TokensPageResponse {
	schemaVersion: typeof TOKENS_PAGE_RESPONSE_SCHEMA_VERSION
	rows: TokensTableRow[]
	total: number
	page: number
	pageSize: number
	hasMore: boolean
	stats: TokensPageStats
	statsDisplay: TokensPageStatsDisplay
	updatedAt: string | null
	chainOptions: TokensFilterOption[]
	categoryOptions: TokensFilterOption[]
}

export interface TokensPageQuery {
	page: number
	pageSize: number
	sortBy: TokensSortBy
	sortDesc: boolean
	search: string
	rankFrom: number | null
	rankTo: number | null
	numericFilters: TokensNumericFilter[]
	chains: string[] | null
	excludeChains: string[]
	nativeOnly: boolean
	categories: string[] | null
	excludeCategories: string[]
}

export interface TokensPageProps {
	initialData: TokensPageResponse
}
