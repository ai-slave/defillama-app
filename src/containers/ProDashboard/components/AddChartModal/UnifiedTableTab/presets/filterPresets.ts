import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'

export type FilterPresetCategory = 'size' | 'revenue' | 'investment' | 'category' | 'quick' | 'growth' | 'activity'

export interface FilterPreset {
	id: string
	name: string
	description: string
	category: FilterPresetCategory
	filters: Partial<UnifiedTableFilters>
	tooltip?: string
	sortBy?: {
		field: string
		direction: 'asc' | 'desc'
	}
	strategyType?: 'protocols' | 'chains' | 'both'
}

const SIZE_PRESETS: Array<FilterPreset> = [
	{
		id: 'size-large',
		name: 'Large',
		description: 'Protocols with $1B+ TVL',
		category: 'size',
		filters: {
			tvlMin: 1_000_000_000
		},
		tooltip: 'TVL ≥ $1B',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'size-mid',
		name: 'Mid',
		description: 'Protocols with $100M-$1B TVL',
		category: 'size',
		filters: {
			tvlMin: 100_000_000,
			tvlMax: 1_000_000_000
		},
		tooltip: '$100M ≤ TVL < $1B',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'size-small',
		name: 'Small',
		description: 'Protocols with $10M-$100M TVL',
		category: 'size',
		filters: {
			tvlMin: 10_000_000,
			tvlMax: 100_000_000
		},
		tooltip: '$10M ≤ TVL < $100M',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const REVENUE_PRESETS: Array<FilterPreset> = [
	{
		id: 'revenue-leaders',
		name: 'Revenue leaders',
		description: 'Protocols earning over $100k per day',
		category: 'revenue',
		filters: {
			revenue24hMin: 100_000
		},
		tooltip: 'Revenue ≥ $100k in the last 24h',
		sortBy: { field: 'revenue24h', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const INVESTMENT_PRESETS: Array<FilterPreset> = [
	{
		id: 'value-plays',
		name: 'Value protocols',
		description: 'P/F below 20 with meaningful revenue',
		category: 'investment',
		filters: {
			pfRatioMin: 0,
			pfRatioMax: 20,
			revenue24hMin: 1000,
			tvlMin: 10_000_000
		},
		tooltip: 'P/F ≤ 20, revenue ≥ $1k, TVL ≥ $10M',
		sortBy: { field: 'revenue24h', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'institutional-grade',
		name: 'Institutional grade',
		description: 'Large protocols with $1B+ TVL and $10M+ 1y revenue',
		category: 'investment',
		filters: {
			tvlMin: 1_000_000_000,
			revenue1yMin: 10_000_000
		},
		tooltip: 'TVL ≥ $1B, 1y revenue ≥ $10M',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const CATEGORY_PRESETS: Array<FilterPreset> = [
	{
		id: 'dex-leaders',
		name: 'DEX leaders',
		description: 'Top decentralized exchanges by activity',
		category: 'category',
		filters: {
			categories: ['Dexes'],
			volumeDex24hMin: 10_000_000,
			tvlMin: 50_000_000
		},
		tooltip: 'Category Dexes, Volume ≥ $10M, TVL ≥ $50M',
		sortBy: { field: 'volume24h', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'perps-platforms',
		name: 'Perps platforms',
		description: 'Perpetual futures venues with real usage',
		category: 'category',
		filters: {
			hasPerps: true,
			volumeDex24hMin: 5_000_000
		},
		tooltip: 'Perps supported, Volume ≥ $5M',
		sortBy: { field: 'volume24h', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const QUICK_PRESETS: Array<FilterPreset> = [
	{
		id: 'active-protocols',
		name: 'Active protocols',
		description: 'Protocols with TVL and fee generation',
		category: 'quick',
		filters: {
			tvlMin: 1,
			hasFees: true
		},
		tooltip: 'Has TVL and fees',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'with-token',
		name: 'With token',
		description: 'Protocols that have a tradeable token',
		category: 'quick',
		filters: {
			hasMarketCap: true
		},
		tooltip: 'Has market cap data',
		sortBy: { field: 'tvl', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const GROWTH_PRESETS: Array<FilterPreset> = [
	{
		id: 'tvl-growing-weekly',
		name: 'TVL growing (7d)',
		description: 'Protocols with positive TVL growth this week',
		category: 'growth',
		filters: {
			change7dMin: 5,
			tvlMin: 1_000_000
		},
		tooltip: 'TVL change 7d ≥ 5%, TVL ≥ $1M',
		sortBy: { field: 'change7d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'tvl-surging',
		name: 'TVL surging (1d)',
		description: 'Protocols with strong daily TVL increase',
		category: 'growth',
		filters: {
			change1dMin: 10,
			tvlMin: 1_000_000
		},
		tooltip: 'TVL change 1d ≥ 10%, TVL ≥ $1M',
		sortBy: { field: 'change1d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'volume-surge',
		name: 'Volume surge',
		description: 'Protocols with spiking trading volume',
		category: 'growth',
		filters: {
			volumeChange7dOver7dMin: 50,
			volumeDex24hMin: 1_000_000
		},
		tooltip: 'Volume change 7d ≥ 50%, Volume ≥ $1M',
		sortBy: { field: 'volumeChange7dOver7d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'revenue-growing',
		name: 'Revenue growing',
		description: 'Protocols with increasing revenue',
		category: 'growth',
		filters: {
			revenueChange7dOver7dMin: 20,
			revenue24hMin: 10_000
		},
		tooltip: 'Revenue change 7d ≥ 20%, Revenue ≥ $10k',
		sortBy: { field: 'revenueChange7dOver7d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'fees-momentum',
		name: 'Fees momentum',
		description: 'Protocols with growing fee generation',
		category: 'growth',
		filters: {
			feesChange7dOver7dMin: 25,
			fees24hMin: 10_000
		},
		tooltip: 'Fees change 7d ≥ 25%, Fees ≥ $10k',
		sortBy: { field: 'feesChange7dOver7d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'hot-this-month',
		name: 'Hot this month',
		description: 'Strong growth across TVL and volume',
		category: 'growth',
		filters: {
			change1mMin: 20,
			volumeChange30dOver30dMin: 20,
			tvlMin: 5_000_000
		},
		tooltip: 'TVL & Volume change 30d ≥ 20%, TVL ≥ $5M',
		sortBy: { field: 'change1m', direction: 'desc' },
		strategyType: 'protocols'
	}
]

const ACTIVITY_PRESETS: Array<FilterPreset> = [
	{
		id: 'high-volume-24h',
		name: 'High volume (24h)',
		description: 'Top protocols by daily trading volume',
		category: 'activity',
		filters: {
			volumeDex24hMin: 50_000_000
		},
		tooltip: 'Volume 24h ≥ $50M',
		sortBy: { field: 'volume24h', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'volume-leaders-weekly',
		name: 'Volume leaders (7d)',
		description: 'Protocols with strong weekly volume',
		category: 'activity',
		filters: {
			volume7dMin: 100_000_000
		},
		tooltip: 'Volume 7d ≥ $100M',
		sortBy: { field: 'volume_7d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'fee-generators',
		name: 'Fee generators',
		description: 'Protocols generating significant fees',
		category: 'activity',
		filters: {
			fees24hMin: 100_000
		},
		tooltip: 'Fees 24h ≥ $100k',
		sortBy: { field: 'fees24h', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'monthly-fee-leaders',
		name: 'Monthly fee leaders',
		description: 'Top fee earners over 30 days',
		category: 'activity',
		filters: {
			fees30dMin: 1_000_000
		},
		tooltip: 'Fees 30d ≥ $1M',
		sortBy: { field: 'fees_30d', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'high-activity',
		name: 'High activity',
		description: 'Active protocols with volume and fees',
		category: 'activity',
		filters: {
			volumeDex24hMin: 10_000_000,
			fees24hMin: 50_000
		},
		tooltip: 'Volume ≥ $10M, Fees ≥ $50k',
		sortBy: { field: 'volume24h', direction: 'desc' },
		strategyType: 'protocols'
	},
	{
		id: 'aggregator-volume',
		name: 'Aggregator Volume',
		description: 'Protocols with DEX aggregator flow',
		category: 'activity',
		filters: {
			hasAggregators: true,
			aggregatorsVolume24hMin: 1_000_000
		},
		tooltip: 'Aggregator volume ≥ $1M',
		sortBy: { field: 'aggregators_volume_24h', direction: 'desc' },
		strategyType: 'protocols'
	}
]

export const CORE_FILTER_PRESETS: Array<FilterPreset> = [
	...SIZE_PRESETS,
	...REVENUE_PRESETS,
	...INVESTMENT_PRESETS,
	...CATEGORY_PRESETS,
	...QUICK_PRESETS,
	...GROWTH_PRESETS,
	...ACTIVITY_PRESETS
]
