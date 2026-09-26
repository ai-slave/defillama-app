import type { ParsedUrlQuery } from 'node:querystring'
import { readSelectionFromQuery } from '~/components/Select/query'

interface YieldsQuestionFilters {
	chains?: Array<string>
	projects?: Array<string>
	tokens?: Array<string>
	categories?: Array<string>
	attributes?: Array<string>
	minTvl?: number
	maxTvl?: number
	minApy?: number
	maxApy?: number
}

interface YieldsFilterOptions {
	chainList: Array<string>
	projectList: Array<string>
	categoryList: Array<string>
}

export function getYieldsQuestionContext(
	query: ParsedUrlQuery,
	{ chainList, projectList, categoryList }: YieldsFilterOptions
): { filters: YieldsQuestionFilters } | null {
	const filters: YieldsQuestionFilters = {}
	let hasFilters = false

	// A picker selection only narrows the question when it leaves options out.
	const chains = readSelectionFromQuery(query, 'chain', 'excludeChain', chainList)
	if (chains.length < chainList.length) {
		filters.chains = chains
		hasFilters = true
	}
	const projects = readSelectionFromQuery(query, 'protocol', 'excludeProtocol', projectList)
	if (projects.length < projectList.length) {
		filters.projects = projects
		hasFilters = true
	}
	const categories = readSelectionFromQuery(query, 'category', 'excludeCategory', categoryList)
	if (categories.length < categoryList.length) {
		filters.categories = categories
		hasFilters = true
	}
	if (query.token) {
		const tokens = Array.isArray(query.token) ? query.token : [query.token]
		if (tokens.length > 0) {
			filters.tokens = tokens
			hasFilters = true
		}
	}
	if (query.attribute) {
		const attributes = Array.isArray(query.attribute) ? query.attribute : [query.attribute]
		if (attributes.length > 0) {
			filters.attributes = attributes
			hasFilters = true
		}
	}
	if (query.minTvl) {
		filters.minTvl = Number(query.minTvl)
		hasFilters = true
	}
	if (query.maxTvl) {
		filters.maxTvl = Number(query.maxTvl)
		hasFilters = true
	}
	if (query.minApy) {
		filters.minApy = Number(query.minApy)
		hasFilters = true
	}
	if (query.maxApy) {
		filters.maxApy = Number(query.maxApy)
		hasFilters = true
	}

	if (!hasFilters) return null
	return { filters }
}
