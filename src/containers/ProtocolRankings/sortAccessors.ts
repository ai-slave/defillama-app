import { getProtocolEarningsValue } from './readModel'
import type { IChildProtocol } from './types'

export type ProtocolRankingSortValue = string | number | boolean | null
type SortAccessor = (row: IChildProtocol) => ProtocolRankingSortValue

export const PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS = [
	'perps',
	'normalizedVolume',
	'activeLiquidity',
	'openInterest',
	'optionsPremiumVolume',
	'optionsNotionalVolume',
	'dexAggregators',
	'perpsAggregators',
	'bridgeAggregators'
] as const

export type ProtocolRankingActivityMetricKey = (typeof PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS)[number]

function activityValue(
	metric: ProtocolRankingActivityMetricKey | 'dexs',
	period: 'total24h' | 'total7d' | 'total30d' | 'totalAllTime' | 'change_7dover7d'
): SortAccessor {
	return (row) => row[metric]?.[period] ?? null
}

export const PROTOCOL_RANKING_SORT_ACCESSORS = {
	tvl: (row) => row.tvl?.default.tvl ?? null,
	change_1d: (row) => row.tvlChange?.change1d ?? null,
	change_7d: (row) => row.tvlChange?.change7d ?? null,
	change_1m: (row) => row.tvlChange?.change1m ?? null,
	mcap: (row) => row.mcap ?? null,
	token_price: (row) => row.tokenPrice ?? null,
	mcaptvl: (row) => row.mcaptvl ?? null,
	fees_24h: (row) => row.fees?.total24h ?? null,
	fees_7d: (row) => row.fees?.total7d ?? null,
	fees_30d: (row) => row.fees?.total30d ?? null,
	fees_1y: (row) => row.fees?.total1y ?? null,
	average_fees_1y: (row) => row.fees?.monthlyAverage1y ?? null,
	fees_cumulative: (row) => row.fees?.totalAllTime ?? null,
	revenue_24h: (row) => row.revenue?.total24h ?? null,
	revenue_7d: (row) => row.revenue?.total7d ?? null,
	revenue_30d: (row) => row.revenue?.total30d ?? null,
	revenue_1y: (row) => row.revenue?.total1y ?? null,
	average_revenue_1y: (row) => row.revenue?.monthlyAverage1y ?? null,
	cumulativeRevenue: (row) => row.revenue?.totalAllTime ?? null,
	holdersRevenue_24h: (row) => row.holdersRevenue?.total24h ?? null,
	holdersRevenue_7d: (row) => row.holdersRevenue?.total7d ?? null,
	holdersRevenue_30d: (row) => row.holdersRevenue?.total30d ?? null,
	holdersRevenue_1y: (row) => row.holdersRevenue?.total1y ?? null,
	average_holdersRevenue_1y: (row) => row.holdersRevenue?.monthlyAverage1y ?? null,
	cumulativeHoldersRevenue: (row) => row.holdersRevenue?.totalAllTime ?? null,
	emissions_24h: (row) => row.emissions?.total24h ?? null,
	emissions_7d: (row) => row.emissions?.total7d ?? null,
	emissions_30d: (row) => row.emissions?.total30d ?? null,
	emissions_1y: (row) => row.emissions?.total1y ?? null,
	average_emissions_1y: (row) => row.emissions?.monthlyAverage1y ?? null,
	cumulativeEmissions: (row) => row.emissions?.totalAllTime ?? null,
	earnings_24h: (row) => getProtocolEarningsValue(row.revenue?.total24h, row.emissions?.total24h),
	earnings_7d: (row) => getProtocolEarningsValue(row.revenue?.total7d, row.emissions?.total7d),
	earnings_30d: (row) => getProtocolEarningsValue(row.revenue?.total30d, row.emissions?.total30d),
	earnings_1y: (row) => getProtocolEarningsValue(row.revenue?.total1y, row.emissions?.total1y),
	average_earnings_1y: (row) =>
		getProtocolEarningsValue(row.revenue?.monthlyAverage1y, row.emissions?.monthlyAverage1y),
	cumulativeEarnings: (row) => getProtocolEarningsValue(row.revenue?.totalAllTime, row.emissions?.totalAllTime),
	pf: (row) => row.fees?.pf ?? null,
	ps: (row) => row.revenue?.ps ?? null,
	dex_volume_24h: activityValue('dexs', 'total24h'),
	dex_volume_7d: activityValue('dexs', 'total7d'),
	dex_volume_30d: activityValue('dexs', 'total30d'),
	dex_volume_change_7d: activityValue('dexs', 'change_7dover7d'),
	dex_cumulative_volume: activityValue('dexs', 'totalAllTime'),
	perp_volume_24h: activityValue('perps', 'total24h'),
	perp_volume_7d: activityValue('perps', 'total7d'),
	perp_volume_30d: activityValue('perps', 'total30d'),
	normalized_volume_24h: activityValue('normalizedVolume', 'total24h'),
	normalized_volume_7d: activityValue('normalizedVolume', 'total7d'),
	normalized_volume_30d: activityValue('normalizedVolume', 'total30d'),
	options_premium_volume_24h: activityValue('optionsPremiumVolume', 'total24h'),
	options_premium_volume_7d: activityValue('optionsPremiumVolume', 'total7d'),
	options_premium_volume_30d: activityValue('optionsPremiumVolume', 'total30d'),
	options_notional_volume_24h: activityValue('optionsNotionalVolume', 'total24h'),
	options_notional_volume_7d: activityValue('optionsNotionalVolume', 'total7d'),
	options_notional_volume_30d: activityValue('optionsNotionalVolume', 'total30d'),
	dex_aggregator_volume_24h: activityValue('dexAggregators', 'total24h'),
	dex_aggregator_volume_7d: activityValue('dexAggregators', 'total7d'),
	dex_aggregator_volume_30d: activityValue('dexAggregators', 'total30d'),
	perp_aggregator_volume_24h: activityValue('perpsAggregators', 'total24h'),
	perp_aggregator_volume_7d: activityValue('perpsAggregators', 'total7d'),
	perp_aggregator_volume_30d: activityValue('perpsAggregators', 'total30d'),
	bridge_aggregator_volume_24h: activityValue('bridgeAggregators', 'total24h'),
	bridge_aggregator_volume_7d: activityValue('bridgeAggregators', 'total7d'),
	bridge_aggregator_volume_30d: activityValue('bridgeAggregators', 'total30d'),
	open_interest: activityValue('openInterest', 'total24h'),
	active_liquidity: activityValue('activeLiquidity', 'total24h')
} satisfies Record<string, SortAccessor>

export type ProtocolRankingSortKey = keyof typeof PROTOCOL_RANKING_SORT_ACCESSORS

export const PROTOCOL_RANKING_SORT_KEYS = Object.keys(PROTOCOL_RANKING_SORT_ACCESSORS) as Array<ProtocolRankingSortKey>

export function getProtocolRankingSortValue(
	row: IChildProtocol,
	key: ProtocolRankingSortKey
): ProtocolRankingSortValue {
	return PROTOCOL_RANKING_SORT_ACCESSORS[key](row)
}
