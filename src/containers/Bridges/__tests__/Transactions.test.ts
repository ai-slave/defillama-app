import { beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: fetchJsonMock
}))

import {
	createBridgeTransactionCollector,
	createBridgeTransactionSearchIndex,
	fetchTransactions,
	matchesBridgeTransactionSearch,
	toBridgeTransactionCsvRow,
	type BridgeTransaction
} from '../Transactions'

const unix = (iso: string) => Date.parse(iso) / 1000

const transaction = (hash: string, timestamp: number): BridgeTransaction => ({
	tx_hash: hash,
	ts: new Date(timestamp * 1000).toISOString(),
	tx_block: timestamp,
	tx_from: '0xfrom',
	tx_to: '0xto',
	token: 'USDC',
	amount: '1',
	is_deposit: true,
	is_usd_volume: false,
	chain: 'Ethereum',
	bridge_name: 'Test Bridge',
	usd_value: '1.25'
})

const args = {
	bridge: { id: 1, displayName: 'Test Bridge' },
	startDate: '2026-01-01',
	endDate: '2026-01-31'
} satisfies Parameters<typeof fetchTransactions>[0]

const range = {
	startTimestamp: unix('2026-01-01T00:00:00.000Z'),
	endTimestamp: unix('2026-02-01T00:00:00.000Z')
}

