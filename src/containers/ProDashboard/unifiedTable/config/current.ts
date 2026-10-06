import type { StoredColSpan } from '../../dashboardConfig/colSpan'
import type { DashboardCardHeight, DashboardItemBindings } from '../../types'
import type { CustomColumnDefinition, TableFilters, UnifiedRowHeaderType } from './types'

export const UNIFIED_TABLE_CONFIG_VERSION = 3 as const

type ProtocolTableFilterKey =
	| 'protocols'
	| 'categories'
	| 'excludedCategories'
	| 'oracles'
	| 'chains'
	| 'tvlMin'
	| 'tvlMax'
	| 'mcapMin'
	| 'mcapMax'
	| 'protocolAgeDaysMin'
	| 'protocolAgeDaysMax'
	| 'volumeDex24hMin'
	| 'volumeDex24hMax'
	| 'fees24hMin'
	| 'fees24hMax'
	| 'revenue24hMin'
	| 'revenue24hMax'
	| 'volume7dMin'
	| 'volume7dMax'
	| 'volume30dMin'
	| 'volume30dMax'
	| 'fees7dMin'
	| 'fees7dMax'
	| 'fees30dMin'
	| 'fees30dMax'
	| 'fees1yMin'
	| 'fees1yMax'
	| 'revenue7dMin'
	| 'revenue7dMax'
	| 'revenue30dMin'
	| 'revenue30dMax'
	| 'revenue1yMin'
	| 'revenue1yMax'
	| 'change1dMin'
	| 'change1dMax'
	| 'change7dMin'
	| 'change7dMax'
	| 'change1mMin'
	| 'change1mMax'
	| 'volumeChange1dMin'
	| 'volumeChange1dMax'
	| 'feesChange1dMin'
	| 'feesChange1dMax'
	| 'revenueChange1dMin'
	| 'revenueChange1dMax'
	| 'volumeDominance24hMin'
	| 'volumeDominance24hMax'
	| 'volumeMarketShare7dMin'
	| 'volumeMarketShare7dMax'
	| 'tvlShareMin'
	| 'tvlShareMax'
	| 'perpsVolumeDominance24hMin'
	| 'perpsVolumeDominance24hMax'
	| 'optionsVolumeDominance24hMin'
	| 'optionsVolumeDominance24hMax'
	| 'holderRevenue24hMin'
	| 'holderRevenue24hMax'
	| 'stablesMcapMin'
	| 'stablesMcapMax'
	| 'bridgedTvlMin'
	| 'bridgedTvlMax'
	| 'aggregatorsVolume24hMin'
	| 'aggregatorsVolume24hMax'
	| 'aggregatorsVolume7dMin'
	| 'aggregatorsVolume7dMax'
	| 'aggregatorsVolume30dMin'
	| 'aggregatorsVolume30dMax'
	| 'derivativesAggregatorsVolume24hMin'
	| 'derivativesAggregatorsVolume24hMax'
	| 'derivativesAggregatorsVolume7dMin'
	| 'derivativesAggregatorsVolume7dMax'
	| 'derivativesAggregatorsVolume30dMin'
	| 'derivativesAggregatorsVolume30dMax'
	| 'hasPerps'
	| 'hasOptions'
	| 'hasOpenInterest'
	| 'hasVolume'
	| 'hasFees'
	| 'hasRevenue'
	| 'hasMarketCap'
	| 'hasAggregators'
	| 'hasDerivativesAggregators'
	| 'hasBridgedTVL'
	| 'hasStables'
	| 'hasHolderRevenue'
	| 'hasMcapTVLRatio'
	| 'protocolCountMin'
	| 'protocolCountMax'
	| 'pfRatioMin'
	| 'pfRatioMax'

export type UnifiedTableFilters = Pick<TableFilters, ProtocolTableFilterKey> & {
	volume24hChange7dAgoMin?: number
	volume24hChange7dAgoMax?: number
	volume24hChange30dAgoMin?: number
	volume24hChange30dAgoMax?: number
	fees24hChange7dAgoMin?: number
	fees24hChange7dAgoMax?: number
	fees24hChange30dAgoMin?: number
	fees24hChange30dAgoMax?: number
	revenue24hChange7dAgoMin?: number
	revenue24hChange7dAgoMax?: number
	revenue24hChange30dAgoMin?: number
	revenue24hChange30dAgoMax?: number
	volumeChange7dOver7dMin?: number
	volumeChange7dOver7dMax?: number
	volumeChange30dOver30dMin?: number
	volumeChange30dOver30dMax?: number
	feesChange7dOver7dMin?: number
	feesChange7dOver7dMax?: number
	feesChange30dOver30dMin?: number
	feesChange30dOver30dMax?: number
	revenueChange7dOver7dMin?: number
	revenueChange7dOver7dMax?: number
	revenueChange30dOver30dMin?: number
	revenueChange30dOver30dMax?: number
}

export type UnifiedNumericTableFilterKey = {
	[K in keyof UnifiedTableFilters]-?: NonNullable<UnifiedTableFilters[K]> extends number ? K : never
}[keyof UnifiedTableFilters]

export type UnifiedBooleanTableFilterKey = {
	[K in keyof UnifiedTableFilters]-?: NonNullable<UnifiedTableFilters[K]> extends boolean ? K : never
}[keyof UnifiedTableFilters]

export type UnifiedListTableFilterKey = {
	[K in keyof UnifiedTableFilters]-?: NonNullable<UnifiedTableFilters[K]> extends Array<string> ? K : never
}[keyof UnifiedTableFilters]

export interface UnifiedTableConfig {
	id: string
	kind: 'unified-table'
	configVersion: 3
	strategy: 'protocols'
	rowHeaders: Array<UnifiedRowHeaderType>
	defaultSorting?: Array<{ id: string; desc: boolean }>
	params?: {
		chains?: Array<string>
		category?: string | null
	} | null
	filters?: UnifiedTableFilters
	columnOrder?: Array<string>
	columnVisibility?: Record<string, boolean>
	activePresetId?: string
	colSpan?: StoredColSpan
	height?: DashboardCardHeight
	bindings?: DashboardItemBindings
	customColumns?: Array<CustomColumnDefinition>
}
