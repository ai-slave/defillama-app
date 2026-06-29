import defs from '~/public/equities-definitions.json'
import { abbreviateNumber } from '~/utils'
import type { IEquitiesListCompanyRow } from './types'

export type EquityComparisonOperator = '>' | '>=' | '<' | '<='
export type EquityNumericOperator = EquityComparisonOperator | 'between'
export type EquityCategoricalMode = 'include' | 'exclude'
export type EquityFilterFormat = 'currency' | 'percent' | 'number'
export const EQUITY_FILTERS_QUERY_KEY = 'filters'
export type EquityFilterCategory =
	| 'company'
	| 'market'
	| 'valuation'
	| 'profitability'
	| 'holderReturn'
	| 'balanceSheet'

type NumericCompanyField = {
	[K in keyof IEquitiesListCompanyRow]-?: IEquitiesListCompanyRow[K] extends number | null ? K : never
}[keyof IEquitiesListCompanyRow]

export type EquityNumericFilterField = Extract<NumericCompanyField, keyof typeof defs>
export type EquityCategoricalFilterField = Extract<'country' | 'sector' | 'industry', keyof IEquitiesListCompanyRow>

type EquityFilterConfigBase<TId extends string> = {
	id: TId
	label: string
	description?: string
	category: EquityFilterCategory
}

type EquityNumericFilterConfigShape<TField extends EquityNumericFilterField = EquityNumericFilterField> =
	EquityFilterConfigBase<TField> & {
		type: 'numeric'
		field: TField
		format: EquityFilterFormat
	}

type EquityCategoricalFilterConfigShape<TField extends EquityCategoricalFilterField = EquityCategoricalFilterField> =
	EquityFilterConfigBase<TField> & {
		type: 'categorical'
		field: TField
	}

type EquityFilterConfigShape = EquityNumericFilterConfigShape | EquityCategoricalFilterConfigShape

export const EQUITY_FILTER_CATEGORIES = [
	{ key: 'company', label: 'Company' },
	{ key: 'market', label: 'Market' },
	{ key: 'valuation', label: 'Valuation' },
	{ key: 'profitability', label: 'Profitability' },
	{ key: 'holderReturn', label: 'Holder Return' },
	{ key: 'balanceSheet', label: 'Balance Sheet' }
] as const satisfies ReadonlyArray<{ key: EquityFilterCategory; label: string }>

const metric = <TField extends EquityNumericFilterField>(
	field: TField,
	category: EquityFilterCategory,
	format: EquityFilterFormat
): EquityNumericFilterConfigShape<TField> => ({
	id: field,
	type: 'numeric',
	field,
	category,
	format,
	label: defs[field].label,
	description: defs[field].description
})

const categorical = <TField extends EquityCategoricalFilterField>(
	field: TField,
	label: string
): EquityCategoricalFilterConfigShape<TField> => ({
	id: field,
	type: 'categorical',
	field,
	category: 'company',
	label
})

