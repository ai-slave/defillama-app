import { describe, expect, test } from 'vitest'
import { TableCursorError } from '~/server/tablePages/cursorPage.server'
import { getProtocolRankingRows, paginateProtocolRankingRows } from '../pagination.server'
import type { ProtocolRankingsSnapshotData } from '../server/tableData.server'
import { DEFAULT_PROTOCOL_RANKING_QUERY, PROTOCOL_RANKINGS_LIMITS, type ProtocolRankingQuery } from '../tableQuery'

function queryProtocolRankingSnapshot({
	snapshot: data,
	query,
	cursor = null,
	limit
}: {
	snapshot: ProtocolRankingsSnapshotData
	query: ProtocolRankingQuery
	cursor?: string | null
	limit?: number
}) {
	return paginateProtocolRankingRows({
		snapshot: data,
		query,
		prepared: getProtocolRankingRows(data, query),
		cursor,
		...(limit === undefined ? {} : { limit })
	})
}
import type { IProtocol } from '../types'

function row(id: string, name: string, tvl: number, fees30d = 0, children?: IProtocol['childProtocols']): IProtocol {
	return {
		id,
		name,
		slug: id,
		chains: ['Ethereum'],
		category: 'Dexs',
		tvl: { default: { tvl, tvlPrevDay: tvl, tvlPrevWeek: tvl, tvlPrevMonth: tvl } },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: false,
		fees: {
			total24h: 0,
			total7d: 0,
			total30d: fees30d,
			total1y: 0,
			annualized1y: 0,
			monthlyAverage1y: 0,
			totalAllTime: 0,
			pf: null
		},
		...(children ? { childProtocols: children } : {})
	}
}

function snapshot(version: string, protocols: Array<IProtocol>): ProtocolRankingsSnapshotData {
	return { snapshot: version, protocols, availableActivityMetrics: [] }
}

