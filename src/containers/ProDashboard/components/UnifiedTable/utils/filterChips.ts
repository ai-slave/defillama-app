import type { TableFilters } from '~/containers/ProDashboard/types'
import { formatPercent, formatUsd, formatCompactNumber } from '~/utils/numberFormat'

export interface ActiveFilterChip {
	id: string
	label: string
	value?: string
	clearKeys: (keyof TableFilters)[]
}

const formatList = (values: string[]): string => {
	if (values.length <= 3) {
		return values.join(', ')
	}
	const remaining = values.length - 3
	return `${values.slice(0, 3).join(', ')} +${remaining}`
}

const formatFilterCurrency = (value: number) =>
	formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
const formatFilterNumber = (value: number) =>
	formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
const formatFilterPercent = (value: number) => formatPercent(value, { input: 'percent' })

const addRangeChip = (
	chips: ActiveFilterChip[],
	filters: TableFilters,
	minKey: keyof TableFilters,
	maxKey: keyof TableFilters,
	label: string,
	formatter: (value: number) => string
) => {
	const minValue = filters[minKey] as number | undefined
	const maxValue = filters[maxKey] as number | undefined
	const hasMin = typeof minValue === 'number'
	const hasMax = typeof maxValue === 'number'
	if (!hasMin && !hasMax) {
		return
	}
	let value: string
	if (hasMin && hasMax) {
		value = `${formatter(minValue!)} - ${formatter(maxValue!)}`
	} else if (hasMin) {
		value = `≥ ${formatter(minValue!)}`
	} else {
		value = `≤ ${formatter(maxValue!)}`
	}
	chips.push({
		id: `${String(minKey)}-${String(maxKey)}`,
		label,
		value,
		clearKeys: [minKey, maxKey]
	})
}

const addListChip = (chips: ActiveFilterChip[], filters: TableFilters, key: keyof TableFilters, label: string) => {
	const values = filters[key]
	if (!Array.isArray(values) || !values.length) {
		return
	}
	chips.push({
		id: String(key),
		label,
		value: formatList(values as string[]),
		clearKeys: [key]
	})
}

const addBooleanChip = (chips: ActiveFilterChip[], filters: TableFilters, key: keyof TableFilters, label: string) => {
	if (!filters[key]) {
		return
	}
	chips.push({ id: String(key), label, clearKeys: [key] })
}

