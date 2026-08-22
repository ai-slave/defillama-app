import type { ProtocolTableMetrics } from '../contracts'
import {
	FILTERED_SHARE_METRIC_KEYS,
	getFilteredShareColumnId,
	type FilteredShareColumnId
} from './filteredShareColumns'

type ColumnRenderType =
	| 'usd'
	| 'percent'
	| 'ratio'
	| 'number'
	| 'meta'
	| 'meta-category'
	| 'meta-chains'
	| 'meta-oracles'

export type MetricGroup =
	| 'tvl'
	| 'volume'
	| 'fees'
	| 'revenue'
	| 'earnings'
	| 'perps'
	| 'aggregators'
	| 'bridge-aggregators'
	| 'derivatives-aggregators'
	| 'options'
	| 'ratios'

interface ColumnDictionaryItem {
	id: keyof ProtocolTableMetrics | FilteredShareColumnId | 'category' | 'chains' | 'oracles'
	header: string
	description?: string
	group: MetricGroup | 'meta'
	render: ColumnRenderType
	tags?: string[]
	chainGroupOnly?: boolean
}

const metaColumns: ColumnDictionaryItem[] = [
	{
		id: 'category',
		header: 'Category',
		group: 'meta',
		render: 'meta-category'
	},
	{
		id: 'chains',
		header: 'Chains',
		group: 'meta',
		render: 'meta-chains'
	},
	{
		id: 'oracles',
		header: 'Oracles',
		group: 'meta',
		render: 'meta-oracles'
	}
]

const tvlColumns: ColumnDictionaryItem[] = [
	{ id: 'tvl', header: 'TVL', group: 'tvl', render: 'usd' },
	{ id: 'change1d', header: '1d Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'change7d', header: '7d Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'change1m', header: '30d Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'change90d', header: '90d Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'change180d', header: '180d Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'change1y', header: '1y Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'changeYtd', header: 'YTD Change', group: 'tvl', render: 'percent', tags: ['change'] },
	{ id: 'stakingTvl', header: 'Staking TVL', group: 'tvl', render: 'usd' },
	{ id: 'borrowedTvl', header: 'Borrowed TVL', group: 'tvl', render: 'usd' },
	{ id: 'pool2Tvl', header: 'Pool2 TVL', group: 'tvl', render: 'usd' },
	{ id: 'treasuryTvl', header: 'Treasury TVL', group: 'tvl', render: 'usd' },
	{ id: 'vestingTvl', header: 'Vesting TVL', group: 'tvl', render: 'usd' },
	{ id: 'bridgedTvl', header: 'Bridged TVL', group: 'tvl', render: 'usd', chainGroupOnly: true },
	{ id: 'stablesMcap', header: 'Stables', group: 'tvl', render: 'usd', chainGroupOnly: true },
	{
		id: 'tvlShare',
		header: 'TVL Share',
		group: 'tvl',
		render: 'percent',
		tags: ['dominance'],
		chainGroupOnly: true
	},
	{
		id: 'stablesShare',
		header: 'Stables Share',
		group: 'tvl',
		render: 'percent',
		tags: ['dominance'],
		chainGroupOnly: true
	}
]

const volumeColumns: ColumnDictionaryItem[] = [
	{ id: 'volume24h', header: '24h Volume', group: 'volume', render: 'usd' },
	{ id: 'volume_7d', header: '7d Volume', group: 'volume', render: 'usd' },
	{ id: 'volume_30d', header: '30d Volume', group: 'volume', render: 'usd' },
	{ id: 'volume_90d', header: '90d Volume', group: 'volume', render: 'usd' },
	{ id: 'volume_1y', header: '1y Volume', group: 'volume', render: 'usd' },
	{
		id: 'cumulativeVolume',
		header: 'Cumulative Volume',
		group: 'volume',
		render: 'usd',
		tags: ['cumulative']
	},
	{
		id: 'volumeChange_1d',
		header: '1d Volume Change',
		group: 'volume',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'volume24hChange7dAgo',
		header: '24h Volume vs 7d Ago',
		group: 'volume',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'volume24hChange30dAgo',
		header: '24h Volume vs 30d Ago',
		group: 'volume',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'volumeChange7dOver7d',
		header: '7d over 7d Volume Change',
		group: 'volume',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'volumeChange30dOver30d',
		header: '30d over 30d Volume Change',
		group: 'volume',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'volumeDominance_24h',
		header: 'Global 24h DEX Volume Share',
		group: 'volume',
		render: 'percent',
		description:
			'Protocol volume divided by global 24h DEX volume, including when the table is filtered to selected chains.',
		tags: ['dominance']
	},
	{
		id: 'volumeMarketShare7d',
		header: 'Global 7d DEX Volume Share',
		group: 'volume',
		render: 'percent',
		description:
			'Protocol volume divided by global 7d DEX volume, including when the table is filtered to selected chains.',
		tags: ['dominance']
	},
	{
		id: 'volume24hShare',
		header: '24h Chain Volume Share',
		group: 'volume',
		render: 'percent',
		tags: ['dominance'],
		chainGroupOnly: true
	}
]

