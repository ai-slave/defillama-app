import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchBridgeTransactionsClientMock } = vi.hoisted(() => ({
	fetchBridgeTransactionsClientMock: vi.fn()
}))

vi.mock('./api', () => ({ fetchBridgeTransactionsClient: fetchBridgeTransactionsClientMock }))

import {
	createBridgeTransactionCollector,
	createBridgeTransactionSearchIndex,
	fetchTransactions,
	matchesBridgeTransactionSearch,
	toBridgeTransactionCsvCell,
	type BridgeTransaction
} from './Transactions'

const transaction = (hash: string, timestamp: number): BridgeTransaction => ({
	tx_hash: hash,
	ts: new Date(timestamp * 1000).toISOString(),
	tx_block: timestamp,
	tx_from: '0xfrom',
	tx_to: '0xto',
	token: 'USDC',
	amount: '1',
	is_deposit: true,
	chain: 'Ethereum',
	bridge_name: 'Test Bridge',
	usd_value: '1.25'
})

const args = {
	bridges: [{ id: 1, displayName: 'Test Bridge' }],
	startDate: '2026-01-01',
	endDate: '2026-01-31',
	selectedBridge: 'Test Bridge'
} as Parameters<typeof fetchTransactions>[0]

describe('bridge transaction construction behavior fixture', () => {
	beforeEach(() => vi.clearAllMocks())

	it('deduplicates page boundaries and restores descending order after an anomaly', async () => {
		const boundaryPage = Array.from({ length: 6000 }, (_, index) => transaction(`0x${index}`, 1_769_000_000 - index))
		fetchBridgeTransactionsClientMock
			.mockResolvedValueOnce(boundaryPage)
			.mockResolvedValueOnce([transaction('0x5999', 1_768_994_001), transaction('0xnewer-anomaly', 1_768_999_500)])

		const result = await fetchTransactions(args)

		expect(fetchBridgeTransactionsClientMock).toHaveBeenCalledTimes(2)
		expect(fetchBridgeTransactionsClientMock).toHaveBeenNthCalledWith(
			2,
			1,
			Math.floor(new Date(args.startDate).getTime() / 1000),
			1_768_994_000
		)
		expect(result.rows).toHaveLength(6001)
		expect(result.rows[0].tx_hash).toBe('0x0')
		expect(result.rows[501].tx_hash).toBe('0xnewer-anomaly')
		expect(new Set(result.rows.map((row) => row.tx_hash)).size).toBe(result.rows.length)
	})

	it('normalizes USD values once while producing exact rows and statistics', () => {
		const collector = createBridgeTransactionCollector()
		collector.addPage([
			{ ...transaction('missing', 4), usd_value: null },
			{ ...transaction('invalid', 3), is_deposit: false, usd_value: 'invalid' },
			{ ...transaction('zero', 2), usd_value: '0' },
			{ ...transaction('negative', 1), chain: 'Arbitrum', is_deposit: false, usd_value: '-2.5' }
		])

		const result = collector.finish()

		expect(result.rows.map((row) => row.usd_value)).toEqual([null, null, 0, -2.5])
		expect(result.rows[2]).toEqual({
			timestamp: 2,
			bridge_name: 'Test Bridge',
			bridge_slug: 'test-bridge',
			chain: 'Ethereum',
			is_deposit: true,
			token: 'USDC',
			amount: '1',
			usd_value: 0,
			tx_from: '0xfrom',
			tx_to: '0xto',
			tx_hash: 'zero'
		})
		expect(result.stats).toEqual({
			total: 4,
			deposits: 2,
			withdrawals: 2,
			depositVolume: 0,
			withdrawalVolume: -2.5,
			totalVolume: -2.5,
			unknownValueCount: 2,
			uniqueChains: 2
		})
	})

	it('keeps the first encountered duplicate and stable equal-timestamp order during fallback sorting', async () => {
		fetchBridgeTransactionsClientMock.mockResolvedValueOnce([
			{ ...transaction('duplicate', 100), token: 'FIRST' },
			transaction('equal-time', 100),
			{ ...transaction('duplicate', 99), token: 'SECOND' },
			transaction('newer-anomaly', 101)
		])

		const result = await fetchTransactions(args)

		expect(result.rows.map((row) => [row.tx_hash, row.token])).toEqual([
			['newer-anomaly', 'USDC'],
			['duplicate', 'FIRST'],
			['equal-time', 'USDC']
		])
	})

	it('does not sort an already descending multi-page stream', () => {
		const collector = createBridgeTransactionCollector()
		collector.addPage([transaction('first', 3), transaction('second', 2)])
		collector.addPage([transaction('third', 1)])
		const sortSpy = vi.spyOn(Array.prototype, 'sort')

		const result = collector.finish()
		const sortCalls = sortSpy.mock.calls.length
		sortSpy.mockRestore()

		expect(sortCalls).toBe(0)
		expect(result.rows.map((row) => row.tx_hash)).toEqual(['first', 'second', 'third'])
	})

	it('returns an empty result for an empty first page', async () => {
		fetchBridgeTransactionsClientMock.mockResolvedValueOnce([])

		await expect(fetchTransactions(args)).resolves.toEqual({ rows: [], stats: null })
		expect(fetchBridgeTransactionsClientMock).toHaveBeenCalledTimes(1)
	})

	it('stops after an empty terminal page at the 6,000-row boundary', async () => {
		const boundaryPage = Array.from({ length: 6000 }, (_, index) => transaction(`0x${index}`, 1_769_000_000 - index))
		fetchBridgeTransactionsClientMock.mockResolvedValueOnce(boundaryPage).mockResolvedValueOnce([])

		const result = await fetchTransactions(args)

		expect(fetchBridgeTransactionsClientMock).toHaveBeenCalledTimes(2)
		expect(result.rows).toHaveLength(6000)
		expect(result.stats?.total).toBe(6000)
	})

	it('preserves CSV cells for table values, including missing and zero USD', () => {
		expect(
			[1, 'Test Bridge', 'Ethereum', true, 'USDC', '1', null, '0xfrom', '0xto', '0xhash'].map(
				toBridgeTransactionCsvCell
			)
		).toEqual([1, 'Test Bridge', 'Ethereum', true, 'USDC', '1', '', '0xfrom', '0xto', '0xhash'])
		expect(toBridgeTransactionCsvCell(0)).toBe(0)
		expect(toBridgeTransactionCsvCell(-2.5)).toBe(-2.5)
		expect(toBridgeTransactionCsvCell(Number.NaN)).toBe('')
	})

	it('searches the indexed transaction values case-insensitively', () => {
		const collector = createBridgeTransactionCollector()
		collector.addPage([
			{
				...transaction('0xUniqueHash', 1_800_000_000),
				bridge_name: 'Across',
				chain: 'Arbitrum',
				token: 'WETH',
				amount: '987.65',
				usd_value: '1234.56',
				tx_from: '0xUniqueFrom',
				tx_to: '0xUniqueTo'
			}
		])
		const row = collector.finish().rows[0]
		const searchIndex = createBridgeTransactionSearchIndex([row])

		for (const query of [
			'1800000000',
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