export const EQUITY_FILTER_CONFIGS = [
	categorical('country', 'Country'),
	categorical('sector', 'Sector'),
	categorical('industry', 'Industry'),
	metric('employeeCount', 'company', 'number'),
	metric('marketCap', 'market', 'currency'),
	metric('circulatingMarketCap', 'market', 'currency'),
	metric('enterpriseValue', 'market', 'currency'),
	metric('currentPrice', 'market', 'currency'),
	metric('fiftyTwoWeekHigh', 'market', 'currency'),
	metric('fiftyTwoWeekLow', 'market', 'currency'),
	metric('volume', 'market', 'number'),
	metric('marketCapChange1d', 'market', 'currency'),
	// `priceChange1d` (absolute $ daily move) is intentionally not exposed: it is redundant with
	// `priceChangePercentage1d` (% daily move) and `marketCapChange1d` ($ change), both already here.
	metric('priceChangePercentage1d', 'market', 'percent'),
	metric('priceChangePercentage7d', 'market', 'percent'),
	metric('priceChangePercentage1m', 'market', 'percent'),
	metric('trailingPE', 'valuation', 'number'),
	metric('priceToRevenue', 'valuation', 'number'),
	metric('priceToBook', 'valuation', 'number'),
	metric('enterpriseValueToEbitda', 'valuation', 'number'),
	metric('revenueTTM', 'profitability', 'currency'),
	metric('grossProfitTTM', 'profitability', 'currency'),
	metric('earningsTTM', 'profitability', 'currency'),
	metric('ebitdaTTM', 'profitability', 'currency'),
	metric('operatingProfitMarginTTM', 'profitability', 'percent'),
	metric('holdersYield', 'holderReturn', 'percent'),
	metric('dividendYield', 'holderReturn', 'percent'),
	metric('holdersRevenueTTM', 'holderReturn', 'currency'),
	metric('holderEarningsTTM', 'holderReturn', 'currency'),
	metric('dividendsTTM', 'holderReturn', 'currency'),
	metric('stockRepurchaseTTM', 'holderReturn', 'currency'),
	metric('stockIssuanceTTM', 'holderReturn', 'currency'),
	metric('stockBasedCompensationTTM', 'holderReturn', 'currency'),
	metric('cashAndCashEquivalents', 'balanceSheet', 'currency'),
	metric('totalAssets', 'balanceSheet', 'currency'),
	metric('totalLiabilities', 'balanceSheet', 'currency'),
	metric('totalShareholdersEquity', 'balanceSheet', 'currency'),
	metric('totalDebt', 'balanceSheet', 'currency'),
	metric('circulatingSupply', 'balanceSheet', 'number'),
	metric('totalSupply', 'balanceSheet', 'number')
] as const satisfies readonly EquityFilterConfigShape[]

export type EquityFilterConfig = (typeof EQUITY_FILTER_CONFIGS)[number]
export type EquityNumericFilterConfig = Extract<EquityFilterConfig, { type: 'numeric' }>
export type EquityCategoricalFilterConfig = Extract<EquityFilterConfig, { type: 'categorical' }>
export type EquityFilterId = EquityFilterConfig['id']
export type EquityNumericFilterId = EquityNumericFilterConfig['id']
export type EquityCategoricalFilterId = EquityCategoricalFilterConfig['id']

type NonEmptyArray<T> = [T, ...T[]]

export type EquityActiveNumericComparisonFilter = {
	kind: 'numeric'
	id: EquityNumericFilterId
	operator: EquityComparisonOperator
	value: number
}

export type EquityActiveNumericRangeFilter = {
	kind: 'numericRange'
	id: EquityNumericFilterId
	minValue: number
	maxValue: number
}

export type EquityActiveCategoricalFilter = {
	kind: 'categorical'
	id: EquityCategoricalFilterId
	mode: EquityCategoricalMode
	values: NonEmptyArray<string>
}

export type EquityActiveFilter =
	| EquityActiveNumericComparisonFilter
	| EquityActiveNumericRangeFilter
	| EquityActiveCategoricalFilter

export type EquityDraftNumericComparisonFilter = {
	kind: 'numeric'
	id: EquityNumericFilterId
	operator: EquityComparisonOperator
	value?: number
}

export type EquityDraftNumericRangeFilter = {
	kind: 'numericRange'
	id: EquityNumericFilterId
	minValue?: number
	maxValue?: number
}

export type EquityDraftNumericFilter = EquityDraftNumericComparisonFilter | EquityDraftNumericRangeFilter

export type EquityDraftCategoricalFilter = {
	kind: 'categorical'
	id: EquityCategoricalFilterId
	mode: EquityCategoricalMode
	values: string[]
}

export type EquityDraftFilter = EquityDraftNumericFilter | EquityDraftCategoricalFilter

const EQUITY_NUMERIC_FILTER_CONFIG_BY_ID: ReadonlyMap<EquityNumericFilterId, EquityNumericFilterConfig> = new Map(
	EQUITY_FILTER_CONFIGS.filter((config): config is EquityNumericFilterConfig => config.type === 'numeric').map(
		(config) => [config.id, config]
	)
)

const EQUITY_CATEGORICAL_FILTER_CONFIG_BY_ID: ReadonlyMap<EquityCategoricalFilterId, EquityCategoricalFilterConfig> =
	new Map(
		EQUITY_FILTER_CONFIGS.filter(
			(config): config is EquityCategoricalFilterConfig => config.type === 'categorical'
		).map((config) => [config.id, config])
	)

