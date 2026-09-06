import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute, type ApiQuery } from '~/server/api/types'
import { TableCursorError } from '~/server/tablePages/cursorPage.server'
import { prepareTableRows } from '~/server/tablePages/preparedRows.server'
import { slug } from '~/utils'
import metadataCache from '~/utils/metadata'
import { getProtocolRankingRows, paginateProtocolRankingRows } from '../pagination.server'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	PROTOCOL_RANKINGS_LIMITS,
	protocolRankingQuery,
	type ProtocolRankingQuery
} from '../tableQuery'
import {
	getProtocolRankingsSnapshot,
	getRequestedProtocolRankingsSnapshot,
	isProtocolRankingSnapshotToken
} from './tableData.server'

function firstQueryValue(value: string | Array<string> | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function parseNullableNumber(value: string | undefined): number | null {
	if (value === undefined || value.trim() === '') return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

export function resolveProtocolRankingChain(value: string | undefined): string | null {
	if (!value || value.toLowerCase() === 'all') return 'All'
	return metadataCache.chainMetadata[slug(value)]?.name ?? null
}

export function parseProtocolRankingApiQuery(query: ApiQuery): {
	chain: string
	query: ProtocolRankingQuery
	cursor: string | null
	snapshot: string | null
	limit: number
} | null {
	const chain = resolveProtocolRankingChain(firstQueryValue(query.chain))
	if (!chain) return null
	const rawSort = firstQueryValue(query.sort) ?? DEFAULT_PROTOCOL_RANKING_QUERY.sort
	const rawLimit = Number(firstQueryValue(query.limit) ?? PROTOCOL_RANKINGS_LIMITS.page)
	const requestedSnapshot = firstQueryValue(query.snapshot) ?? null
	const cursor = firstQueryValue(query.cursor) ?? null
	if (requestedSnapshot && !isProtocolRankingSnapshotToken(requestedSnapshot)) return null
	if (cursor && cursor.length > 500) return null
	const normalizedQuery = protocolRankingQuery.normalize({
		search: firstQueryValue(query.search),
		minTvl: parseNullableNumber(firstQueryValue(query.minTvl)),
		maxTvl: parseNullableNumber(firstQueryValue(query.maxTvl)),
		sort: rawSort,
		order: firstQueryValue(query.order),
		customSort: {
			formula: firstQueryValue(query.customFormula),
			formatType: firstQueryValue(query.customFormat)
		},
		tvlKeys: (firstQueryValue(query.tvlKeys) ?? '').split(',')
	})
	if (!normalizedQuery) return null

	return {
		chain,
		query: normalizedQuery,
		cursor,
		snapshot: requestedSnapshot,
		limit: Number.isFinite(rawLimit) ? rawLimit : PROTOCOL_RANKINGS_LIMITS.page
	}
}

export async function loadProtocolRankingSnapshot(chain: string, requestedSnapshot: string | null) {
	return getRequestedProtocolRankingsSnapshot({
		chain,
		requestedSnapshot,
		createLatest: () =>
			getProtocolRankingsSnapshot({
				chain,
				chainMetadata: metadataCache.chainMetadata,
				protocolMetadata: metadataCache.protocolMetadata,
				categoriesAndTagsMetadata: metadataCache.categoriesAndTags
			})
	})
}

export function loadPreparedProtocolRankingRows(
	chain: string,
	snapshot: Parameters<typeof getProtocolRankingRows>[0],
	query: ProtocolRankingQuery
) {
	return prepareTableRows({
		namespace: 'protocol-rankings-prepared-rows',
		domain: chain,
		version: snapshot.snapshot,
		signature: protocolRankingQuery.signature(query),
		memory: { ttlMs: 5 * 60 * 1000, maxEntries: 32, maxBytes: 48 * 1024 * 1024 },
		prepare: () => getProtocolRankingRows(snapshot, query),
		measureBytes: (rows) =>
			rows.reduce((bytes, row) => bytes + 512 + (row.childProtocols?.length ?? 0) * 128, rows.length * 8)
	})
}

export const protocolRankingsApi = defineApiRoute({
	route: '/api/public/protocol-rankings',
	methods: ['GET'],
	cacheControl: 'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
	async handle(request) {
		const parsed = parseProtocolRankingApiQuery(request.query)
		if (!parsed) return { status: 400, body: { error: 'Invalid protocol ranking query' } }
		const { snapshot, mismatch } = await loadProtocolRankingSnapshot(parsed.chain, parsed.snapshot)
		if (mismatch) {
			return {
				status: 409,
				body: { error: 'snapshot_mismatch', snapshot: snapshot.snapshot }
			}
		}

		try {
			const querySignature = protocolRankingQuery.signature(parsed.query)
			const preparedRows = await loadPreparedProtocolRankingRows(parsed.chain, snapshot, parsed.query)
			const cacheKey = `${parsed.chain}:${snapshot.snapshot}:${querySignature}:${parsed.cursor ?? ''}:${parsed.limit}`
			const payload = await cachedJsonResult(
				'protocol-rankings-page',
				cacheKey,
				{ ttlMs: 5 * 60 * 1000, maxEntries: 192, maxBytes: 48 * 1024 * 1024 },
				() =>
					Promise.resolve(
						paginateProtocolRankingRows({
							snapshot,
							query: parsed.query,
							rows: preparedRows,
							cursor: parsed.cursor,
							limit: parsed.limit
						})
					)
			)
			return { status: 200, ...payload }
		} catch (error) {
			if (error instanceof TableCursorError) {
				return { status: 400, body: { error: 'invalid_cursor' } }
			}
			throw error
		}
	}
})
