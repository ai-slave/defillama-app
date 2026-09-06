import type { ParsedUrlQuery } from 'node:querystring'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { TOKENS_HIDEABLE_COLUMN_SPECS, type TokensFilterCategory, type TokensFilterFormat } from './columnSpecs'
import { TOKENS_NUMERIC_FILTER_FIELDS, type TokensNumericFilterField } from './types'
import { parseNumericFiltersQueryParams, parseRankRangeQueryParams } from './utils'

export { TOKENS_FILTER_CATEGORIES, type TokensFilterCategory, type TokensFilterFormat } from './columnSpecs'

export type TokensFilterField = 'rank' | TokensNumericFilterField

export interface TokensFilterConfig {
	id: TokensFilterField
	label: string
	format: TokensFilterFormat
	category: TokensFilterCategory
}

export interface TokensActiveFilter {
	id: TokensFilterField
	min: number | null
	max: number | null
}

export const TOKENS_FILTER_CONFIGS: Array<TokensFilterConfig> = [
	{ id: 'rank', label: 'MCap Rank', format: 'number', category: 'market' },
	...TOKENS_HIDEABLE_COLUMN_SPECS.filter((spec) => spec.format != null && spec.filterCategory != null).map((spec) => ({
		id: spec.id as TokensNumericFilterField,
		label: spec.filterLabel ?? spec.header,
		format: spec.format!,
		category: spec.filterCategory!
	}))
]

const CONFIG_BY_ID = new Map(TOKENS_FILTER_CONFIGS.map((config) => [config.id, config]))

export function getTokensFilterConfig(id: TokensFilterField): TokensFilterConfig {
	return CONFIG_BY_ID.get(id)!
}

export function parseTokensFiltersFromQuery(query: ParsedUrlQuery): Array<TokensActiveFilter> {
	const filters: Array<TokensActiveFilter> = []
	const { rankFrom, rankTo } = parseRankRangeQueryParams(query)
	if (rankFrom != null || rankTo != null) filters.push({ id: 'rank', min: rankFrom, max: rankTo })
	for (const numericFilter of parseNumericFiltersQueryParams(query)) {
		filters.push({ id: numericFilter.field, min: numericFilter.min, max: numericFilter.max })
	}
	return filters
}

export function buildTokensFiltersQueryUpdate(filters: Array<TokensActiveFilter>): Record<string, string | undefined> {
	const update: Record<string, string | undefined> = { page: undefined, rankFrom: undefined, rankTo: undefined }
	for (const field of TOKENS_NUMERIC_FILTER_FIELDS) {
		update[`min_${field}`] = undefined
		update[`max_${field}`] = undefined
	}
	for (const filter of filters) {
		if (filter.min == null && filter.max == null) continue
		if (filter.id === 'rank') {
			update.rankFrom = filter.min != null ? String(filter.min) : undefined
			update.rankTo = filter.max != null ? String(filter.max) : undefined
		} else {
			update[`min_${filter.id}`] = filter.min != null ? String(filter.min) : undefined
			update[`max_${filter.id}`] = filter.max != null ? String(filter.max) : undefined
		}
	}
	return update
}

export interface TokensFilterSorting {
	id: string
	desc: boolean
}

const DEFAULT_TABLE_SORTING: TokensFilterSorting = { id: 'marketCap', desc: true }

export function getTokensFiltersDefaultSorting(filters: Array<TokensActiveFilter>): TokensFilterSorting | null {
	const last = filters[filters.length - 1]
	if (!last) return null
	if (last.id === 'rank') return { id: 'rank', desc: false }
	return { id: last.id, desc: !(last.min == null && last.max != null) }
}

function isSortingEqual(a: TokensFilterSorting | null | undefined, b: TokensFilterSorting | null | undefined): boolean {
	return a != null && b != null && a.id === b.id && a.desc === b.desc
}

export function shouldApplyTokensFilterSorting(
	currentSorting: TokensFilterSorting | undefined,
	previousFilters: Array<TokensActiveFilter>
): boolean {
	return (
		isSortingEqual(currentSorting, DEFAULT_TABLE_SORTING) ||
		isSortingEqual(currentSorting, getTokensFiltersDefaultSorting(previousFilters))
	)
}

function formatFilterValue(value: number, format: TokensFilterFormat): string {
	if (format === 'currency') return formatUsd(value, { compact: true })
	if (format === 'percent') return formatPercent(value, { input: 'percent' })
	return String(value)
}

export function formatTokensActiveFilter(filter: TokensActiveFilter): string {
	const config = getTokensFilterConfig(filter.id)
	const min = filter.min != null ? formatFilterValue(filter.min, config.format) : null
	const max = filter.max != null ? formatFilterValue(filter.max, config.format) : null
	if (min != null && max != null) return `${config.label}: ${min} - ${max}`
	if (min != null) return `${config.label} ≥ ${min}`
	return `${config.label} ≤ ${max}`
}