export function getEquityNumericFilterConfig(id: EquityNumericFilterId): EquityNumericFilterConfig {
	return EQUITY_NUMERIC_FILTER_CONFIG_BY_ID.get(id)!
}

export function getEquityCategoricalFilterConfig(id: EquityCategoricalFilterId): EquityCategoricalFilterConfig {
	return EQUITY_CATEGORICAL_FILTER_CONFIG_BY_ID.get(id)!
}

export function createDefaultEquityDraftFilter(config: EquityFilterConfig): EquityDraftFilter {
	if (config.type === 'categorical') {
		return { kind: 'categorical', id: config.id, mode: 'include', values: [] }
	}

	return { kind: 'numeric', id: config.id, operator: '>=' }
}

export function getEquityDraftNumericOperator(filter: EquityDraftNumericFilter): EquityNumericOperator {
	return filter.kind === 'numericRange' ? 'between' : filter.operator
}

function toNonEmptyArray<T>(values: T[]): NonEmptyArray<T> | null {
	return values.length > 0 ? (values as NonEmptyArray<T>) : null
}

export function parseEquityFilterNumber(input: string): number | undefined {
	const cleaned = input.trim().toLowerCase().replaceAll(',', '').replaceAll('$', '').replaceAll('%', '')
	if (!cleaned) return undefined

	const match = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([kmbt])?$/)
	if (!match) return undefined

	const base = Number(match[1])
	if (!Number.isFinite(base)) return undefined

	const suffix = match[2]
	if (suffix === 'k') return base * 1_000
	if (suffix === 'm') return base * 1_000_000
	if (suffix === 'b') return base * 1_000_000_000
	if (suffix === 't') return base * 1_000_000_000_000
	return base
}

function encodeEquityFilterQueryValue(value: string): string {
	return encodeURIComponent(value)
}

function decodeEquityFilterQueryValue(value: string): string | null {
	try {
		return decodeURIComponent(value)
	} catch {
		return null
	}
}

function comparisonOperatorToQueryOperator(operator: EquityComparisonOperator): string {
	if (operator === '>') return 'gt'
	if (operator === '>=') return 'gte'
	if (operator === '<') return 'lt'
	return 'lte'
}

function queryOperatorToComparisonOperator(operator: string): EquityComparisonOperator | null {
	if (operator === 'gt') return '>'
	if (operator === 'gte') return '>='
	if (operator === 'lt') return '<'
	if (operator === 'lte') return '<='
	return null
}

function parseEquityCategoricalFilterSegment(
	id: string,
	operator: string,
	rawValue: string
): EquityActiveCategoricalFilter | null {
	const config = EQUITY_CATEGORICAL_FILTER_CONFIG_BY_ID.get(id as EquityCategoricalFilterId)
	if (!config) return null
	if (operator !== 'in' && operator !== 'out') return null

	const values: string[] = []
	for (const rawPart of rawValue.split(',')) {
		const value = decodeEquityFilterQueryValue(rawPart)?.trim()
		if (value) values.push(value)
	}
	if (values.length === 0) return null

	return {
		kind: 'categorical',
		id: config.id,
		mode: operator === 'out' ? 'exclude' : 'include',
		values: values as NonEmptyArray<string>
	}
}

function parseEquityNumericFilterSegment(
	id: string,
	operator: string,
	rawValue: string
): EquityActiveNumericComparisonFilter | EquityActiveNumericRangeFilter | null {
	const config = EQUITY_NUMERIC_FILTER_CONFIG_BY_ID.get(id as EquityNumericFilterId)
	if (!config) return null

	if (operator === 'between') {
		const [rawMin, rawMax] = rawValue.split(',')
		if (!rawMin || !rawMax) return null
		const minValue = parseEquityFilterNumber(decodeEquityFilterQueryValue(rawMin) ?? '')
		const maxValue = parseEquityFilterNumber(decodeEquityFilterQueryValue(rawMax) ?? '')
		if (minValue === undefined || maxValue === undefined) return null

		return {
			kind: 'numericRange',
			id: config.id,
			minValue: Math.min(minValue, maxValue),
			maxValue: Math.max(minValue, maxValue)
		}
	}

	const comparisonOperator = queryOperatorToComparisonOperator(operator)
	if (!comparisonOperator) return null

	const value = parseEquityFilterNumber(decodeEquityFilterQueryValue(rawValue) ?? '')
	if (value === undefined) return null

	return { kind: 'numeric', id: config.id, operator: comparisonOperator, value }
}

