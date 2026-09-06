type MigratedProtocolTablePresetId =
	| 'essential-protocols'
	| 'advanced-protocols'
	| 'fees-protocols'
	| 'revenue-protocols'
	| 'holders-protocols'
	| 'earnings-protocols'
	| 'volume-protocols'
	| 'perps-protocols'
	| 'open-interest-protocols'
	| 'aggregators-protocols'
	| 'bridge-aggregators-protocols'
	| 'options-protocols'

type LegacyProtocolTablePresetId =
	| 'essential'
	| 'advanced'
	| 'fees'
	| 'revenue'
	| 'holders'
	| 'earnings'
	| 'spot-volume'
	| 'perps-volume'
	| 'open-interest'
	| 'dex-aggregators'
	| 'bridge-aggregators'
	| 'options'

interface LegacyProtocolTablePresetMigration {
	targetPresetId: MigratedProtocolTablePresetId
	columnOrder: readonly [string, ...Array<string>]
	defaultSorting: readonly [{ id: string; desc: boolean }]
}

const TVL_SORT = [{ id: 'tvl', desc: true }] as const

/**
 * Historical classic Pro table presets as they were persisted before Unified Tables.
 *
 * Keep these layouts independent from the current preset registry: current presets can evolve,
 * while read-time migration must keep the meaning of an existing dashboard. Column renames and
 * removals are applied separately by `legacyProtocolTableColumnPolicy.ts`.
 */
const LEGACY_PROTOCOL_TABLE_PRESET_MIGRATIONS = {
	essential: {
		targetPresetId: 'essential-protocols',
		columnOrder: ['name', 'category', 'chains', 'tvl', 'change_1d', 'change_7d', 'mcap'],
		defaultSorting: TVL_SORT
	},
	advanced: {
		targetPresetId: 'advanced-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'tvl',
			'change_1d',
			'fees_24h',
			'revenue_24h',
			'volume_24h',
			'mcaptvl',
			'pf',
			'ps'
		],
		defaultSorting: TVL_SORT
	},
	fees: {
		targetPresetId: 'fees-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'tvl',
			'fees_24h',
			'fees_7d',
			'fees_30d',
			'fees_1y',
			'average_1y',
			'feesChange_1d',
			'feesChange_7d',
			'feesChange_1m',
			'feesChange_7dover7d',
			'feesChange_30dover30d',
			'cumulativeFees',
			'pf'
		],
		defaultSorting: [{ id: 'fees_24h', desc: true }]
	},
	revenue: {
		targetPresetId: 'revenue-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'tvl',
			'revenue_24h',
			'revenue_7d',
			'revenue_30d',
			'revenue_1y',
			'average_revenue_1y',
			'revenueChange_1d',
			'revenueChange_7d',
			'revenueChange_1m',
			'revenueChange_7dover7d',
			'revenueChange_30dover30d',
			'treasuryRevenue_24h',
			'supplySideRevenue_24h',
			'userFees_24h',
			'ps'
		],
		defaultSorting: [{ id: 'revenue_24h', desc: true }]
	},
	holders: {
		targetPresetId: 'holders-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'holdersRevenueChange_30dover30d',
			'revenue_30d',
			'revenueChange_1m'
		],
		defaultSorting: [{ id: 'holderRevenue_24h', desc: true }]
	},
	earnings: {
		targetPresetId: 'earnings-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'earnings_24h',
			'earnings_7d',
			'earnings_30d',
			'earnings_1y',
			'earningsChange_1d',
			'earningsChange_7d',
			'earningsChange_1m'
		],
		defaultSorting: [{ id: 'earnings_24h', desc: true }]
	},
	'spot-volume': {
		targetPresetId: 'volume-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'volume_24h',
			'volume_7d',
			'volume_30d',
			'volumeChange_1d',
			'volumeChange_7d',
			'volumeChange_1m',
			'volumeDominance_24h',
			'volumeMarketShare7d',
			'cumulativeVolume'
		],
		defaultSorting: [{ id: 'volume_24h', desc: true }]
	},
	'perps-volume': {
		targetPresetId: 'perps-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'perps_volume_24h',
			'perps_volume_7d',
			'perps_volume_30d',
			'perps_volume_change_1d',
			'perps_volume_change_7d',
			'perps_volume_change_1m',
			'perps_volume_dominance_24h',
			'openInterest'
		],
		defaultSorting: [{ id: 'perps_volume_24h', desc: true }]
	},
	'open-interest': {
		targetPresetId: 'open-interest-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'openInterest',
			'perps_volume_24h',
			'perps_volume_change_1d',
			'perps_volume_change_7d'
		],
		defaultSorting: [{ id: 'openInterest', desc: true }]
	},
	'dex-aggregators': {
		targetPresetId: 'aggregators-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'aggregators_volume_24h',
			'aggregators_volume_change_1d',
			'aggregators_volume_7d',
			'aggregators_volume_change_7d',
			'aggregators_volume_30d',
			'aggregators_volume_dominance_24h',
			'aggregators_volume_marketShare7d'
		],
		defaultSorting: [{ id: 'aggregators_volume_24h', desc: true }]
	},
	'bridge-aggregators': {
		targetPresetId: 'bridge-aggregators-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'bridge_aggregators_volume_24h',
			'bridge_aggregators_volume_change_1d',
			'bridge_aggregators_volume_7d',
			'bridge_aggregators_volume_change_7d',
			'bridge_aggregators_volume_30d',
			'bridge_aggregators_volume_dominance_24h'
		],
		defaultSorting: [{ id: 'bridge_aggregators_volume_24h', desc: true }]
	},
	options: {
		targetPresetId: 'options-protocols',
		columnOrder: [
			'name',
			'category',
			'chains',
			'options_volume_24h',
			'options_volume_change_1d',
			'options_volume_7d',
			'options_volume_change_7d',
			'options_volume_30d',
			'options_volume_dominance_24h'
		],
		defaultSorting: [{ id: 'options_volume_24h', desc: true }]
	}
} satisfies Readonly<Record<LegacyProtocolTablePresetId, LegacyProtocolTablePresetMigration>>

function isLegacyProtocolTablePresetId(id: string): id is keyof typeof LEGACY_PROTOCOL_TABLE_PRESET_MIGRATIONS {
	return Object.hasOwn(LEGACY_PROTOCOL_TABLE_PRESET_MIGRATIONS, id)
}

export function getLegacyProtocolTablePresetMigration(id: string): LegacyProtocolTablePresetMigration | undefined {
	return isLegacyProtocolTablePresetId(id) ? LEGACY_PROTOCOL_TABLE_PRESET_MIGRATIONS[id] : undefined
}