const feesColumns: ColumnDictionaryItem[] = [
	{ id: 'fees24h', header: '24h Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_7d', header: '7d Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_30d', header: '30d Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_90d', header: '90d Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_180d', header: '180d Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_1y', header: '1y Fees', group: 'fees', render: 'usd' },
	{ id: 'fees_ytd', header: 'YTD Fees', group: 'fees', render: 'usd' },
	{
		id: 'average_1y',
		header: '1y Monthly Avg Fees',
		group: 'fees',
		render: 'usd',
		tags: ['derived']
	},
	{
		id: 'cumulativeFees',
		header: 'Cumulative Fees',
		group: 'fees',
		render: 'usd',
		tags: ['cumulative']
	},
	{
		id: 'holderRevenue_24h',
		header: '24h Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenue_7d',
		header: '7d Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holdersRevenue30d',
		header: '30d Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenue_90d',
		header: '90d Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenue_180d',
		header: '180d Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenue_1y',
		header: '1y Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenue_ytd',
		header: 'YTD Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'cumulativeHolderRevenue',
		header: 'Cumulative Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['cumulative', 'distribution']
	},
	{
		id: 'holderRevenueAnnualized1y',
		header: 'Annualized Holder Revenue',
		group: 'fees',
		render: 'usd',
		tags: ['distribution']
	},
	{
		id: 'holderRevenueChange_1d',
		header: '1d Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChange7dOver7d',
		header: '7d over 7d Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChange30dOver30d',
		header: '30d over 30d Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChange90dOver90d',
		header: '90d over 90d Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChange180dOver180d',
		header: '180d over 180d Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChange1yOver1y',
		header: '1y over 1y Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'holderRevenueChangeYtd',
		header: 'YTD Holder Revenue Change',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'distribution']
	},
	{
		id: 'feesChange_1d',
		header: '1d Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'fees24hChange7dAgo',
		header: '24h Fees vs 7d Ago',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'fees24hChange30dAgo',
		header: '24h Fees vs 30d Ago',
		group: 'fees',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'feesChange7dOver7d',
		header: '7d over 7d Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'feesChange30dOver30d',
		header: '30d over 30d Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'feesChange90dOver90d',
		header: '90d over 90d Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'feesChange180dOver180d',
		header: '180d over 180d Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'feesChange1yOver1y',
		header: '1y over 1y Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'feesChangeYtd',
		header: 'YTD Fees Change',
		group: 'fees',
		render: 'percent',
		tags: ['change']
	}
]

const revenueColumns: ColumnDictionaryItem[] = [
	{ id: 'revenue24h', header: '24h Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_7d', header: '7d Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_30d', header: '30d Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_90d', header: '90d Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_180d', header: '180d Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_1y', header: '1y Revenue', group: 'revenue', render: 'usd' },
	{ id: 'revenue_ytd', header: 'YTD Revenue', group: 'revenue', render: 'usd' },
	{
		id: 'average_revenue_1y',
		header: '1y Monthly Avg Revenue',
		group: 'revenue',
		render: 'usd',
		tags: ['derived']
	},
	{
		id: 'cumulativeRevenue',
		header: 'Cumulative Revenue',
		group: 'revenue',
		render: 'usd',
		tags: ['cumulative']
	},
	{
		id: 'revenueChange_1d',
		header: '1d Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenue24hChange7dAgo',
		header: '24h Revenue vs 7d Ago',
		group: 'revenue',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'revenue24hChange30dAgo',
		header: '24h Revenue vs 30d Ago',
		group: 'revenue',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'revenueChange7dOver7d',
		header: '7d over 7d Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenueChange30dOver30d',
		header: '30d over 30d Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenueChange90dOver90d',
		header: '90d over 90d Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenueChange180dOver180d',
		header: '180d over 180d Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenueChange1yOver1y',
		header: '1y over 1y Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'revenueChangeYtd',
		header: 'YTD Revenue Change',
		group: 'revenue',
		render: 'percent',
		tags: ['change']
	}
]

