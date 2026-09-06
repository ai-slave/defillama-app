import type { ProtocolTableMetrics } from '../contracts'

export const FILTERED_SHARE_COLUMN_PREFIX = 'filteredShare_'

export const FILTERED_SHARE_METRIC_KEYS = [
	'tvl',
	'mcap',
	'fees24h',
	'fees_7d',
	'fees_30d',
	'fees_1y',
	'average_1y',
	'cumulativeFees',
	'revenue24h',
	'revenue_7d',
	'revenue_30d',
	'revenue_1y',
	'volume24h',
	'volume_7d',
	'cumulativeVolume',
	'earnings24h',
	'earnings7d',
	'earnings30d',
	'earnings1y',
	'aggregators_volume_24h',
	'aggregators_volume_7d',
	'aggregators_volume_30d',
	'bridgeAggregatorVolume24h',
	'bridgeAggregatorVolume7d',
	'bridgeAggregatorVolume30d',
	'options_volume_24h',
	'options_volume_7d',
	'options_volume_30d'
] as const satisfies ReadonlyArray<keyof ProtocolTableMetrics>

export type FilteredShareMetricKey = (typeof FILTERED_SHARE_METRIC_KEYS)[number]
export type FilteredShareColumnId = `${typeof FILTERED_SHARE_COLUMN_PREFIX}${FilteredShareMetricKey}`

const FILTERED_SHARE_METRIC_KEYS_BY_ID = new Map<string, FilteredShareMetricKey>(
	FILTERED_SHARE_METRIC_KEYS.map((metric) => [metric, metric])
)

export function getFilteredShareColumnId(metric: FilteredShareMetricKey): FilteredShareColumnId {
	return `${FILTERED_SHARE_COLUMN_PREFIX}${metric}`
}

export function getFilteredShareMetricKey(id: string): FilteredShareMetricKey | null {
	if (!id.startsWith(FILTERED_SHARE_COLUMN_PREFIX)) return null
	const metric = id.slice(FILTERED_SHARE_COLUMN_PREFIX.length)
	return FILTERED_SHARE_METRIC_KEYS_BY_ID.get(metric) ?? null
}
