import { describe, expect, it } from 'vitest'
import { DEFAULT_PROTOCOL_RANKING_QUERY, protocolRankingQuerySignature } from '../query'
import type { IProtocol } from '../types'
import { protocolRankingClientReducer, shouldReplaceProtocolRankingRows } from '../useProtocolRankingPages'

const row = (id: string) => ({ id, name: id, slug: id }) as IProtocol

const initialState = {
	rows: [row('ssr')],
	loadedQuerySignature: 'default',
	nextCursor: 'next',
	snapshot: 'v1',
	total: 3,
	hasMore: true,
	availableActivityMetrics: [],
	isReplacing: false,
	isLoadingMore: false,
	error: null,
	activeRequest: 0
}

describe('protocol ranking client request ordering', () => {
	it('hydrates the default SSR query without immediately replacing its rows', () => {
		expect(
			shouldReplaceProtocolRankingRows({
				enabled: true,
				querySignature: 'default',
				loadedQuerySignature: 'default'
			})
		).toBe(false)
		expect(
			shouldReplaceProtocolRankingRows({
				enabled: true,
				querySignature: 'persisted-fees',
				loadedQuerySignature: 'default'
			})
		).toBe(true)
		expect(
			shouldReplaceProtocolRankingRows({
				enabled: true,
				querySignature: 'default',
				loadedQuerySignature: 'persisted-fees'
			})
		).toBe(true)
	})
	it('retains rows during replacement and accepts only the latest response', () => {
		const firstStarted = protocolRankingClientReducer(initialState, { type: 'replace-start', request: 1 })
		expect(firstStarted.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(firstStarted.isReplacing).toBe(true)
		const secondStarted = protocolRankingClientReducer(firstStarted, { type: 'replace-start', request: 2 })
		const stale = protocolRankingClientReducer(secondStarted, {
			type: 'success',
			request: 1,
			mode: 'replace',
			page: { ...initialState, rows: [row('stale')] },
			querySignature: 'first'
		})
		const latest = protocolRankingClientReducer(stale, {
			type: 'success',
			request: 2,
			mode: 'replace',
			page: { ...initialState, rows: [row('latest')], nextCursor: null, hasMore: false },
			querySignature: 'second'
		})

		expect(stale.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(latest.rows.map((item) => item.id)).toEqual(['latest'])
		expect(latest.isReplacing).toBe(false)
	})

	it('accepts a refreshed static first page without remounting table state', () => {
		const refreshed = protocolRankingClientReducer(initialState, {
			type: 'source-change',
			request: 1,
			rows: [row('fresh-ssr')],
			page: {
				nextCursor: 'v2-next',
				snapshot: 'v2',
				total: 1,
				hasMore: true,
				availableActivityMetrics: []
			}
		})

		expect(refreshed).toMatchObject({
			rows: [row('fresh-ssr')],
			snapshot: 'v2',
			nextCursor: 'v2-next',
			loadedQuerySignature: protocolRankingQuerySignature(DEFAULT_PROTOCOL_RANKING_QUERY)
		})
	})

	it('keeps an incremental failure idle until an explicit retry', () => {
		const loading = protocolRankingClientReducer(initialState, { type: 'append-start', request: 1 })
		const failed = protocolRankingClientReducer(loading, { type: 'failed', request: 1, mode: 'append' })

		expect(failed).toMatchObject({
			rows: initialState.rows,
			hasMore: true,
			isLoadingMore: false,
			error: 'append'
		})
	})
})