const earningsColumns: ColumnDictionaryItem[] = [
	{ id: 'earnings24h', header: '24h Earnings', group: 'earnings', render: 'usd' },
	{ id: 'earnings7d', header: '7d Earnings', group: 'earnings', render: 'usd' },
	{ id: 'earnings30d', header: '30d Earnings', group: 'earnings', render: 'usd' },
	{ id: 'earnings1y', header: '1y Earnings', group: 'earnings', render: 'usd' },
	{ id: 'emissions24h', header: '24h Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissions7d', header: '7d Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissions30d', header: '30d Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissions90d', header: '90d Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissions180d', header: '180d Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissions1y', header: '1y Emissions', group: 'earnings', render: 'usd' },
	{ id: 'emissionsYtd', header: 'YTD Emissions', group: 'earnings', render: 'usd' },
	{ id: 'cumulativeEmissions', header: 'Cumulative Emissions', group: 'earnings', render: 'usd', tags: ['cumulative'] },
	{ id: 'emissionsAnnualized1y', header: 'Annualized Emissions', group: 'earnings', render: 'usd', tags: ['derived'] },
	{ id: 'emissionsChange1d', header: '1d Emissions Change', group: 'earnings', render: 'percent', tags: ['change'] },
	{
		id: 'emissionsChange7dOver7d',
		header: '7d over 7d Emissions Change',
		group: 'earnings',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'emissionsChange30dOver30d',
		header: '30d over 30d Emissions Change',
		group: 'earnings',
		render: 'percent',
		tags: ['change']
	}
]

const perpsColumns: ColumnDictionaryItem[] = [
	{ id: 'perpsVolume24h', header: '24h Perps Volume', group: 'perps', render: 'usd' },
	{ id: 'perps_volume_7d', header: '7d Perps Volume', group: 'perps', render: 'usd' },
	{ id: 'perps_volume_30d', header: '30d Perps Volume', group: 'perps', render: 'usd' },
	{ id: 'perps_volume_90d', header: '90d Perps Volume', group: 'perps', render: 'usd' },
	{ id: 'perps_volume_1y', header: '1y Perps Volume', group: 'perps', render: 'usd' },
	{
		id: 'cumulativePerpsVolume',
		header: 'Cumulative Perps Volume',
		group: 'perps',
		render: 'usd',
		tags: ['cumulative']
	},
	{
		id: 'perps_volume_change_1d',
		header: '1d Perps Volume Change',
		group: 'perps',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'perpsVolume24hChange7dAgo',
		header: '24h Perps Volume vs 7d Ago',
		group: 'perps',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'perpsVolume24hChange30dAgo',
		header: '24h Perps Volume vs 30d Ago',
		group: 'perps',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'perpsVolumeChange7dOver7d',
		header: '7d over 7d Perps Volume Change',
		group: 'perps',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'perpsVolumeChange30dOver30d',
		header: '30d over 30d Perps Volume Change',
		group: 'perps',
		render: 'percent',
		tags: ['change']
	},
	{
		id: 'perps_volume_dominance_24h',
		header: 'Global 24h Perps Volume Share',
		group: 'perps',
		render: 'percent',
		description:
			'Protocol volume divided by global 24h perpetuals volume, including when the table is filtered to selected chains.',
		tags: ['dominance']
	},
	{ id: 'openInterest', header: 'Open Interest', group: 'perps', render: 'usd' }
]

