import type { TokensNumericFilterField, TokensTableRow } from './types'

export const TOKENS_FILTER_CATEGORIES = [
	{ key: 'market', label: 'Market' },
	{ key: 'price', label: 'Price' },
	{ key: 'valuation', label: 'Valuation' },
	{ key: 'activity', label: 'Activity' },
	{ key: 'earnings', label: 'Earnings' },
	{ key: 'unlocks', label: 'Unlocks' }
] as const

export type TokensFilterCategory = (typeof TOKENS_FILTER_CATEGORIES)[number]['key']
export type TokensFilterFormat = 'currency' | 'percent' | 'number'

interface TokensColumnSpecBase {
	header: string
	width: number
	csvValue: (row: TokensTableRow) => string | number
}

// Every numeric column is a server-side filter field, so a spec cannot offer a filter the server drops.
export type TokensColumnSpec =
	| (TokensColumnSpecBase & {
			id: TokensNumericFilterField
			format: TokensFilterFormat
			filterCategory: TokensFilterCategory
			filterLabel?: string
	  })
	| (TokensColumnSpecBase & { id: 'rights' })

export const NAME_COLUMN_WIDTH = 184

export const TOKENS_HIDEABLE_COLUMN_SPECS: Array<TokensColumnSpec> = [
	{
		id: 'price',
		header: 'Price',
		width: 140,
		format: 'currency',
		filterCategory: 'price',
		csvValue: (row) => row.price ?? ''
	},
	{
		id: 'priceChange24h',
		header: '24H',
		width: 90,
		format: 'percent',
		filterLabel: '24h Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange24h ?? ''
	},
	{
		id: 'priceChange7d',
		header: '7D',
		width: 90,
		format: 'percent',
		filterLabel: '7d Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange7d ?? ''
	},
	{
		id: 'priceChange30d',
		header: '30D',
		width: 90,
		format: 'percent',
		filterLabel: '30d Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange30d ?? ''
	},
	{
		id: 'marketCap',
		header: 'Mcap',
		width: 120,
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.marketCap ?? ''
	},
	{
		id: 'fdv',
		header: 'FDV',
		width: 120,
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.fdv ?? ''
	},
	{
		id: 'outstandingFdv',
		header: 'OFDV',
		width: 120,
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.outstandingFdv ?? ''
	},
	{
		id: 'unlockedPercent',
		header: '% Unlocked',
		width: 130,
		format: 'percent',
		filterCategory: 'unlocks',
		csvValue: (row) => row.unlockedPercent ?? ''
	},
	{
		id: 'spotVolume24h',
		header: '24h Spot Vol',
		width: 120,
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.spotVolume24h ?? ''
	},
	{
		id: 'perpsVolume24h',
		header: '24h Perps Vol',
		width: 120,
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.perpsVolume24h ?? ''
	},
	{
		id: 'openInterest24h',
		header: 'OI',
		width: 110,
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.openInterest24h ?? ''
	},
	{
		id: 'fees24h',
		header: '24h Fees',
		width: 110,
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.fees24h ?? ''
	},
	{
		id: 'revenue24h',
		header: '24h Rev',
		width: 110,
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.revenue24h ?? ''
	},
	{
		id: 'holdersRevenue24h',
		header: '24h Holders Rev',
		width: 150,
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.holdersRevenue24h ?? ''
	},
	{
		id: 'trsPercent',
		header: 'TRS %',
		width: 120,
		format: 'percent',
		filterCategory: 'earnings',
		csvValue: (row) => row.trsPercent ?? ''
	},
	{ id: 'rights', header: 'Rights', width: 90, csvValue: (row) => row.rights?.protocolName ?? '' },
	{
		id: 'unlock30dUsd',
		header: 'Past 30d Unlocks',
		width: 160,
		format: 'currency',
		filterCategory: 'unlocks',
		csvValue: (row) => row.unlock30dUsd ?? ''
	},
	{
		id: 'upcomingUnlockUsd',
		header: 'Next 30d Unlocks',
		width: 160,
		format: 'currency',
		filterCategory: 'unlocks',
		csvValue: (row) => row.upcomingUnlockUsd ?? ''
	}
]

export const TOKENS_HIDEABLE_COLUMNS_WIDTH = TOKENS_HIDEABLE_COLUMN_SPECS.reduce((sum, spec) => sum + spec.width, 0)
