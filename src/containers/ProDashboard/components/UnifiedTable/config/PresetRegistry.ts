import type { VisibilityState } from '@tanstack/react-table'
import { UNIFIED_TABLE_COLUMN_DICTIONARY } from '../../../unifiedTable/config/columnDictionary'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'

export interface UnifiedTablePreset {
	id: string
	name: string
	description?: string
	columnOrder: string[]
	columnVisibility: VisibilityState
	rowHeaders: UnifiedRowHeaderType[]
	defaultSorting?: Array<{ id: string; desc?: boolean }>
}

const ALL_COLUMN_IDS = ['name', ...UNIFIED_TABLE_COLUMN_DICTIONARY.map((column) => column.id)]

const createVisibility = (columns: string[]): VisibilityState => {
	const visible = new Set(columns)
	visible.add('name')
	return ALL_COLUMN_IDS.reduce<VisibilityState>((acc, id) => {
		acc[id] = visible.has(id)
		return acc
	}, {})
}

export const DEFAULT_UNIFIED_TABLE_PRESET: UnifiedTablePreset = {
	id: 'essential-protocols',
	name: 'Essential Protocols',
	description: 'Core protocol overview with TVL, fees, revenue, volume and ratios.',
	columnOrder: [
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
	columnVisibility: createVisibility([
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
	]),
	rowHeaders: ['parent-protocol', 'protocol'],
	defaultSorting: [{ id: 'tvl', desc: true }]
}

export const UNIFIED_TABLE_PRESETS: UnifiedTablePreset[] = [
	DEFAULT_UNIFIED_TABLE_PRESET,
	{
		id: 'advanced-protocols',
		name: 'Advanced Protocols',
		description: 'Protocol valuation with core activity and efficiency metrics.',
		columnOrder: [
			'name',
			'category',
			'chains',
			'tvl',
			'change1d',
			'fees24h',
			'revenue24h',
			'volume24h',
			'mcaptvl',
			'pf',
			'ps'
		],
		columnVisibility: createVisibility([
			'name',
			'category',
			'chains',
			'tvl',
			'change1d',
			'fees24h',
			'revenue24h',
			'volume24h',
			'mcaptvl',
			'pf',
			'ps'
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'tvl', desc: true }]
	},
	{
		id: 'fees-protocols',
		name: 'Fees',
		description: 'Daily/weekly/monthly fees with holder revenue.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'fees24h', desc: true }]
	},
	{
		id: 'holders-protocols',
		name: 'Holder Revenue',
		description: 'Holder revenue distribution alongside total protocol revenue.',
		columnOrder: [
			'name',
			'category',
			'chains',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'holderRevenueChange30dOver30d',
			'revenue_30d',
			'revenue24hChange30dAgo'
		],
		columnVisibility: createVisibility([
			'name',
			'category',
			'chains',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'holderRevenueChange30dOver30d',
			'revenue_30d',
			'revenue24hChange30dAgo'
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'holderRevenue_24h', desc: true }]
	},
	{
		id: 'volume-protocols',
		name: 'DEXs',
		description: 'Volume with changes and market share metrics.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'volume24h', desc: true }]
	},
	{
		id: 'perps-protocols',
		name: 'Perpetuals',
		description: 'Perpetual volume, changes and open interest.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'perpsVolume24h', desc: true }]
	},
	{
		id: 'open-interest-protocols',
		name: 'Open Interest',
		description: 'Open interest with perpetual volume and point-in-time comparisons.',
		columnOrder: [
			'name',
			'category',
			'chains',
			'openInterest',
			'perpsVolume24h',
			'perps_volume_change_1d',
			'perpsVolume24hChange7dAgo'
		],
		columnVisibility: createVisibility([
			'name',
			'category',
			'chains',
			'openInterest',
			'perpsVolume24h',
			'perps_volume_change_1d',
			'perpsVolume24hChange7dAgo'
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'openInterest', desc: true }]
	},
	{
		id: 'revenue-protocols',
		name: 'Revenue',
		description: 'Revenue performance with longer-term trends and efficiency ratios.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'revenue24h', desc: true }]
	},
	{
		id: 'earnings-protocols',
		name: 'Earnings',
		description: 'Protocol earnings after token incentives across canonical periods.',
		columnOrder: ['name', 'category', 'chains', 'earnings24h', 'earnings7d', 'earnings30d', 'earnings1y'],
		columnVisibility: createVisibility([
			'name',
			'category',
			'chains',
			'earnings24h',
			'earnings7d',
			'earnings30d',
			'earnings1y'
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'earnings24h', desc: true }]
	},
	{
		id: 'growth-protocols',
		name: 'Growth',
		description: 'TVL, volume and fee momentum to spot what is trending.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'change7d', desc: true }]
	},
	{
		id: 'aggregators-protocols',
		name: 'DEX Aggregators',
		description: 'Aggregator volumes, share and momentum.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'aggregators_volume_24h', desc: true }]
	},
	{
		id: 'bridge-aggregators-protocols',
		name: 'Bridge Aggregators',
		description: 'Bridge flow volumes and market share.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'bridgeAggregatorVolume24h', desc: true }]
	},
	{
		id: 'options-protocols',
		name: 'Options',
		description: 'Options volume with growth and market share.',
		columnOrder: [
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
		columnVisibility: createVisibility([
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
		]),
		rowHeaders: ['parent-protocol', 'protocol'],
		defaultSorting: [{ id: 'options_volume_24h', desc: true }]
	}
]

export const UNIFIED_TABLE_PRESETS_BY_ID = new Map(UNIFIED_TABLE_PRESETS.map((preset) => [preset.id, preset]))