const aggregatorsColumns: ColumnDictionaryItem[] = [
	{
		id: 'aggregators_volume_24h',
		header: '24h Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'aggregators_volume_7d',
		header: '7d Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'aggregators_volume_30d',
		header: '30d Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'aggregators_volume_90d',
		header: '90d Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'aggregators_volume_1y',
		header: '1y Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'cumulativeAggregatorVolume',
		header: 'Cumulative Aggregator Volume',
		group: 'aggregators',
		render: 'usd',
		tags: ['cumulative', 'specialized']
	},
	{
		id: 'aggregators_volume_change_1d',
		header: '1d Aggregator Volume Change',
		group: 'aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'aggregatorVolume24hChange7dAgo',
		header: '24h Aggregator Volume vs 7d Ago',
		group: 'aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'aggregatorVolume24hChange30dAgo',
		header: '24h Aggregator Volume vs 30d Ago',
		group: 'aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'aggregatorVolumeChange7dOver7d',
		header: '7d over 7d Aggregator Volume Change',
		group: 'aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'aggregatorVolumeChange30dOver30d',
		header: '30d over 30d Aggregator Volume Change',
		group: 'aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'aggregators_volume_dominance_24h',
		header: 'Global 24h Aggregator Share',
		group: 'aggregators',
		render: 'percent',
		description:
			'Protocol volume divided by global 24h DEX aggregator volume, including when the table is filtered to selected chains.',
		tags: ['specialized', 'dominance']
	},
	{
		id: 'aggregators_volume_marketShare7d',
		header: 'Global 7d Aggregator Share',
		group: 'aggregators',
		render: 'percent',
		description:
			'Protocol volume divided by global 7d DEX aggregator volume, including when the table is filtered to selected chains.',
		tags: ['specialized', 'dominance']
	}
]

