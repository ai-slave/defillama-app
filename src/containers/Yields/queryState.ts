import type { ParsedUrlQuery } from 'node:querystring'
import { readSelectionFromQuery } from '~/components/Select/query'
import { parseExcludeParam, parseNumberQueryParam } from '~/utils/routerQuery'

export interface DecodeYieldsQueryContext {
	projectList?: Array<string>
	chainList?: Array<string>
	categoryList?: Array<string>
}

export interface DecodedYieldsQuery {
	selectedProjects: Array<string>
	selectedChains: Array<string>
	selectedAttributes: Array<string>
	selectedCategories: Array<string>
	minTvl: number | null
	maxTvl: number | null
	minApy: number | null
	maxApy: number | null
}

type QueryUpdatePrimitive = string | number | boolean
type QueryUpdateValue = QueryUpdatePrimitive | Array<QueryUpdatePrimitive> | undefined

function toQueryArray(value: ParsedUrlQuery[string]): Array<string> {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? [...value] : []
}

export function decodeYieldsQuery(
	query: ParsedUrlQuery,
	{ projectList, chainList, categoryList }: DecodeYieldsQueryContext
): DecodedYieldsQuery {
	const selectedAttributes: Array<string> = []
	const excludedAttributeSet = parseExcludeParam(query.excludeAttribute)
	for (const attribute of toQueryArray(query.attribute)) {
		if (!excludedAttributeSet.has(attribute)) selectedAttributes.push(attribute)
	}
	return {
		selectedProjects: projectList ? readSelectionFromQuery(query, 'protocol', 'excludeProtocol', projectList) : [],
		selectedChains: chainList ? readSelectionFromQuery(query, 'chain', 'excludeChain', chainList) : [],
		selectedAttributes,
		selectedCategories: categoryList ? readSelectionFromQuery(query, 'category', 'excludeCategory', categoryList) : [],
		minTvl: parseNumberQueryParam(query.minTvl),
		maxTvl: parseNumberQueryParam(query.maxTvl),
		minApy: parseNumberQueryParam(query.minApy),
		maxApy: parseNumberQueryParam(query.maxApy)
	}
}

export function shouldResetYieldsPoolPage(pathname: string | undefined) {
	return pathname === '/yields' || pathname === '/yields/loop' || pathname === '/protocol/yields/[protocol]'
}

export function resetYieldsPoolPageOnFilterChange<T extends Record<string, QueryUpdateValue>>(
	pathname: string | undefined,
	updates: T
): T & { page?: undefined } {
	return shouldResetYieldsPoolPage(pathname) ? { ...updates, page: undefined } : updates
}
