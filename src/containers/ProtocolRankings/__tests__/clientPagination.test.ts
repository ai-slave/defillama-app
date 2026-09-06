import { describe, expect, test } from 'vitest'
import { createTablePagesReducer } from '~/hooks/useTablePages'
import { DEFAULT_PROTOCOL_RANKING_QUERY, protocolRankingQuery, type ProtocolRankingPage } from '../tableQuery'
import type { IProtocol } from '../types'

// Rankings-shaped acceptance tests for the kernel reducer: the page carries
// the wire `snapshot` field plus availableActivityMetrics, and rows dedupe on
// id ?? slug exactly as before the K2 cutover.
type RankingPage = ProtocolRankingPage<IProtocol> & { version: string }

const reducer = createTablePagesReducer<IProtocol, RankingPage>((row) => row.id ?? row.slug)
const row = (id: string) => ({ id, name: id, slug: id }) as IProtocol

const initialState = {
	rows: [row('ssr')],
	loadedQuerySignature: 'default',
	nextCursor: 'next',
	snapshot: 'v1',
	version: 'v1',
	total: 3,
	hasMore: true,
	availableActivityMetrics: [],
	isReplacing: false,
	isLoadingMore: false,
	error: null as 'replace' | 'append' | null,
	activeRequest: 0
}

function page(rows: Array<IProtocol>, overrides: Partial<RankingPage> = {}): RankingPage {
	return {
		rows,
		nextCursor: null,
		snapshot: 'v1',
		version: 'v1',
		total: rows.length,
		hasMore: false,
		availableActivityMetrics: [],
		...overrides
	}
}

describe('protocol ranking client request ordering', () => {
	test('retains rows during replacement and accepts only the latest response', () => {
		const firstStarted = reducer(initialState, { type: 'replace-start', request: 1 })
		expect(firstStarted.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(firstStarted.isReplacing).toBe(true)
		const secondStarted = reducer(firstStarted, { type: 'replace-start', request: 2 })
		const stale = reducer(secondStarted, {
			type: 'success',
			request: 1,
			mode: 'replace',
			page: page([row('stale')]),
			querySignature: 'first'
		})
		const latest = reducer(stale, {
			type: 'success',
			request: 2,
			mode: 'replace',
			page: page([row('latest')]),
			querySignature: 'second'
		})

		expect(stale.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(latest.rows.map((item) => item.id)).toEqual(['latest'])
		expect(latest.isReplacing).toBe(false)
	})

	test('dedupes appended rows on id ?? slug', () => {
		const loading = reducer(initialState, { type: 'append-start', request: 1 })
		const appended = reducer(loading, {
			type: 'success',
			request: 1,
			mode: 'append',
			page: page([row('ssr'), row('fresh')], { total: 3, hasMore: true, nextCursor: 'next-2' }),
			querySignature: 'default'
		})

		expect(appended.rows.map((item) => item.id)).toEqual(['ssr', 'fresh'])
		expect(appended.nextCursor).toBe('next-2')
	})

	test('accepts a refreshed static first page without remounting table state', () => {
		const refreshed = reducer(initialState, {
			type: 'source-change',
			request: 1,
			rows: [row('fresh-ssr')],
			page: {
				nextCursor: 'v2-next',
				snapshot: 'v2',
				version: 'v2',
				total: 1,
				hasMore: true,
				availableActivityMetrics: []
			},
			defaultQuerySignature: protocolRankingQuery.signature(DEFAULT_PROTOCOL_RANKING_QUERY)
		})

		expect(refreshed).toMatchObject({
			rows: [row('fresh-ssr')],
			snapshot: 'v2',
			nextCursor: 'v2-next',
			loadedQuerySignature: protocolRankingQuery.signature(DEFAULT_PROTOCOL_RANKING_QUERY)
		})
	})

	test('keeps an incremental failure idle until an explicit retry', () => {
		const loading = reducer(initialState, { type: 'append-start', request: 1 })
		const failed = reducer(loading, { type: 'failed', request: 1, mode: 'append' })

		expect(failed).toMatchObject({
			rows: initialState.rows,
			hasMore: true,
			isLoadingMore: false,
			error: 'append'
		})
	})
})