const derivativesAggregatorsColumns: ColumnDictionaryItem[] = [
	{
		id: 'derivatives_aggregators_volume_24h',
		header: '24h Derivatives Aggregator Volume',
		group: 'derivatives-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'derivatives_aggregators_volume_7d',
		header: '7d Derivatives Aggregator Volume',
		group: 'derivatives-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'derivatives_aggregators_volume_30d',
		header: '30d Derivatives Aggregator Volume',
		group: 'derivatives-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'derivatives_aggregators_volume_change_1d',
		header: '1d Derivatives Aggregator Change',
		group: 'derivatives-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'derivativesAggregatorVolume24hChange7dAgo',
		header: '24h Derivatives Aggregator Volume vs 7d Ago',
		group: 'derivatives-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'derivativesAggregatorVolume24hChange30dAgo',
		header: '24h Derivatives Aggregator Volume vs 30d Ago',
		group: 'derivatives-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'derivativesAggregatorVolumeChange7dOver7d',
		header: '7d over 7d Derivatives Aggregator Change',
		group: 'derivatives-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'derivativesAggregatorVolumeChange30dOver30d',
		header: '30d over 30d Derivatives Aggregator Change',
		group: 'derivatives-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	}
]

const bridgeAggregatorsColumns: ColumnDictionaryItem[] = [
	{
		id: 'bridgeAggregatorVolume24h',
		header: '24h Bridge Aggregator Volume',
		group: 'bridge-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'bridgeAggregatorVolume7d',
		header: '7d Bridge Aggregator Volume',
		group: 'bridge-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'bridgeAggregatorVolume30d',
		header: '30d Bridge Aggregator Volume',
		group: 'bridge-aggregators',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'bridgeAggregatorVolumeChange1d',
		header: '1d Bridge Aggregator Volume Change',
		group: 'bridge-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'bridgeAggregatorVolume24hChange7dAgo',
		header: '24h Bridge Aggregator Volume vs 7d Ago',
		group: 'bridge-aggregators',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'bridgeAggregatorVolumeDominance24h',
		header: 'Current-Scope 24h Bridge Aggregator Share',
		group: 'bridge-aggregators',
		render: 'percent',
		description:
			'Protocol volume divided by 24h Bridge Aggregator volume for the selected chain scope; all-chain tables use the global total.',
		tags: ['dominance', 'specialized']
	}
]

const optionsColumns: ColumnDictionaryItem[] = [
	{
		id: 'options_volume_24h',
		header: '24h Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'options_volume_7d',
		header: '7d Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'options_volume_30d',
		header: '30d Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'options_volume_90d',
		header: '90d Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'options_volume_1y',
		header: '1y Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'cumulativeOptionsVolume',
		header: 'Cumulative Options Volume',
		group: 'options',
		render: 'usd',
		tags: ['cumulative', 'specialized']
	},
	{
		id: 'optionsNotionalVolume24h',
		header: '24h Options Notional Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'optionsNotionalVolume7d',
		header: '7d Options Notional Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'optionsNotionalVolume30d',
		header: '30d Options Notional Volume',
		group: 'options',
		render: 'usd',
		tags: ['specialized']
	},
	{
		id: 'options_volume_change_1d',
		header: '1d Options Volume Change',
		group: 'options',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'optionsVolume24hChange7dAgo',
		header: '24h Options Volume vs 7d Ago',
		group: 'options',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'optionsVolume24hChange30dAgo',
		header: '24h Options Volume vs 30d Ago',
		group: 'options',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'optionsVolumeChange7dOver7d',
		header: '7d over 7d Options Volume Change',
		group: 'options',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'optionsVolumeChange30dOver30d',
		header: '30d over 30d Options Volume Change',
		group: 'options',
		render: 'percent',
		tags: ['change', 'specialized']
	},
	{
		id: 'options_volume_dominance_24h',
		header: 'Global 24h Options Volume Share',
		group: 'options',
		render: 'percent',
		description:
			'Protocol volume divided by global 24h options volume, including when the table is filtered to selected chains.',
		tags: ['specialized', 'dominance']
	}
]

const ratioColumns: ColumnDictionaryItem[] = [
	{ id: 'mcap', header: 'Market Cap', group: 'ratios', render: 'usd' },
	{ id: 'fdv', header: 'FDV', group: 'ratios', render: 'usd' },
	{
		id: 'mcaptvl',
		header: 'Mcap / TVL',
		group: 'ratios',
		render: 'ratio',
		description: 'Market Cap divided by Total Value Locked'
	},
	{
		id: 'pf',
		header: 'P/F',
		group: 'ratios',
		render: 'ratio',
		description: 'Price to Fees ratio'
	},
	{
		id: 'ps',
		header: 'P/S',
		group: 'ratios',
		render: 'ratio',
		description: 'Price to Sales (Revenue) ratio'
	}
]

const METRIC_COLUMN_DICTIONARY: ColumnDictionaryItem[] = [
	...metaColumns,
	...tvlColumns,
	...volumeColumns,
	...feesColumns,
	...revenueColumns,
	...earningsColumns,
	...perpsColumns,
	...aggregatorsColumns,
	...bridgeAggregatorsColumns,
	...derivativesAggregatorsColumns,
	...optionsColumns,
	...ratioColumns
]

const filteredShareColumns: ColumnDictionaryItem[] = FILTERED_SHARE_METRIC_KEYS.map((metric) => {
	const source = METRIC_COLUMN_DICTIONARY.find((column) => column.id === metric)
	if (!source) throw new Error(`Missing source column for filtered share ${metric}`)
	return {
		id: getFilteredShareColumnId(metric),
		header: `${source.header} % of Filtered Rows`,
		group: source.group,
		render: 'percent',
		description:
			'Positive row value divided by the positive total after source filters and search; this is not global dominance.',
		tags: ['share']
	}
})

export const UNIFIED_TABLE_COLUMN_DICTIONARY: ColumnDictionaryItem[] = [
	...METRIC_COLUMN_DICTIONARY,
	...filteredShareColumns
]

export const COLUMN_DICTIONARY_BY_ID = new Map<string, ColumnDictionaryItem>(
	UNIFIED_TABLE_COLUMN_DICTIONARY.map((item) => [item.id, item])
)

const PROTOCOL_TABLE_METRIC_KEY_SET = new Set<string>(METRIC_COLUMN_DICTIONARY.map((item) => item.id))

export function isProtocolTableMetricKey(value: string): value is keyof ProtocolTableMetrics {
	return PROTOCOL_TABLE_METRIC_KEY_SET.has(value)
}