describe('protocol ranking pagination', () => {
	test('the static first page ships the top 50 by TVL and reports the remaining rows', () => {
		const protocols = Array.from({ length: 52 }, (_, index) => row(String(index), `Protocol ${index}`, index))
		const page = queryProtocolRankingSnapshot({
			snapshot: snapshot('abcdefghijklmnopqrst', protocols),
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			limit: PROTOCOL_RANKINGS_LIMITS.initial
		})

		expect([page.rows.length, page.rows[0]?.name, page.rows.at(-1)?.name]).toEqual([50, 'Protocol 51', 'Protocol 2'])
		expect([page.total, page.snapshot, page.hasMore]).toEqual([52, 'abcdefghijklmnopqrst', true])
		expect(page.nextCursor).toEqual(expect.any(String))
	})

	test('uses the protocol id as a deterministic tie-breaker without duplicates', () => {
		const data = snapshot('stable', [row('c', 'C', 10), row('a', 'A', 10), row('b', 'B', 10), row('d', 'D', 9)])
		const first = queryProtocolRankingSnapshot({
			snapshot: data,
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			limit: 2
		})
		const second = queryProtocolRankingSnapshot({
			snapshot: data,
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			cursor: first.nextCursor,
			limit: 2
		})

		expect(first.rows.map((item) => item.id)).toEqual(['a', 'b'])
		expect(second.rows.map((item) => item.id)).toEqual(['c', 'd'])
		// The last page ends the feed.
		expect([second.hasMore, second.nextCursor]).toEqual([false, null])
		expect(new Set([...first.rows, ...second.rows].map((item) => item.id)).size).toBe(4)
	})

	test('sorts and searches the complete snapshot, not the first page', () => {
		const protocols = Array.from({ length: 80 }, (_, index) =>
			row(
				`p-${index.toString().padStart(2, '0')}`,
				index === 73 ? 'Needle Protocol' : `Protocol ${index}`,
				100 - index,
				index
			)
		)
		const page = queryProtocolRankingSnapshot({
			snapshot: snapshot('global', protocols),
			query: { ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'needle', sort: 'fees_30d' },
			limit: 20
		})

		expect(page.total).toBe(1)
		expect(page.rows[0]?.id).toBe('p-73')
	})

	test('counts TVL chips over the searched rows, before the TVL range', () => {
		const data = snapshot('global', [
			row('swap-a', 'Swap A', 2_000_000),
			row('swap-b', 'Swap B', 1_500_000),
			row('swap-c', 'Swap C', 1_200_000),
			row('swap-d', 'Swap D', 200_000),
			row('lend-a', 'Lend A', 5_000_000_000),
			row('lend-b', 'Lend B', 5_000_000_000),
			row('lend-c', 'Lend C', 5_000_000_000)
		])
		const chips = (query: Partial<ProtocolRankingQuery>) =>
			queryProtocolRankingSnapshot({ snapshot: data, query: { ...DEFAULT_PROTOCOL_RANKING_QUERY, ...query } })
				.tvlQuickPicks

		expect(chips({})).toEqual([1_000_000, 10_000_000, 100_000_000, 1_000_000_000])
		expect(chips({ search: 'swap' })).toEqual([1_000_000])
		expect(chips({ search: 'swap', minTvl: 1_000_000 })).toEqual([1_000_000])
	})

	test('rejects a cursor from a different snapshot or query', () => {
		const first = queryProtocolRankingSnapshot({
			snapshot: snapshot('old', [row('a', 'A', 2), row('b', 'B', 1)]),
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			limit: 1
		})

		expect(() =>
			queryProtocolRankingSnapshot({
				snapshot: snapshot('new', [row('a', 'A', 2), row('b', 'B', 1)]),
				query: DEFAULT_PROTOCOL_RANKING_QUERY,
				cursor: first.nextCursor,
				limit: 1
			})
		).toThrow(TableCursorError)
		expect(() =>
			queryProtocolRankingSnapshot({
				snapshot: snapshot('old', [row('a', 'A', 2), row('b', 'B', 1)]),
				query: { ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'a' },
				cursor: first.nextCursor,
				limit: 1
			})
		).toThrow(TableCursorError)
	})

	test('rejects a cursor whose cached-order offset was altered', () => {
		const data = snapshot('stable', [row('a', 'A', 2), row('b', 'B', 1)])
		const first = queryProtocolRankingSnapshot({
			snapshot: data,
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			limit: 1
		})
		const payload = JSON.parse(Buffer.from(first.nextCursor ?? '', 'base64url').toString('utf8'))
		payload.offset = 2
		const altered = Buffer.from(JSON.stringify(payload)).toString('base64url')

		expect(() =>
			queryProtocolRankingSnapshot({
				snapshot: data,
				query: DEFAULT_PROTOCOL_RANKING_QUERY,
				cursor: altered,
				limit: 1
			})
		).toThrow(TableCursorError)
	})

	test('ships sorted children with their parent and narrows children for a child-name search', () => {
		const alpha = row('alpha', 'Alpha Child', 4)
		const beta = row('beta', 'Beta Child', 3)
		const parent = row('parent', 'Parent', 7, 0, [beta, alpha])
		const normal = queryProtocolRankingSnapshot({
			snapshot: snapshot('children', [parent]),
			query: DEFAULT_PROTOCOL_RANKING_QUERY
		})
		const searched = queryProtocolRankingSnapshot({
			snapshot: snapshot('children', [parent]),
			query: { ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'beta' }
		})

		expect(normal.rows[0]?.childProtocols?.map((child) => child.id)).toEqual(['alpha', 'beta'])
		expect(searched.rows[0]?.id).toBe('parent')
		expect(searched.rows[0]?.childProtocols?.map((child) => child.id)).toEqual(['beta'])
	})

	test('uses a compact query hash in cursors for long custom formulas', () => {
		const formula = `${'1+'.repeat(249)}1`
		const page = queryProtocolRankingSnapshot({
			snapshot: snapshot('custom', [row('a', 'A', 2), row('b', 'B', 1)]),
			query: {
				...DEFAULT_PROTOCOL_RANKING_QUERY,
				sort: 'custom',
				customSort: { formula, formatType: 'number' }
			},
			limit: 1
		})

		expect(formula).toHaveLength(499)
		expect(page.nextCursor?.length).toBeLessThan(250)
	})
})
