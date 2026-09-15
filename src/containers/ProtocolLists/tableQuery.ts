import { canonicalQuerySignature } from '~/server/tablePages/tableQuery'
import type { CursorTablePage } from '~/server/tablePages/types'
import { parseExcludeParam, getSelectedChainFilters } from '~/utils/routerQuery'
import type { IRecentProtocolsPageData } from './types'
import type { applyExtraTvl } from './utils'

export type ProtocolListKind = 'recent' | 'airdrops'
export type ProtocolListQuery = Record<string, string | Array<string> | undefined>
export type RecentProtocolTableRow = ReturnType<typeof applyExtraTvl>[number]
export type ProtocolListPage = CursorTablePage<RecentProtocolTableRow> &
	Pick<IRecentProtocolsPageData, 'chainList' | 'categories'>
export type ProtocolListInitialProps = Pick<IRecentProtocolsPageData, 'chainList' | 'categories'> & {
	protocols: Array<RecentProtocolTableRow>
	protocolList: Omit<ProtocolListPage, 'rows' | 'chainList' | 'categories'>
	kind: ProtocolListKind
}
export const PROTOCOL_LIST_LIMITS = { initial: 50, page: 75, max: 100 }
export const PROTOCOL_LIST_SORT_KEYS = [
	'category',
	'tvl',
	'listedAt',
	'change_1d',
	'change_7d',
	'change_1m',
	'totalRaised',
	'undisclosedRounds'
]
const QUERY_KEYS = [
	'chain',
	'excludeChain',
	'category',
	'excludeCategory',
	'hideForks',
	'minTvl',
	'maxTvl',
	'search',
	'sort',
	'order',
	'tvlKeys'
]
export function protocolListQuery(raw: ProtocolListQuery): ProtocolListQuery {
	const query: ProtocolListQuery = {}
	for (const key of QUERY_KEYS) if (raw[key] !== undefined) query[key] = raw[key]
	if (query.sort === 'listedAt') delete query.sort
	if (query.order === 'desc') delete query.order
	if (query.search === '') delete query.search
	if (Array.isArray(query.tvlKeys) && query.tvlKeys.length === 0) delete query.tvlKeys
	return query
}
export function protocolListSignature(query: ProtocolListQuery): string {
	return canonicalQuerySignature(protocolListQuery(query), { exclude: [] })
}
export function protocolListSelection(query: ProtocolListQuery, chainList: Array<string>, categories: Array<string>) {
	const { chain, excludeChain, category, excludeCategory } = query
	const excludeChainSet = parseExcludeParam(excludeChain)
	let selectedChains = getSelectedChainFilters(chain, chainList)
	selectedChains = excludeChainSet.size > 0 ? selectedChains.filter((c) => !excludeChainSet.has(c)) : selectedChains

	const excludeCategorySet = parseExcludeParam(excludeCategory)
	let selectedCategories =
		categories.length > 0 && Object.hasOwn(query, 'category') && category === ''
			? []
			: category
				? typeof category === 'string'
					? [category]
					: category
				: categories

	selectedCategories =
		excludeCategorySet.size > 0
			? selectedCategories.filter((selectedCategory) => !excludeCategorySet.has(selectedCategory))
			: selectedCategories

	return { selectedChains, selectedCategories }
}
export function protocolListUrl(
	kind: ProtocolListKind,
	query: ProtocolListQuery,
	version: string,
	cursor: string | null,
	csv = false
) {
	const params = new URLSearchParams({ kind, snapshot: version })
	for (const [key, value] of Object.entries(protocolListQuery(query))) {
		if (Array.isArray(value)) for (const entry of value) params.append(key, entry)
		else if (value !== undefined) params.set(key, value)
	}
	if (cursor) params.set('cursor', cursor)
	if (csv) params.set('csv', 'true')
	return `/api/public/protocol-lists?${params}`
}