export function parseEquityFiltersQuery(param: string | string[] | null | undefined): EquityActiveFilter[] {
	const values = Array.isArray(param) ? param : param ? [param] : []
	const filtersById = new Map<EquityFilterId, EquityActiveFilter>()

	for (const value of values) {
		for (const segment of value.split(';')) {
			if (!segment) continue
			const [id, operator, rawFilterValue, extra] = segment.split(':')
			if (!id || !operator || !rawFilterValue || extra !== undefined) continue

			const filter =
				parseEquityCategoricalFilterSegment(id, operator, rawFilterValue) ??
				parseEquityNumericFilterSegment(id, operator, rawFilterValue)
			if (filter) filtersById.set(filter.id, filter)
		}
	}

	return Array.from(filtersById.values())
}

export function serializeEquityFiltersQuery(filters: EquityActiveFilter[]): string | undefined {
	const segments: string[] = []

	for (const filter of filters) {
		if (filter.kind === 'categorical') {
			const operator = filter.mode === 'exclude' ? 'out' : 'in'
			segments.push(`${filter.id}:${operator}:${filter.values.map(encodeEquityFilterQueryValue).join(',')}`)
		} else if (filter.kind === 'numericRange') {
			segments.push(`${filter.id}:between:${filter.minValue},${filter.maxValue}`)
		} else {
			segments.push(`${filter.id}:${comparisonOperatorToQueryOperator(filter.operator)}:${filter.value}`)
		}
	}

	return segments.length > 0 ? segments.join(';') : undefined
}

export function draftEquityFilterToActive(filter: EquityDraftFilter): EquityActiveFilter | null {
	if (filter.kind === 'categorical') {
		const values = toNonEmptyArray(filter.values)
		return values ? { kind: 'categorical', id: filter.id, mode: filter.mode, values } : null
	}

	if (filter.kind === 'numericRange') {
		if (filter.minValue !== undefined && filter.maxValue !== undefined) {
			const minValue = Math.min(filter.minValue, filter.maxValue)
			const maxValue = Math.max(filter.minValue, filter.maxValue)
			return { kind: 'numericRange', id: filter.id, minValue, maxValue }
		}

		if (filter.minValue !== undefined) {
			return { kind: 'numeric', id: filter.id, operator: '>=', value: filter.minValue }
		}

		if (filter.maxValue !== undefined) {
			return { kind: 'numeric', id: filter.id, operator: '<=', value: filter.maxValue }
		}

		return null
	}

	return filter.value !== undefined
		? { kind: 'numeric', id: filter.id, operator: filter.operator, value: filter.value }
		: null
}

export function draftEquityFiltersToActive(filters: EquityDraftFilter[]): EquityActiveFilter[] {
	const activeFilters: EquityActiveFilter[] = []
	for (const filter of filters) {
		const activeFilter = draftEquityFilterToActive(filter)
		if (activeFilter) activeFilters.push(activeFilter)
	}
	return activeFilters
}

export function activeEquityFiltersToDraft(filters: EquityActiveFilter[]): EquityDraftFilter[] {
	// Numeric/range filters are immutable value objects and can be reused as-is; categorical
	// filters need a defensive copy of their mutable `values` array.
	return filters.map((filter) =>
		filter.kind === 'categorical' ? { ...filter, values: filter.values.slice() } : filter
	)
}

export function countActiveEquityFilters(filters: EquityActiveFilter[]): number {
	return filters.length
}

export function countDraftEquityFilters(filters: EquityDraftFilter[]): number {
	return draftEquityFiltersToActive(filters).length
}

export function formatEquityFilterValue(value: number, format: EquityFilterFormat): string {
	const symbol = format === 'currency' ? '$' : format === 'percent' ? '%' : undefined
	return abbreviateNumber(value, 2, symbol) ?? String(value)
}

function formatValues(values: readonly string[]): string {
	if (values.length <= 2) return values.join(', ')
	return `${values[0]}, ${values[1]} + ${values.length - 2}`
}

