import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import {
	defineTableQuery,
	enumField,
	nullableNumberField,
	shapeOrNullField,
	stringSetField,
	textField
} from '~/server/tablePages/tableQuery'
import {
	PROTOCOL_RANKING_SORT_KEYS,
	type ProtocolRankingActivityMetricKey,
	type ProtocolRankingSortKey
} from './sortAccessors'

/**
 * Browser-safe query contract for the paginated protocol rankings table.
 * The schema is shared verbatim by the client hook and every server entry
 * point, so both sides always compute the same canonical query and the same
 * signature. Public route params (`sort`, `order`, `search`, `minTvl`,
 * `maxTvl`, `tvlKeys`, `customFormula`, `customFormat`) are contracts.
 */

/** Rows in ISR props / rows per client fetch / API clamp ceiling (plan D6). */
export const PROTOCOL_RANKINGS_LIMITS = { initial: 50, page: 75, max: 100 } as const

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

export const protocolRankingQuery = defineTableQuery<ProtocolRankingQuery>({
	fields: {
		search: textField({ maxLength: 200, signatureValue: (value) => value.trim().toLowerCase() }),
		minTvl: nullableNumberField(),
		maxTvl: nullableNumberField(),
		sort: enumField([...PROTOCOL_RANKING_SORT_KEYS, 'custom'] as const, { nonStringFallback: 'tvl' }),
		order: enumField(['asc', 'desc'] as const, { fallback: 'desc' }),
		customSort: shapeOrNullField({
			formula: textField({ maxLength: 500 }),
			formatType: textField({ maxLength: 20, fallback: 'auto' })
		}),
		// Canonical signature form is the sorted set, independent of how the
		// caller ordered the keys (client-built query objects skip normalize).
		tvlKeys: { ...stringSetField({ allow: isProtocolListTvlKey }), signatureValue: (value) => [...value].sort() }
	},
	refine: (query) => {
		if (query.sort !== 'custom') return { ...query, customSort: null }
		return query.customSort?.formula ? query : null
	}
})

export function parseStructuredProtocolRankingQuery(value: unknown): ProtocolRankingQuery | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return protocolRankingQuery.normalize(value as Record<string, unknown>)
}