describe('bridge transaction loading', () => {
	beforeEach(() => fetchJsonMock.mockReset())

	test('uses the opaque cursor and preserves same-second events with repeated hashes', async () => {
		const boundary = unix('2026-01-20T03:47:25.000Z')
		fetchJsonMock
			.mockResolvedValueOnce({
				rows: [
					{ ...transaction('repeated', boundary + 1), token: 'FIRST' },
					transaction('page-one-boundary', boundary)
				],
				hasMore: true,
				nextCursor: 'cursor-page-2'
			})
			.mockResolvedValueOnce({
				rows: [{ ...transaction('repeated', boundary), token: 'SECOND' }, transaction('page-two-boundary', boundary)],
				hasMore: false
			})

		const result = await fetchTransactions(args)

		const query = `starttimestamp=${range.startTimestamp}&endtimestamp=${range.endTimestamp}&limit=10000`
		expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
			`/api/public/bridges/transactions/1?${query}`,
			`/api/public/bridges/transactions/1?${query}&cursor=cursor-page-2`
		])
		expect(result.rows.map((row) => [row.tx_hash, row.token])).toEqual([
			['repeated', 'FIRST'],
			['page-one-boundary', 'USDC'],
			['repeated', 'SECOND'],
			['page-two-boundary', 'USDC']
		])
		expect(result.stats?.total).toBe(4)
		expect(result.truncated).toBe(false)
	})

	test('normalizes typed USD strings once while preserving null and measured zero', () => {
		const collector = createBridgeTransactionCollector(range)
		collector.addPage([
			{ ...transaction('missing', range.startTimestamp + 4), usd_value: null },
			{ ...transaction('zero', range.startTimestamp + 3), usd_value: '0' },
			{ ...transaction('positive', range.startTimestamp + 2), usd_value: '3.5' },
			{
				...transaction('negative', range.startTimestamp + 1),
				chain: 'Arbitrum',
				is_deposit: false,
				usd_value: '-2.5'
			}
		])

		const result = collector.finish(false)

		expect(result.rows.map((row) => row.usd_value)).toEqual([null, 0, 3.5, -2.5])
		expect(result.stats).toEqual({
			total: 4,
			deposits: 3,
			withdrawals: 1,
			depositVolume: 3.5,
			withdrawalVolume: -2.5,
			totalVolume: 1,
			unknownValueCount: 1,
			uniqueChains: 2
		})
	})

	test('sorts once after an order anomaly and retains equal-time encounter order', () => {
		const collector = createBridgeTransactionCollector(range)
		const timestamp = range.startTimestamp + 100
		collector.addPage([
			transaction('first', timestamp),
			transaction('equal-time', timestamp),
			transaction('older', timestamp - 1),
			transaction('newer-anomaly', timestamp + 1)
		])

		expect(collector.finish(false).rows.map((row) => row.tx_hash)).toEqual([
			'newer-anomaly',
			'first',
			'equal-time',
			'older'
		])
	})

	test('returns a successful empty result without truncation', async () => {
		fetchJsonMock.mockResolvedValueOnce({ rows: [], hasMore: false })

		await expect(fetchTransactions(args)).resolves.toEqual({ rows: [], stats: null, truncated: false })
		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
	})

	test('keeps a first-page request failure unavailable', async () => {
		fetchJsonMock.mockRejectedValueOnce(new Error('upstream unavailable'))

		await expect(fetchTransactions(args)).rejects.toThrow('upstream unavailable')
	})

	test('stops after one exact 10,000-row terminal page', async () => {
		const page = Array.from({ length: 10_000 }, (_, index) => transaction(`0x${index}`, range.endTimestamp - index - 1))
		fetchJsonMock.mockResolvedValueOnce({ rows: page, hasMore: false })

		const result = await fetchTransactions(args)

		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
		expect(result.rows).toHaveLength(10_000)
		expect(result.stats?.total).toBe(10_000)
		expect(result.truncated).toBe(false)
	})

	test('rejects continuation without a cursor', async () => {
		fetchJsonMock.mockResolvedValueOnce({
			rows: [transaction('first', range.startTimestamp + 1)],
			hasMore: true
		})

		await expect(fetchTransactions(args)).rejects.toThrow('missing its continuation cursor')
	})

	test('keeps a later-page failure unavailable instead of returning partial rows', async () => {
		fetchJsonMock
			.mockResolvedValueOnce({
				rows: [transaction('first', range.startTimestamp + 2)],
				hasMore: true,
				nextCursor: 'cursor-page-2'
			})
			.mockRejectedValueOnce(new Error('upstream unavailable'))

		await expect(fetchTransactions(args)).rejects.toThrow('upstream unavailable')
	})

	test('reports truncation after the approved 50-page limit', async () => {
		for (let page = 0; page < 50; page++) {
			fetchJsonMock.mockResolvedValueOnce({
				rows: [transaction(`page-${page}`, range.endTimestamp - page - 1)],
				hasMore: true,
				nextCursor: `cursor-${page + 1}`
			})
		}

		const result = await fetchTransactions(args)

		expect(fetchJsonMock).toHaveBeenCalledTimes(50)
		expect(result.rows).toHaveLength(50)
		expect(result.truncated).toBe(true)
	})

	test('keeps the selected end day and excludes exact next midnight', () => {
		const collector = createBridgeTransactionCollector(range)
		collector.addPage([
			{ ...transaction('last-millisecond', range.endTimestamp - 1), ts: '2026-01-31T23:59:59.999Z' },
			{ ...transaction('next-midnight', range.endTimestamp), ts: '2026-02-01T00:00:00.000Z' },
			transaction('before-start', range.startTimestamp - 1)
		])

		expect(collector.finish(false).rows.map((row) => row.tx_hash)).toEqual(['last-millisecond'])
	})

	test('projects exact table values to CSV, including null and zero USD', () => {
		const collector = createBridgeTransactionCollector(range)
		collector.addPage([{ ...transaction('missing', range.startTimestamp + 2), usd_value: null }])
		collector.addPage([{ ...transaction('zero', range.startTimestamp + 1), usd_value: '0' }])
		const rows = collector.finish(false).rows

		expect(rows.map(toBridgeTransactionCsvRow)).toEqual([
			[range.startTimestamp + 2, 'Test Bridge', 'Ethereum', true, 'USDC', '1', '', '0xfrom', '0xto', 'missing'],
			[range.startTimestamp + 1, 'Test Bridge', 'Ethereum', true, 'USDC', '1', 0, '0xfrom', '0xto', 'zero']
		])
	})

	test('searches the indexed transaction values case-insensitively', () => {
		const collector = createBridgeTransactionCollector(range)
		collector.addPage([
			{
				...transaction('0xUniqueHash', range.startTimestamp + 1),
				bridge_name: 'Across',
				chain: 'Arbitrum',
				token: 'WETH',
				amount: '987.65',
				usd_value: '1234.56',
				tx_from: '0xUniqueFrom',
				tx_to: '0xUniqueTo'
			}
		])
		const result = collector.finish(false)
		const row = result.rows[0]
		if (!row) throw new Error('Expected the transaction fixture to produce one row')
		const searchIndex = createBridgeTransactionSearchIndex([row])

		for (const query of [
			String(range.startTimestamp + 1),
			'across',
			'arbitrum',
			'weth',
			'987.65',
			'1234.56',
			'0xuniquefrom',
			'0xuniqueto',
			'0xuniquehash'
		]) {
			expect(matchesBridgeTransactionSearch(row, searchIndex, query)).toBe(true)
		}
		expect(matchesBridgeTransactionSearch(row, searchIndex, 'withdrawal')).toBe(false)
	})
})
