import type { ParsedUrlQuery } from 'querystring'
import { parseExcludeParam, parseNumberQueryParam } from '~/utils/routerQuery'

export interface DecodeYieldsQueryContext {
	projectList?: Array<string>
	chainList?: Array<string>
	categoryList?: Array<string>
	evmChains?: Array<string>
	// v2 /yields pages emit `protocol=`; v1 surfaces (RWA, protocol-yields, token page)
	// keep the default `project=`.
	projectQueryKey?: string
	excludeProjectQueryKey?: string
}

export interface DecodedYieldsQuery {
	selectedProjects: string[]
	selectedChains: string[]
	selectedAttributes: string[]
	selectedCategories: string[]
	minTvl: number | null
	maxTvl: number | null
	minApy: number | null
	maxApy: number | null
}

type QueryUpdatePrimitive = string | number | boolean
type QueryUpdateValue = QueryUpdatePrimitive | QueryUpdatePrimitive[] | undefined

export function selectedSubsetQuery(selected: string[], all: string[]): string[] | undefined {
	// An empty vocabulary means page metadata is unavailable, not that the user
	// explicitly deselected every known option. Preserve explicit URL selections,
	// but let a selection-less request recover through the unfiltered dataset API.
	if (all.length === 0) return selected.length === 0 ? undefined : selected
	if (selected.length >= all.length) return undefined
	return selected.length === 0 ? ['__none__'] : selected
}

function toQueryArray(value: ParsedUrlQuery[string]): string[] {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? [...value] : []
}

function decodeQuerySelection(
	queryValue: ParsedUrlQuery[string],
	allValues?: string[],
	excludeValue?: ParsedUrlQuery[string]
): string[] {
	if (!allValues) return []

	let selectedValues: string[]
	if (queryValue) {
		if (typeof queryValue === 'string') {
			selectedValues = queryValue === 'All' ? [...allValues] : queryValue === 'None' ? [] : [queryValue]
		} else {
			selectedValues = [...queryValue]
		}
	} else {
		selectedValues = [...allValues]
	}

	const excludedSet = parseExcludeParam(excludeValue)
	if (excludedSet.size === 0) return selectedValues

	const filteredValues: string[] = []
	for (const value of selectedValues) {
		if (!excludedSet.has(value)) filteredValues.push(value)
	}
	return filteredValues
}

export function decodeYieldsQuery(
	query: ParsedUrlQuery,
	{
		projectList,
		chainList,
		categoryList,
		evmChains,
		projectQueryKey = 'project',
		excludeProjectQueryKey = 'excludeProject'
	}: DecodeYieldsQueryContext
): DecodedYieldsQuery {
	const evmChainsSet = new Set(evmChains ?? [])

	const selectedProjects = decodeQuerySelection(query[projectQueryKey], projectList, query[excludeProjectQueryKey])
	const selectedCategories = decodeQuerySelection(query.category, categoryList, query.excludeCategory)

	let selectedChains: string[] = []
	if (chainList) {
		const isEvmChain = (chain: string) => evmChainsSet.has(chain) || evmChainsSet.has(chain.toLowerCase())
		if (query.chain) {
			if (typeof query.chain === 'string') {
				if (query.chain === 'All') {
					selectedChains = [...chainList]
				} else if (query.chain === 'None') {
					selectedChains = []
				} else if (query.chain === 'ALL_EVM') {
					for (const chain of chainList) {
						if (isEvmChain(chain)) selectedChains.push(chain)
					}
				} else {
					selectedChains = [query.chain]
				}
			} else if (query.chain.includes('ALL_EVM')) {
				const selectedChainsSet = new Set<string>()
				for (const value of query.chain) {
					if (value !== 'ALL_EVM') selectedChainsSet.add(value)
				}
				for (const chain of chainList) {
					if (isEvmChain(chain)) selectedChainsSet.add(chain)
				}
				selectedChains = Array.from(selectedChainsSet)
			} else {
				selectedChains = [...query.chain]
			}
		} else {
			selectedChains = [...chainList]
		}

		const excludedChainSet = parseExcludeParam(query.excludeChain)
		if (excludedChainSet.size > 0) {
			const filteredChains: string[] = []
			for (const chain of selectedChains) {
				if (!excludedChainSet.has(chain)) filteredChains.push(chain)
			}
			selectedChains = filteredChains
		}
	}

	const selectedAttributes: string[] = []
	const excludedAttributeSet = parseExcludeParam(query.excludeAttribute)
	for (const attribute of toQueryArray(query.attribute)) {
		if (!excludedAttributeSet.has(attribute)) selectedAttributes.push(attribute)
	}
	return {
		selectedProjects,
		selectedChains,
		selectedAttributes,
		selectedCategories,
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
