import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import {
	PROTOCOL_RANKING_SORT_KEYS,
	type ProtocolRankingActivityMetricKey,
	type ProtocolRankingSortKey
} from './sortAccessors'

export { PROTOCOL_RANKING_SORT_KEYS }
export type { ProtocolRankingActivityMetricKey, ProtocolRankingSortKey }

export const PROTOCOL_RANKINGS_INITIAL_LIMIT = 20
export const PROTOCOL_RANKINGS_PAGE_LIMIT = 75
export const PROTOCOL_RANKINGS_MAX_LIMIT = 100

export type ProtocolRankingOrder = 'asc' | 'desc'

export type ProtocolRankingQuery = {
	search: string
	minTvl: number | null
	maxTvl: number | null
	sort: ProtocolRankingSortKey | 'custom'
	order: ProtocolRankingOrder
	customSort: { formula: string; formatType: string } | null
	tvlKeys: string[]
}

export type ProtocolRankingPage<Row> = {
	rows: Row[]
	nextCursor: string | null
	snapshot: string
	total: number
	hasMore: boolean
	availableActivityMetrics: ProtocolRankingActivityMetricKey[]
}

export type ProtocolRankingInitialPage = Omit<ProtocolRankingPage<never>, 'rows'>

const SORT_KEYS = new Set<string>(PROTOCOL_RANKING_SORT_KEYS)

export const DEFAULT_PROTOCOL_RANKING_QUERY: ProtocolRankingQuery = {
	search: '',
	minTvl: null,
	maxTvl: null,
	sort: 'tvl',
	order: 'desc',
	customSort: null,
	tvlKeys: []
}

export function isProtocolRankingSortKey(value: string): value is ProtocolRankingSortKey {
	return SORT_KEYS.has(value)
}

function nullableNumber(value: unknown): number | null | undefined {
	if (value === null || value === undefined) return null
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseCustomSort(value: unknown): ProtocolRankingQuery['customSort'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const custom = value as Record<string, unknown>
	return {
		formula: typeof custom.formula === 'string' ? custom.formula.slice(0, 500) : '',
		formatType: typeof custom.formatType === 'string' ? custom.formatType.slice(0, 20) : 'auto'
	}
}

export function normalizeProtocolRankingQuery(query: Record<string, unknown>): ProtocolRankingQuery | null {
	const sort = typeof query.sort === 'string' ? query.sort : DEFAULT_PROTOCOL_RANKING_QUERY.sort
	if (sort !== 'custom' && !isProtocolRankingSortKey(sort)) return null
	const minTvl = nullableNumber(query.minTvl)
	const maxTvl = nullableNumber(query.maxTvl)
	if (minTvl === undefined || maxTvl === undefined) return null
	const customSort = parseCustomSort(query.customSort)
	if (sort === 'custom' && !customSort?.formula) return null
	const tvlKeys = Array.isArray(query.tvlKeys)
		? query.tvlKeys.filter((key): key is string => typeof key === 'string' && isProtocolListTvlKey(key))
		: []
	return {
		search: typeof query.search === 'string' ? query.search.slice(0, 200) : '',
		minTvl,
		maxTvl,
		sort,
		order: query.order === 'asc' ? 'asc' : 'desc',
		customSort: sort === 'custom' ? customSort : null,
		tvlKeys: [...new Set(tvlKeys)].sort()
	}
}

export function parseStructuredProtocolRankingQuery(value: unknown): ProtocolRankingQuery | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return normalizeProtocolRankingQuery(value as Record<string, unknown>)
}

export function protocolRankingQuerySignature(query: ProtocolRankingQuery): string {
	return JSON.stringify({
		search: query.search.trim().toLowerCase(),
		minTvl: query.minTvl,
		maxTvl: query.maxTvl,
		sort: query.sort,
		order: query.order,
		customSort: query.customSort,
		tvlKeys: [...query.tvlKeys].sort()
	})
}
