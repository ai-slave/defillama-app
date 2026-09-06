interface UnversionedUnifiedTablePresetLayout {
	readonly id: string
	readonly columnOrder: ReadonlyArray<string>
	readonly defaultSorting: ReadonlyArray<{ id: string; desc: boolean }>
}

const createPresetLayout = (
	id: string,
	columnOrder: ReadonlyArray<string>,
	defaultSortColumn: string
): UnversionedUnifiedTablePresetLayout => ({
	id,
	columnOrder,
	defaultSorting: [{ id: defaultSortColumn, desc: true }]
})

/**
 * Snapshot of the layouts referenced by unversioned Unified Table configs.
 *
 * These values are migration history, not the current preset registry. Keep them beside the
 * migration so editing a current preset cannot change how an existing dashboard is read.
 */
export const DEFAULT_UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUT = createPresetLayout(
	'essential-protocols',
	[
		'name',
		'category',
		'chains',
		'tvl',
		'change1d',
		'change7d',
		'fees24h',
		'fees_7d',
		'revenue24h',
		'revenue_7d',
		'volume24h',
		'volume_7d',
		'mcap',
		'mcaptvl'
	],
	'tvl'
)

const UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUTS: Readonly<Record<string, UnversionedUnifiedTablePresetLayout>> = {
	'essential-protocols': DEFAULT_UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUT,
	'advanced-protocols': createPresetLayout(
		'advanced-protocols',
		['name', 'category', 'chains', 'tvl', 'change1d', 'fees24h', 'revenue24h', 'volume24h', 'mcaptvl', 'pf', 'ps'],
		'tvl'
	),
	'fees-protocols': createPresetLayout(
		'fees-protocols',
		[
			'name',
			'category',
			'chains',
			'fees24h',
			'fees_7d',
			'fees_30d',
			'fees_1y',
			'average_1y',
			'cumulativeFees',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'feesChange_1d',
			'feesChange7dOver7d',
			'feesChange30dOver30d'
		],
		'fees24h'
	),
	'holders-protocols': createPresetLayout(
		'holders-protocols',
		[
			'name',
			'category',
			'chains',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'holderRevenueChange30dOver30d',
			'revenue_30d',
			'revenue24hChange30dAgo'
		],
		'holderRevenue_24h'
	),
	'volume-protocols': createPresetLayout(
		'volume-protocols',
		[
			'name',
			'category',
			'chains',
			'volume24h',
			'volume_7d',
			'volume_30d',
			'cumulativeVolume',
			'volumeChange_1d',
			'volumeChange7dOver7d',
			'volumeChange30dOver30d',
			'volumeDominance_24h',
			'volumeMarketShare7d'
		],
		'volume24h'
	),
	'perps-protocols': createPresetLayout(
		'perps-protocols',
		[
			'name',
			'category',
			'chains',
			'perpsVolume24h',
			'perps_volume_7d',
			'perps_volume_30d',
			'perps_volume_change_1d',
			'perpsVolumeChange7dOver7d',
			'perpsVolumeChange30dOver30d',
			'perps_volume_dominance_24h',
			'openInterest'
		],
		'perpsVolume24h'
	),
	'open-interest-protocols': createPresetLayout(
		'open-interest-protocols',
		[
			'name',
			'category',
			'chains',
			'openInterest',
			'perpsVolume24h',
			'perps_volume_change_1d',
			'perpsVolume24hChange7dAgo'
		],
		'openInterest'
	),
	'revenue-protocols': createPresetLayout(
		'revenue-protocols',
		[
			'name',
			'category',
			'chains',
			'revenue24h',
			'revenue_7d',
			'revenue_30d',
			'revenue_1y',
			'average_revenue_1y',
			'revenueChange_1d',
			'revenueChange7dOver7d',
			'revenueChange30dOver30d',
			'fees24h',
			'fees_7d',
			'mcap',
			'mcaptvl'
		],
		'revenue24h'
	),
	'earnings-protocols': createPresetLayout(
		'earnings-protocols',
		['name', 'category', 'chains', 'earnings24h', 'earnings7d', 'earnings30d', 'earnings1y'],
		'earnings24h'
	),
	'growth-protocols': createPresetLayout(
		'growth-protocols',
		[
			'name',
			'category',
			'chains',
			'tvl',
			'change1d',
			'change7d',
			'change1m',
			'volume24h',
			'volumeChange_1d',
			'volumeChange7dOver7d',
			'volumeChange30dOver30d',
			'fees24h',
			'feesChange_1d',
			'feesChange7dOver7d',
			'revenue24h',
			'revenueChange_1d',
			'revenueChange7dOver7d',
			'mcaptvl'
		],
		'change7d'
	),
	'aggregators-protocols': createPresetLayout(
		'aggregators-protocols',
		[
			'name',
			'category',
			'chains',
			'aggregators_volume_24h',
			'aggregators_volume_7d',
			'aggregators_volume_30d',
			'aggregators_volume_change_1d',
			'aggregatorVolumeChange7dOver7d',
			'aggregators_volume_dominance_24h',
			'aggregators_volume_marketShare7d',
			'volume24h',
			'volume_7d'
		],
		'aggregators_volume_24h'
	),
	'bridge-aggregators-protocols': createPresetLayout(
		'bridge-aggregators-protocols',
		[
			'name',
			'category',
			'chains',
			'bridgeAggregatorVolume24h',
			'bridgeAggregatorVolume7d',
			'bridgeAggregatorVolume30d',
			'bridgeAggregatorVolumeChange1d',
			'bridgeAggregatorVolume24hChange7dAgo',
			'bridgeAggregatorVolumeDominance24h',
			'volume24h',
			'volume_7d'
		],
		'bridgeAggregatorVolume24h'
	),
	'options-protocols': createPresetLayout(
		'options-protocols',
		[
			'name',
			'category',
			'chains',
			'options_volume_24h',
			'options_volume_7d',
			'options_volume_30d',
			'options_volume_change_1d',
			'optionsVolumeChange7dOver7d',
			'options_volume_dominance_24h',
			'volume24h',
			'volume_7d'
		],
		'options_volume_24h'
	)
}

export function getUnversionedUnifiedTablePresetLayout(
	presetId: string | undefined
): UnversionedUnifiedTablePresetLayout | undefined {
	return presetId && Object.hasOwn(UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUTS, presetId)
		? UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUTS[presetId]
		: undefined
}
