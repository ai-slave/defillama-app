import type {
	UnifiedBooleanTableFilterKey,
	UnifiedListTableFilterKey,
	UnifiedNumericTableFilterKey,
	UnifiedTableFilters
} from '~/containers/ProDashboard/unifiedTable/config/current'
import {
	formatPercent,
	formatUsd,
	formatCompactNumber,
	USD_LOWERCASE_MILLIONS_OPTIONS,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'

export interface ActiveFilterChip {
	id: string
	label: string
	value?: string
	clearKeys: Array<keyof UnifiedTableFilters>
}

const formatList = (values: Array<string>): string => {
	if (values.length <= 3) {
		return values.join(', ')
	}
	const remaining = values.length - 3
	return `${values.slice(0, 3).join(', ')} +${remaining}`
}

const addRangeChip = <TOptions>(
	chips: Array<ActiveFilterChip>,
	filters: UnifiedTableFilters,
	minKey: UnifiedNumericTableFilterKey,
	maxKey: UnifiedNumericTableFilterKey,
	label: string,
	formatter: (value: number, options: TOptions) => string,
	options: TOptions
) => {
	const minValue = filters[minKey]
	const maxValue = filters[maxKey]
	if (minValue === undefined && maxValue === undefined) {
		return
	}
	let value: string
	if (minValue !== undefined && maxValue !== undefined) {
		value = `${formatter(minValue, options)} - ${formatter(maxValue, options)}`
	} else if (minValue !== undefined) {
		value = `≥ ${formatter(minValue, options)}`
	} else if (maxValue !== undefined) {
		value = `≤ ${formatter(maxValue, options)}`
	} else {
		return
	}
	chips.push({
		id: `${String(minKey)}-${String(maxKey)}`,
		label,
		value,
		clearKeys: [minKey, maxKey]
	})
}

const addListChip = (
	chips: Array<ActiveFilterChip>,
	filters: UnifiedTableFilters,
	key: UnifiedListTableFilterKey,
	label: string
) => {
	const values = filters[key]
	if (!values?.length) {
		return
	}
	chips.push({
		id: String(key),
		label,
		value: formatList(values),
		clearKeys: [key]
	})
}

const addBooleanChip = (
	chips: Array<ActiveFilterChip>,
	filters: UnifiedTableFilters,
	key: UnifiedBooleanTableFilterKey,
	label: string
) => {
	if (!filters[key]) {
		return
	}
	chips.push({ id: String(key), label, clearKeys: [key] })
}

export const getActiveFilterChips = (filters?: UnifiedTableFilters): Array<ActiveFilterChip> => {
	if (!filters) {
		return []
	}
	const chips: Array<ActiveFilterChip> = []
	const clones: UnifiedTableFilters = { ...filters }

	addListChip(chips, clones, 'protocols', 'Protocols')
	addListChip(chips, clones, 'categories', 'Categories')
	addListChip(chips, clones, 'excludedCategories', 'Exclude Categories')
	addListChip(chips, clones, 'chains', 'Chains')
	addListChip(chips, clones, 'oracles', 'Oracles')

	addRangeChip(chips, clones, 'tvlMin', 'tvlMax', 'TVL', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'mcapMin', 'mcapMax', 'Market Cap', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(
		chips,
		clones,
		'protocolAgeDaysMin',
		'protocolAgeDaysMax',
		'Protocol Age (days)',
		formatCompactNumber,
		NUMBER_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'volumeDex24hMin',
		'volumeDex24hMax',
		'24h Volume',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(chips, clones, 'volume7dMin', 'volume7dMax', '7d Volume', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'volume30dMin', 'volume30dMax', '30d Volume', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'volumeChange1dMin', 'volumeChange1dMax', 'Volume Change 1d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(
		chips,
		clones,
		'volumeChange7dOver7dMin',
		'volumeChange7dOver7dMax',
		'Volume Change 7d over 7d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'volumeChange30dOver30dMin',
		'volumeChange30dOver30dMax',
		'Volume Change 30d over 30d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(chips, clones, 'fees24hMin', 'fees24hMax', '24h Fees', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'fees7dMin', 'fees7dMax', '7d Fees', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'fees30dMin', 'fees30dMax', '30d Fees', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'fees1yMin', 'fees1yMax', '1y Fees', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'feesChange1dMin', 'feesChange1dMax', 'Fees Change 1d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(
		chips,
		clones,
		'feesChange7dOver7dMin',
		'feesChange7dOver7dMax',
		'Fees Change 7d over 7d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'feesChange30dOver30dMin',
		'feesChange30dOver30dMax',
		'Fees Change 30d over 30d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'revenue24hMin',
		'revenue24hMax',
		'24h Revenue',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(chips, clones, 'revenue7dMin', 'revenue7dMax', '7d Revenue', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(
		chips,
		clones,
		'revenue30dMin',
		'revenue30dMax',
		'30d Revenue',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(chips, clones, 'revenue1yMin', 'revenue1yMax', '1y Revenue', formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	addRangeChip(chips, clones, 'revenueChange1dMin', 'revenueChange1dMax', 'Revenue Change 1d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(
		chips,
		clones,
		'revenueChange7dOver7dMin',
		'revenueChange7dOver7dMax',
		'Revenue Change 7d over 7d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'revenueChange30dOver30dMin',
		'revenueChange30dOver30dMax',
		'Revenue Change 30d over 30d',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(chips, clones, 'change1dMin', 'change1dMax', 'TVL Change 1d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(chips, clones, 'change7dMin', 'change7dMax', 'TVL Change 7d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(chips, clones, 'change1mMin', 'change1mMax', 'TVL Change 30d', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(
		chips,
		clones,
		'pfRatioMin',
		'pfRatioMax',
		'P/F Ratio',
		formatCompactNumber,
		NUMBER_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'protocolCountMin',
		'protocolCountMax',
		'Protocol Count',
		formatCompactNumber,
		NUMBER_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(chips, clones, 'volumeDominance24hMin', 'volumeDominance24hMax', '24h Volume Share', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(chips, clones, 'volumeMarketShare7dMin', 'volumeMarketShare7dMax', '7d Volume Share', formatPercent, {
		input: 'percent'
	} as const)
	addRangeChip(chips, clones, 'tvlShareMin', 'tvlShareMax', 'TVL Share', formatPercent, { input: 'percent' } as const)
	addRangeChip(
		chips,
		clones,
		'perpsVolumeDominance24hMin',
		'perpsVolumeDominance24hMax',
		'Perps Volume Share 24h',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'optionsVolumeDominance24hMin',
		'optionsVolumeDominance24hMax',
		'Options Volume Share 24h',
		formatPercent,
		{ input: 'percent' } as const
	)
	addRangeChip(
		chips,
		clones,
		'holderRevenue24hMin',
		'holderRevenue24hMax',
		'Holder Revenue 24h',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'stablesMcapMin',
		'stablesMcapMax',
		'Stablecoins market cap',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'bridgedTvlMin',
		'bridgedTvlMax',
		'Bridged TVL',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume24hMin',
		'aggregatorsVolume24hMax',
		'Aggregator Volume 24h',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume7dMin',
		'aggregatorsVolume7dMax',
		'Aggregator Volume 7d',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume30dMin',
		'aggregatorsVolume30dMax',
		'Aggregator Volume 30d',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume24hMin',
		'derivativesAggregatorsVolume24hMax',
		'Derivatives Aggregator Volume 24h',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume7dMin',
		'derivativesAggregatorsVolume7dMax',
		'Derivatives Aggregator Volume 7d',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume30dMin',
		'derivativesAggregatorsVolume30dMax',
		'Derivatives Aggregator Volume 30d',
		formatUsd,
		USD_LOWERCASE_MILLIONS_OPTIONS
	)

	addBooleanChip(chips, clones, 'hasPerps', 'Perps only')
	addBooleanChip(chips, clones, 'hasOptions', 'Options only')
	addBooleanChip(chips, clones, 'hasOpenInterest', 'Has open interest')
	addBooleanChip(chips, clones, 'hasVolume', 'Has volume (24h)')
	addBooleanChip(chips, clones, 'hasFees', 'Has fees (24h)')
	addBooleanChip(chips, clones, 'hasRevenue', 'Has revenue (24h)')
	addBooleanChip(chips, clones, 'hasMarketCap', 'Has market cap')
	addBooleanChip(chips, clones, 'hasAggregators', 'Has DEX aggregator volume')
	addBooleanChip(chips, clones, 'hasDerivativesAggregators', 'Has derivatives aggregator volume')
	addBooleanChip(chips, clones, 'hasBridgedTVL', 'Has bridged TVL')
	addBooleanChip(chips, clones, 'hasStables', 'Has stablecoins')
	addBooleanChip(chips, clones, 'hasHolderRevenue', 'Has holder revenue')
	addBooleanChip(chips, clones, 'hasMcapTVLRatio', 'Has MC/TVL ratio')

	return chips
}
