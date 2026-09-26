import { readSelectionFromQuery } from '~/components/Select/query'
import { parseNumberQueryParam, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { StablecoinPegMechanism, StablecoinPegType } from './api.types'
import type { FormattedStablecoinAsset } from './utils'

type QueryParamInput = string | Array<string> | undefined | null

type StablecoinFilterableItem = Pick<
	FormattedStablecoinAsset,
	'pegDeviation' | 'yieldBearing' | 'pegMechanism' | 'pegType' | 'mcap'
>

export type StablecoinFilterOption = {
	name: string
	key: string
	filterFn: (item: StablecoinFilterableItem) => boolean
	help: string
}

export type StablecoinFilterQuery = {
	attribute?: QueryParamInput
	excludeAttribute?: QueryParamInput
	pegtype?: QueryParamInput
	excludePegtype?: QueryParamInput
	backing?: QueryParamInput
	excludeBacking?: QueryParamInput
	minMcap?: QueryParamInput
	maxMcap?: QueryParamInput
}

export type StablecoinFilterState = {
	selectedAttributes: Array<string>
	selectedPegTypes: Array<string>
	selectedBackings: Array<string>
	minMcap: number | null
	maxMcap: number | null
	hasActiveFilters: boolean
}

export const stablecoinAttributeOptions: Array<StablecoinFilterOption> = [
	{
		name: 'Stable',
		key: 'STABLE',
		filterFn: (item) => typeof item.pegDeviation === 'number' && Math.abs(item.pegDeviation) <= 10,
		help: 'Show stablecoins within 10% of peg'
	},
	{
		name: 'Yield Bearing',
		key: 'YIELDBEARING',
		filterFn: (item) => !!item.yieldBearing,
		help: 'Show yield-bearing stablecoins'
	},
	{
		name: 'Unknown',
		key: 'UNKNOWN',
		filterFn: (item) => typeof item.pegDeviation !== 'number',
		help: 'Show stablecoins with no deviation data'
	},
	{
		name: 'Depegged',
		key: 'DEPEGGED',
		// Yield-bearing assets intentionally render '-' for peg deviation columns,
		// so exclude them from the "Depegged" filter to avoid showing "no peg data" rows.
		filterFn: (item) =>
			!item.yieldBearing &&
			typeof item.pegDeviation === 'number' &&
			Number.isFinite(item.pegDeviation) &&
			Math.abs(item.pegDeviation) > 10,
		help: 'Show stablecoins depegged by more than 10%'
	}
]

const backingOptionLabels = {
	'fiat-backed': { key: 'FIATSTABLES', name: 'Fiat', help: 'Show stablecoins backed by fiat' },
	'crypto-backed': { key: 'CRYPTOSTABLES', name: 'Crypto', help: 'Show stablecoins backed by crypto' },
	algorithmic: { key: 'ALGOSTABLES', name: 'Algorithmic', help: 'Show algorithmic stablecoins' }
} satisfies Record<StablecoinPegMechanism, { key: string; name: string; help: string }>

// Typed by the API's unions so every backing and peg type has an option: a row without one would disappear as soon as
// any filter is on.
export const stablecoinBackingOptions: Array<StablecoinFilterOption> = []
for (const mechanism in backingOptionLabels) {
	const pegMechanism = mechanism as StablecoinPegMechanism
	stablecoinBackingOptions.push({
		...backingOptionLabels[pegMechanism],
		filterFn: (item) => item.pegMechanism === pegMechanism
	})
}

const pegTypeOptionLabels = {
	peggedUSD: { name: 'USD', help: 'Show stablecoins pegged to USD' },
	peggedEUR: { name: 'EUR', help: 'Show stablecoins pegged to EUR' },
	peggedSGD: { name: 'SGD', help: 'Show stablecoins pegged to SGD' },
	peggedJPY: { name: 'JPY', help: 'Show stablecoins pegged to JPY' },
	peggedCNY: { name: 'CNY', help: 'Show stablecoins pegged to CNY' },
	peggedUAH: { name: 'UAH', help: 'Show stablecoins pegged to UAH' },
	peggedARS: { name: 'ARS', help: 'Show stablecoins pegged to ARS' },
	peggedGBP: { name: 'GBP', help: 'Show stablecoins pegged to GBP' },
	peggedVAR: { name: 'Variable', help: 'Show stablecoins with a variable or floating peg' },
	peggedCAD: { name: 'CAD', help: 'Show stablecoins pegged to CAD' },
	peggedAUD: { name: 'AUD', help: 'Show stablecoins pegged to AUD' },
	peggedTRY: { name: 'TRY', help: 'Show stablecoins pegged to Turkish Lira' },
	peggedCHF: { name: 'CHF', help: 'Show stablecoins pegged to Swiss Franc' },
	peggedCOP: { name: 'COP', help: 'Show stablecoins pegged to Colombian Peso' },
	peggedREAL: { name: 'REAL', help: 'Show stablecoins pegged to Brazilian Real' },
	peggedRUB: { name: 'RUB', help: 'Show stablecoins pegged to Russian Ruble' },
	peggedPHP: { name: 'PHP', help: 'Show stablecoins pegged to Philippine Peso' },
	peggedMXN: { name: 'MXN', help: 'Show stablecoins pegged to Mexican Peso' },
	peggedKES: { name: 'KES', help: 'Show stablecoins pegged to Kenyan Shilling' },
	peggedZAR: { name: 'ZAR', help: 'Show stablecoins pegged to South African Rand' },
	peggedNGN: { name: 'NGN', help: 'Show stablecoins pegged to Nigerian Naira' },
	peggedXOF: { name: 'XOF', help: 'Show stablecoins pegged to West African CFA Franc' },
	peggedGHS: { name: 'GHS', help: 'Show stablecoins pegged to Ghanaian Cedi' },
	peggedCLP: { name: 'CLP', help: 'Show stablecoins pegged to Chilean Peso' },
	peggedPEN: { name: 'PEN', help: 'Show stablecoins pegged to Peruvian Sol' },
	peggedMYR: { name: 'MYR', help: 'Show stablecoins pegged to Malaysian Ringgit' },
	peggedKRW: { name: 'KRW', help: 'Show stablecoins pegged to Korean Won' },
	peggedHKD: { name: 'HKD', help: 'Show stablecoins pegged to Hong Kong Dollar' }
} satisfies Record<StablecoinPegType, { name: string; help: string }>

export const stablecoinPegTypeOptions: Array<StablecoinFilterOption> = []
for (const peg in pegTypeOptionLabels) {
	const pegType = peg as StablecoinPegType
	stablecoinPegTypeOptions.push({
		...pegTypeOptionLabels[pegType],
		key: pegType.toUpperCase(),
		filterFn: (item) => item.pegType === pegType
	})
}

const filterQueryKeys: Array<keyof StablecoinFilterQuery> = [
	'attribute',
	'excludeAttribute',
	'pegtype',
	'excludePegtype',
	'backing',
	'excludeBacking',
	'minMcap',
	'maxMcap'
]

const hasQueryValue = (value: QueryParamInput): boolean => {
	if (value == null) return false
	if (Array.isArray(value)) return value.length > 0
	return value !== ''
}

const getFilterOptionMap = (options: ReadonlyArray<StablecoinFilterOption>): Map<string, StablecoinFilterOption> => {
	const map = new Map<string, StablecoinFilterOption>()
	for (const option of options) {
		map.set(option.key, option)
	}
	return map
}

/**
 * Reads a selection with the shared picker rules. Stablecoin links also match option keys case-insensitively and
 * accept two old typos, so values are mapped to option keys (and `none`/`all` to the sentinels) first.
 */
export const resolveSelectedStablecoinFilterKeys = ({
	includeParam,
	excludeParam,
	options
}: {
	includeParam: QueryParamInput
	excludeParam: QueryParamInput
	options: ReadonlyArray<StablecoinFilterOption>
}): Array<string> => {
	const keyByLower = new Map<string, string>([
		['none', 'None'],
		['all', 'All'],
		['deppeged', 'DEPEGGED'],
		['unknow', 'UNKNOWN']
	])
	for (const option of options) keyByLower.set(option.key.toLowerCase(), option.key)
	const toKeys = (param: QueryParamInput) =>
		toNonEmptyArrayParam(param).map((raw) => keyByLower.get(raw.toLowerCase()) ?? raw)
	return readSelectionFromQuery(
		{ values: toKeys(includeParam), excludeValues: toKeys(excludeParam) },
		'values',
		'excludeValues',
		options.map((option) => option.key)
	)
}

export const resolveStablecoinFilterState = (query: StablecoinFilterQuery = {}): StablecoinFilterState => ({
	selectedAttributes: resolveSelectedStablecoinFilterKeys({
		includeParam: query.attribute,
		excludeParam: query.excludeAttribute,
		options: stablecoinAttributeOptions
	}),
	selectedPegTypes: resolveSelectedStablecoinFilterKeys({
		includeParam: query.pegtype,
		excludeParam: query.excludePegtype,
		options: stablecoinPegTypeOptions
	}),
	selectedBackings: resolveSelectedStablecoinFilterKeys({
		includeParam: query.backing,
		excludeParam: query.excludeBacking,
		options: stablecoinBackingOptions
	}),
	minMcap: parseNumberQueryParam(query.minMcap),
	maxMcap: parseNumberQueryParam(query.maxMcap),
	hasActiveFilters: filterQueryKeys.some((key) => hasQueryValue(query[key]))
})

const stablecoinAttributeOptionsByKey = getFilterOptionMap(stablecoinAttributeOptions)
const stablecoinPegTypeOptionsByKey = getFilterOptionMap(stablecoinPegTypeOptions)
const stablecoinBackingOptionsByKey = getFilterOptionMap(stablecoinBackingOptions)

const matchesAnySelectedOption = (
	asset: StablecoinFilterableItem,
	selectedKeys: Array<string>,
	optionsByKey: Map<string, StablecoinFilterOption>
): boolean => {
	if (selectedKeys.length === 0) return false
	for (const key of selectedKeys) {
		const option = optionsByKey.get(key)
		if (option?.filterFn(asset)) return true
	}
	return false
}

export const matchesStablecoinFilters = (asset: StablecoinFilterableItem, state: StablecoinFilterState): boolean => {
	if (!state.hasActiveFilters) return true
	if (!matchesAnySelectedOption(asset, state.selectedAttributes, stablecoinAttributeOptionsByKey)) return false
	if (!matchesAnySelectedOption(asset, state.selectedPegTypes, stablecoinPegTypeOptionsByKey)) return false
	if (!matchesAnySelectedOption(asset, state.selectedBackings, stablecoinBackingOptionsByKey)) return false

	if (state.minMcap != null || state.maxMcap != null) {
		if (asset.mcap == null) return false
		if (state.minMcap != null && asset.mcap < state.minMcap) return false
		if (state.maxMcap != null && asset.mcap > state.maxMcap) return false
	}
	return true
}

export const filterStablecoinAssets = <T extends StablecoinFilterableItem>(
	assets: Array<T>,
	state: StablecoinFilterState
): Array<T> => {
	if (!state.hasActiveFilters) return assets
	const filtered: Array<T> = []
	for (const asset of assets) {
		if (matchesStablecoinFilters(asset, state)) filtered.push(asset)
	}
	return filtered
}