export const getActiveFilterChips = (filters?: TableFilters): ActiveFilterChip[] => {
	if (!filters) {
		return []
	}
	const chips: ActiveFilterChip[] = []
	const clones: TableFilters = { ...filters }

	addListChip(chips, clones, 'protocols', 'Protocols')
	addListChip(chips, clones, 'categories', 'Categories')
	addListChip(chips, clones, 'excludedCategories', 'Exclude Categories')
	addListChip(chips, clones, 'chains', 'Chains')
	addListChip(chips, clones, 'oracles', 'Oracles')
	addListChip(chips, clones, 'poolTypes', 'Pool Types')

	addRangeChip(chips, clones, 'tvlMin', 'tvlMax', 'TVL', formatFilterCurrency)
	addRangeChip(chips, clones, 'mcapMin', 'mcapMax', 'Market Cap', formatFilterCurrency)
	addRangeChip(chips, clones, 'volumeDex24hMin', 'volumeDex24hMax', '24h Volume', formatFilterCurrency)
	addRangeChip(chips, clones, 'volume7dMin', 'volume7dMax', '7d Volume', formatFilterCurrency)
	addRangeChip(chips, clones, 'volume30dMin', 'volume30dMax', '30d Volume', formatFilterCurrency)
	addRangeChip(chips, clones, 'volumeChange1dMin', 'volumeChange1dMax', 'Volume Change 1d', formatFilterPercent)
	addRangeChip(chips, clones, 'volumeChange7dMin', 'volumeChange7dMax', 'Volume Change 7d', formatFilterPercent)
	addRangeChip(chips, clones, 'volumeChange1mMin', 'volumeChange1mMax', 'Volume Change 30d', formatFilterPercent)
	addRangeChip(chips, clones, 'fees24hMin', 'fees24hMax', '24h Fees', formatFilterCurrency)
	addRangeChip(chips, clones, 'fees7dMin', 'fees7dMax', '7d Fees', formatFilterCurrency)
	addRangeChip(chips, clones, 'fees30dMin', 'fees30dMax', '30d Fees', formatFilterCurrency)
	addRangeChip(chips, clones, 'fees1yMin', 'fees1yMax', '1y Fees', formatFilterCurrency)
	addRangeChip(chips, clones, 'feesChange1dMin', 'feesChange1dMax', 'Fees Change 1d', formatFilterPercent)
	addRangeChip(chips, clones, 'feesChange7dMin', 'feesChange7dMax', 'Fees Change 7d', formatFilterPercent)
	addRangeChip(chips, clones, 'feesChange1mMin', 'feesChange1mMax', 'Fees Change 30d', formatFilterPercent)
	addRangeChip(chips, clones, 'revenue24hMin', 'revenue24hMax', '24h Revenue', formatFilterCurrency)
	addRangeChip(chips, clones, 'revenue7dMin', 'revenue7dMax', '7d Revenue', formatFilterCurrency)
	addRangeChip(chips, clones, 'revenue30dMin', 'revenue30dMax', '30d Revenue', formatFilterCurrency)
	addRangeChip(chips, clones, 'revenue1yMin', 'revenue1yMax', '1y Revenue', formatFilterCurrency)
	addRangeChip(chips, clones, 'revenueChange1dMin', 'revenueChange1dMax', 'Revenue Change 1d', formatFilterPercent)
	addRangeChip(chips, clones, 'revenueChange7dMin', 'revenueChange7dMax', 'Revenue Change 7d', formatFilterPercent)
	addRangeChip(chips, clones, 'revenueChange1mMin', 'revenueChange1mMax', 'Revenue Change 30d', formatFilterPercent)
	addRangeChip(chips, clones, 'change1dMin', 'change1dMax', 'TVL Change 1d', formatFilterPercent)
	addRangeChip(chips, clones, 'change7dMin', 'change7dMax', 'TVL Change 7d', formatFilterPercent)
	addRangeChip(chips, clones, 'change1mMin', 'change1mMax', 'TVL Change 30d', formatFilterPercent)
	addRangeChip(chips, clones, 'apyMin', 'apyMax', 'APY', formatFilterPercent)
	addRangeChip(chips, clones, 'baseApyMin', 'baseApyMax', 'Base APY', formatFilterPercent)
	addRangeChip(chips, clones, 'pfRatioMin', 'pfRatioMax', 'P/F Ratio', formatFilterNumber)
	addRangeChip(chips, clones, 'protocolCountMin', 'protocolCountMax', 'Protocol Count', formatFilterNumber)
	addRangeChip(chips, clones, 'volumeDominance24hMin', 'volumeDominance24hMax', '24h Volume Share', formatFilterPercent)
	addRangeChip(
		chips,
		clones,
		'volumeMarketShare7dMin',
		'volumeMarketShare7dMax',
		'7d Volume Share',
		formatFilterPercent
	)
	addRangeChip(chips, clones, 'tvlShareMin', 'tvlShareMax', 'TVL Share', formatFilterPercent)
	addRangeChip(
		chips,
		clones,
		'perpsVolumeDominance24hMin',
		'perpsVolumeDominance24hMax',
		'Perps Volume Share 24h',
		formatFilterPercent
	)
	addRangeChip(
		chips,
		clones,
		'optionsVolumeDominance24hMin',
		'optionsVolumeDominance24hMax',
		'Options Volume Share 24h',
		formatFilterPercent
	)
	addRangeChip(chips, clones, 'holderRevenue24hMin', 'holderRevenue24hMax', 'Holder Revenue 24h', formatFilterCurrency)
	addRangeChip(
		chips,
		clones,
		'treasuryRevenue24hMin',
		'treasuryRevenue24hMax',
		'Treasury Revenue 24h',
		formatFilterCurrency
	)
	addRangeChip(chips, clones, 'stablesMcapMin', 'stablesMcapMax', 'Stablecoin Market Cap', formatFilterCurrency)
	addRangeChip(chips, clones, 'bridgedTvlMin', 'bridgedTvlMax', 'Bridged TVL', formatFilterCurrency)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume24hMin',
		'aggregatorsVolume24hMax',
		'Aggregator Volume 24h',
		formatFilterCurrency
	)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume7dMin',
		'aggregatorsVolume7dMax',
		'Aggregator Volume 7d',
		formatFilterCurrency
	)
	addRangeChip(
		chips,
		clones,
		'aggregatorsVolume30dMin',
		'aggregatorsVolume30dMax',
		'Aggregator Volume 30d',
		formatFilterCurrency
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume24hMin',
		'derivativesAggregatorsVolume24hMax',
		'Derivatives Aggregator Volume 24h',
		formatFilterCurrency
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume7dMin',
		'derivativesAggregatorsVolume7dMax',
		'Derivatives Aggregator Volume 7d',
		formatFilterCurrency
	)
	addRangeChip(
		chips,
		clones,
		'derivativesAggregatorsVolume30dMin',
		'derivativesAggregatorsVolume30dMax',
		'Derivatives Aggregator Volume 30d',
		formatFilterCurrency
	)

	addBooleanChip(chips, clones, 'stablesOnly', 'Stablecoin pools only')
	addBooleanChip(chips, clones, 'activeLending', 'Active lending pools')
	addBooleanChip(chips, clones, 'hasRewards', 'Rewards enabled')
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
	addBooleanChip(chips, clones, 'hasTreasuryRevenue', 'Has treasury revenue')
	addBooleanChip(chips, clones, 'hasMcapTVLRatio', 'Has MC/TVL ratio')

	return chips
}
