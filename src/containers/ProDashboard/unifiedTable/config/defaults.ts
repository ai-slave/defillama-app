import { UNIFIED_TABLE_COLUMN_DICTIONARY } from './columnDictionary'

export const DEFAULT_COLUMN_ORDER = [
	'name',
	'category',
	'chains',
	'tvl',
	'change1d',
	'change7d',
	'change1m',
	'fees24h',
	'fees_7d',
	'fees_30d',
	'revenue24h',
	'revenue_7d',
	'revenue_30d',
	'volume24h',
	'volume_7d',
	'perpsVolume24h',
	'openInterest',
	'mcap',
	'fdv',
	'mcaptvl'
]

// Meta columns always start visible; dominance, cumulative, specialized and share columns start hidden.
export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {}
for (const column of UNIFIED_TABLE_COLUMN_DICTIONARY) {
	DEFAULT_COLUMN_VISIBILITY[column.id] =
		column.render.startsWith('meta') ||
		!(
			column.tags?.includes('dominance') ||
			column.tags?.includes('cumulative') ||
			column.tags?.includes('specialized') ||
			column.tags?.includes('share')
		)
}
