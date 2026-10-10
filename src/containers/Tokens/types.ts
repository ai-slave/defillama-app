import type { TokenRightsPreview } from '~/containers/TokenRights/types'

export const TOKENS_PAGE_RESPONSE_SCHEMA_VERSION = 16
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
export interface TokensTableRowDisplay {
	price: string | null
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
	rights: TokenRightsPreview | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
	isStablecoin: boolean
}

export interface TokensTableRow extends TokensRowCore {
	rowNumber: number
	display: TokensTableRowDisplay
}

export interface TokensChartDataset {
	names: Array<string>
	symbols: Array<string>
	logoSources: Array<string>
	hrefs: Array<string | null>
	marketCaps: Array<number>
	priceChanges: {
		'24h': Array<number | null>
		'7d': Array<number | null>
		'30d': Array<number | null>
	}
	stablecoins: Array<boolean>
}

export interface TokensChartResponse extends TokensChartDataset {
	schemaVersion: typeof TOKENS_PAGE_RESPONSE_SCHEMA_VERSION
	unavailableSources: Array<TokensOptionalSource>
}

export interface TokensSourceRow extends TokensRowCore {
	searchKey: string
	chains: Array<string>
	primaryChain: string | null
	categories: Array<string>
}

export interface TokensFilterOption {
	id: string
	label: string
	description?: string
}

export interface TokensSortIndex {
	rows: Array<TokensSourceRow>
	sortBy: TokensSortBy
	nullStart: number
}

export type TokensSortIndexes = Record<TokensSortBy, TokensSortIndex>

export interface TokensPageStats {
	totalMarketCap: number
	marketCapWeightedChange24h: number | null
	spotVolume24h: number | null
	perpsVolume24h: number | null
	openInterest24h: number | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
}

export interface TokensPageStatsDisplay {
	totalMarketCap: string
	spotVolume24h: string | null
	perpsVolume24h: string | null
	openInterest24h: string | null
	unlock30dUsd: string | null
	upcomingUnlockUsd: string | null
}

export type TokensOptionalSource = 'markets' | 'rights' | 'fees' | 'revenue' | 'holdersRevenue' | 'unlocks'

export interface TokensPageResponse {
	snapshotVersion: string | null
	unavailableSources: Array<TokensOptionalSource>
	schemaVersion: typeof TOKENS_PAGE_RESPONSE_SCHEMA_VERSION
	rows: Array<TokensTableRow>
	total: number
	page: number
	pageSize: number
	hasMore: boolean
	stats: TokensPageStats
	statsDisplay: TokensPageStatsDisplay
	updatedAt: string | null
	chainOptions: Array<TokensFilterOption>
	categoryOptions: Array<TokensFilterOption>
}

export interface TokensPageQuery {
	page: number
	pageSize: number
	sortBy: TokensSortBy
	sortDesc: boolean
	search: string
	rankFrom: number | null
	rankTo: number | null
	numericFilters: Array<TokensNumericFilter>
	chains: Array<string> | null
	excludeChains: Array<string>
	nativeOnly: boolean
	categories: Array<string> | null
	excludeCategories: Array<string>
}

export interface TokensPageProps {
	initialData: TokensPageResponse
}
