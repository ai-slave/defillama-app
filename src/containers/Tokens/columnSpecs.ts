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

export const TOKENS_HIDEABLE_COLUMN_SPECS: Array<TokensColumnSpec> = [
	{
		id: 'price',
		header: 'Price',
		format: 'currency',
		filterCategory: 'price',
		csvValue: (row) => row.price ?? ''
	},
	{
		id: 'priceChange24h',
		header: '24H',
		format: 'percent',
		filterLabel: '24h Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange24h ?? ''
	},
	{
		id: 'priceChange7d',
		header: '7D',
		format: 'percent',
		filterLabel: '7d Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange7d ?? ''
	},
	{
		id: 'priceChange30d',
		header: '30D',
		format: 'percent',
		filterLabel: '30d Change',
		filterCategory: 'price',
		csvValue: (row) => row.priceChange30d ?? ''
	},
	{
		id: 'marketCap',
		header: 'Mcap',
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.marketCap ?? ''
	},
	{
		id: 'fdv',
		header: 'FDV',
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.fdv ?? ''
	},
	{
		id: 'outstandingFdv',
		header: 'OFDV',
		format: 'currency',
		filterCategory: 'valuation',
		csvValue: (row) => row.outstandingFdv ?? ''
	},
	{
		id: 'unlockedPercent',
		header: '% Unlocked',
		format: 'percent',
		filterCategory: 'unlocks',
		csvValue: (row) => row.unlockedPercent ?? ''
	},
	{
		id: 'spotVolume24h',
		header: '24h Spot Vol',
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.spotVolume24h ?? ''
	},
	{
		id: 'perpsVolume24h',
		header: '24h Perps Vol',
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.perpsVolume24h ?? ''
	},
	{
		id: 'openInterest24h',
		header: 'OI',
		format: 'currency',
		filterCategory: 'activity',
		csvValue: (row) => row.openInterest24h ?? ''
	},
	{
		id: 'fees24h',
		header: '24h Fees',
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.fees24h ?? ''
	},
	{
		id: 'revenue24h',
		header: '24h Rev',
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.revenue24h ?? ''
	},
	{
		id: 'holdersRevenue24h',
		header: '24h Holders Rev',
		format: 'currency',
		filterCategory: 'earnings',
		csvValue: (row) => row.holdersRevenue24h ?? ''
	},
	{
		id: 'trsPercent',
		header: 'TRS %',
		format: 'percent',
		filterCategory: 'earnings',
		csvValue: (row) => row.trsPercent ?? ''
	},
	{ id: 'rights', header: 'Rights', csvValue: (row) => row.rights?.protocolName ?? '' },
	{
		id: 'unlock30dUsd',
		header: 'Past 30d Unlocks',
		format: 'currency',
		filterCategory: 'unlocks',
		csvValue: (row) => row.unlock30dUsd ?? ''
	},
	{
		id: 'upcomingUnlockUsd',
		header: 'Next 30d Unlocks',
		format: 'currency',
		filterCategory: 'unlocks',
		csvValue: (row) => row.upcomingUnlockUsd ?? ''
	}
]