export function formatEquityActiveFilter(filter: EquityActiveFilter): string {
	if (filter.kind === 'categorical') {
		const config = getEquityCategoricalFilterConfig(filter.id)
		const mode = filter.mode === 'exclude' ? 'excludes' : 'is'
		return `${config.label} ${mode} ${formatValues(filter.values)}`
	}

	const config = getEquityNumericFilterConfig(filter.id)
	if (filter.kind === 'numericRange') {
		return `${config.label} ${formatEquityFilterValue(filter.minValue, config.format)} - ${formatEquityFilterValue(
			filter.maxValue,
			config.format
		)}`
	}

	return `${config.label} ${filter.operator} ${formatEquityFilterValue(filter.value, config.format)}`
}

function matchesNumericFilter(
	company: IEquitiesListCompanyRow,
	config: EquityNumericFilterConfig,
	filter: EquityActiveNumericComparisonFilter
) {
	const rowValue = company[config.field]
	if (rowValue == null) return false

	if (filter.operator === '>') return rowValue > filter.value
	if (filter.operator === '<') return rowValue < filter.value
	if (filter.operator === '<=') return rowValue <= filter.value
	return rowValue >= filter.value
}

function matchesNumericRangeFilter(
	company: IEquitiesListCompanyRow,
	config: EquityNumericFilterConfig,
	filter: EquityActiveNumericRangeFilter
) {
	const rowValue = company[config.field]
	if (rowValue == null) return false

	return rowValue >= filter.minValue && rowValue <= filter.maxValue
}

function matchesCategoricalFilter(
	company: IEquitiesListCompanyRow,
	config: EquityCategoricalFilterConfig,
	filter: EquityActiveCategoricalFilter,
	valueSet: Set<string>
) {
	const matches = valueSet.has(company[config.field])
	return filter.mode === 'exclude' ? !matches : matches
}

type PreparedEquityFilter =
	| {
			kind: 'numeric'
			config: EquityNumericFilterConfig
			filter: EquityActiveNumericComparisonFilter
	  }
	| {
			kind: 'numericRange'
			config: EquityNumericFilterConfig
			filter: EquityActiveNumericRangeFilter
	  }
	| {
			kind: 'categorical'
			config: EquityCategoricalFilterConfig
			filter: EquityActiveCategoricalFilter
			valueSet: Set<string>
	  }

function prepareEquityFilters(filters: EquityActiveFilter[]): PreparedEquityFilter[] {
	const preparedFilters: PreparedEquityFilter[] = []

	for (const filter of filters) {
		if (filter.kind === 'categorical') {
			preparedFilters.push({
				kind: 'categorical',
				config: getEquityCategoricalFilterConfig(filter.id),
				filter,
				valueSet: new Set(filter.values)
			})
		} else if (filter.kind === 'numericRange') {
			preparedFilters.push({ kind: 'numericRange', config: getEquityNumericFilterConfig(filter.id), filter })
		} else {
			preparedFilters.push({ kind: 'numeric', config: getEquityNumericFilterConfig(filter.id), filter })
		}
	}

	return preparedFilters
}

function matchesEquityFilter(company: IEquitiesListCompanyRow, preparedFilter: PreparedEquityFilter): boolean {
	if (preparedFilter.kind === 'categorical') {
		return matchesCategoricalFilter(company, preparedFilter.config, preparedFilter.filter, preparedFilter.valueSet)
	}

	if (preparedFilter.kind === 'numericRange') {
		return matchesNumericRangeFilter(company, preparedFilter.config, preparedFilter.filter)
	}

	return matchesNumericFilter(company, preparedFilter.config, preparedFilter.filter)
}

export function filterEquityCompanies(
	companies: IEquitiesListCompanyRow[],
	filters: EquityActiveFilter[]
): IEquitiesListCompanyRow[] {
	if (filters.length === 0) return companies

	const preparedFilters = prepareEquityFilters(filters)
	const filtered: IEquitiesListCompanyRow[] = []

	for (const company of companies) {
		let matches = true
		for (const filter of preparedFilters) {
			if (!matchesEquityFilter(company, filter)) {
				matches = false
				break
			}
		}
		if (matches) filtered.push(company)
	}

	return filtered
}
