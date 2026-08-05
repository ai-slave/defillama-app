import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseStructuredProtocolRankingQuery } from '../query'
import type { ProtocolRankingsCanonicalSnapshot } from '../snapshot.server'
import type { IProtocol } from '../types'

const mocks = vi.hoisted(() => ({
	getRequestedProtocolRankingsSnapshot: vi.fn(),
	getProtocolRankingsSnapshot: vi.fn(),
	isProtocolRankingSnapshotToken: (value: string) => /^[A-Za-z0-9_-]{20}$/.test(value)
}))

vi.mock('../snapshot.server', () => mocks)

import { parseProtocolRankingApiQuery, protocolRankingsApi } from '../server/api'

function row(id: string, name: string, tvl: number): IProtocol {
	return {
		id,
		name,
		slug: id,
		chains: ['Ethereum'],
		category: null,
		tvl: { default: { tvl, tvlPrevDay: tvl, tvlPrevWeek: tvl, tvlPrevMonth: tvl } },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: false
	}
}

const canonical = {
	chain: 'All',
	createdAt: 1,
	snapshot: 'abcdefghijklmnopqrst',
	protocols: [row('a', 'Alpha', 2), row('b', 'Beta', 1)],
	availableActivityMetrics: [],
	source: {}
} as ProtocolRankingsCanonicalSnapshot

describe('protocol rankings API', () => {
	beforeEach(() => {
		mocks.getRequestedProtocolRankingsSnapshot.mockReset()
		mocks.getProtocolRankingsSnapshot.mockReset()
	})

	it('normalizes GET and structured export queries through the same rules', () => {
		const parsedGet = parseProtocolRankingApiQuery({
			chain: 'All',
			search: 'stable',
			minTvl: '10',
			maxTvl: '100',
			sort: 'custom',
			order: 'asc',
			customFormula: 'fees_30d / tvl',
			customFormat: 'number',
			tvlKeys: 'staking,not-a-tvl-key,pool2,staking'
		})
		const parsedExport = parseStructuredProtocolRankingQuery({
			search: 'stable',
			minTvl: 10,
			maxTvl: 100,
			sort: 'custom',
			order: 'asc',
			customSort: { formula: 'fees_30d / tvl', formatType: 'number' },
			tvlKeys: ['staking', 'not-a-tvl-key', 'pool2', 'staking']
		})

		expect(parsedGet?.query).toEqual(parsedExport)
	})

	it('returns a snapshot mismatch instead of mixing refreshed rows with an old cursor', async () => {
		mocks.getRequestedProtocolRankingsSnapshot.mockResolvedValue({ snapshot: canonical, mismatch: true })
		const result = await protocolRankingsApi.handle({
			method: 'GET',
			url: '/api/public/protocol-rankings?chain=All&snapshot=uvwxyzABCDEFGHIJKLMN',
			query: { chain: 'All', snapshot: 'uvwxyzABCDEFGHIJKLMN' },
			headers: {}
		})

		expect(result).toEqual({
			status: 409,
			body: { error: 'snapshot_mismatch', snapshot: 'abcdefghijklmnopqrst' }
		})
	})

	it('returns only the requested page from the cached canonical rows', async () => {
		mocks.getRequestedProtocolRankingsSnapshot.mockResolvedValue({ snapshot: canonical, mismatch: false })
		const result = await protocolRankingsApi.handle({
			method: 'GET',
			url: '/api/public/protocol-rankings?chain=All&limit=1',
			query: { chain: 'All', limit: '1' },
			headers: {}
		})

		expect('serializedJson' in result && JSON.parse(result.serializedJson)).toMatchObject({
			rows: [{ id: 'a' }],
			total: 2,
			hasMore: true,
			snapshot: 'abcdefghijklmnopqrst'
		})
	})

	it('prepares a sorted query once and slices later cursor pages from that order', async () => {
		const pagedSnapshot = { ...canonical, snapshot: 'abcdefghijklmnopqr99' }
		mocks.getRequestedProtocolRankingsSnapshot.mockResolvedValue({ snapshot: pagedSnapshot, mismatch: false })
		const toSorted = vi.spyOn(Array.prototype, 'toSorted')
		const first = await protocolRankingsApi.handle({
			method: 'GET',
			url: '/api/public/protocol-rankings?chain=All&limit=1',
			query: { chain: 'All', limit: '1' },
			headers: {}
		})
		const firstPage = 'serializedJson' in first ? JSON.parse(first.serializedJson) : null
		const second = await protocolRankingsApi.handle({
			method: 'GET',
			url: `/api/public/protocol-rankings?chain=All&limit=1&cursor=${firstPage.nextCursor}`,
			query: { chain: 'All', limit: '1', cursor: firstPage.nextCursor },
			headers: {}
		})

		expect('serializedJson' in second && JSON.parse(second.serializedJson).rows[0].id).toBe('b')
		expect(toSorted).toHaveBeenCalledTimes(1)
		toSorted.mockRestore()
	})

	it('rejects malformed snapshot tokens before touching the snapshot cache', async () => {
		const result = await protocolRankingsApi.handle({
			method: 'GET',
			url: '/api/public/protocol-rankings?chain=All&snapshot=not-valid',
			query: { chain: 'All', snapshot: 'not-valid' },
			headers: {}
		})

		expect(result).toEqual({ status: 400, body: { error: 'Invalid protocol ranking query' } })
		expect(mocks.getRequestedProtocolRankingsSnapshot).not.toHaveBeenCalled()
	})

	it('rejects oversized cursors before decoding them', async () => {
		const cursor = 'a'.repeat(501)
		const result = await protocolRankingsApi.handle({
			method: 'GET',
			url: `/api/public/protocol-rankings?chain=All&cursor=${cursor}`,
			query: { chain: 'All', cursor },
			headers: {}
		})

		expect(result).toEqual({ status: 400, body: { error: 'Invalid protocol ranking query' } })
		expect(mocks.getRequestedProtocolRankingsSnapshot).not.toHaveBeenCalled()
	})
})
