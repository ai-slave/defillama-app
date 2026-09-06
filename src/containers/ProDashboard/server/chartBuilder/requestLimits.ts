import { queryIntClamped, validateQueryList } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'

const MAX_CHAINS = 50
const MAX_CATEGORIES = 25
const MAX_FILTER_LENGTH = 200
const MAX_CATEGORY_CHAIN_REQUESTS = 160

export function getChartBuilderSeriesLimit(query: ApiQuery, fallback: number): number {
	return queryIntClamped(query, 'limit', fallback, 1, 20)
}

interface ChartBuilderFilters {
	chains?: ReadonlyArray<string>
	categories?: ReadonlyArray<string>
	chainCategories?: ReadonlyArray<string>
	protocolCategories?: ReadonlyArray<string>
	protocol?: string | undefined
}

export function validateChartBuilderFilters({
	chains = [],
	categories = [],
	chainCategories = [],
	protocolCategories = [],
	protocol
}: ChartBuilderFilters): string | null {
	const listError =
		validateQueryList('chains', chains, { maxItems: MAX_CHAINS, maxItemLength: MAX_FILTER_LENGTH }) ??
		validateQueryList('categories', categories, {
			maxItems: MAX_CATEGORIES,
			maxItemLength: MAX_FILTER_LENGTH
		}) ??
		validateQueryList('chainCategories', chainCategories, {
			maxItems: MAX_CATEGORIES,
			maxItemLength: MAX_FILTER_LENGTH
		}) ??
		validateQueryList('protocolCategories', protocolCategories, {
			maxItems: MAX_CATEGORIES,
			maxItemLength: MAX_FILTER_LENGTH
		})
	if (listError) return listError
	if (protocol !== undefined && protocol.length > MAX_FILTER_LENGTH) {
		return `protocol must be at most ${MAX_FILTER_LENGTH} characters`
	}
	return null
}

export function validateCategoryChainFanOut(
	categories: ReadonlyArray<string>,
	chains: ReadonlyArray<string>
): string | null {
	return categories.length * Math.max(chains.length, 1) > MAX_CATEGORY_CHAIN_REQUESTS
		? `categories and chains may require at most ${MAX_CATEGORY_CHAIN_REQUESTS} upstream requests`
		: null
}
