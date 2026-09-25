import { describe, expect, test } from 'vitest'
import { buildEtherfiCashTransactions, type EtherfiCashTxnRow } from '../cashApi'

function row(overrides: Partial<EtherfiCashTxnRow>): EtherfiCashTxnRow {
	return {
		date: '2026-07-13T00:00:00Z',
		txn_class: 'Card',
		num_txns: 2,
		num_users: 1,
		total_txns: 5,
		total_users: 3,
		total_avg_per_user: 5 / 3,
		last_week_txns: 5,
		last_week_users: 3,
		last_week_avg: 5 / 3,
		all_time_txns: 100,
		all_time_users: 25,
		all_time_avg: 4,
		...overrides
	}
}

describe('buildEtherfiCashTransactions', () => {
	test('groups raw Dune rows by timestamp and transaction class', () => {
		const result = buildEtherfiCashTransactions([
			row({ txn_class: 'Transfer', num_txns: 3, num_users: 2 }),
			row({ txn_class: 'Card' })
		])
		const timestamp = Date.parse('2026-07-13T00:00:00Z')

		expect(result.kpis).toMatchObject({ allTimeTxns: 100, lastWeekTxns: 5 })
		expect(result.transactionsByClassDataset).toEqual({
			dimensions: ['timestamp', 'Card', 'Transfer'],
			source: [[timestamp, 2, 3]]
		})
		expect(result.usersByClassDataset.source).toEqual([[timestamp, 1, 2]])
		for (const chart of result.classCharts) {
			expect(chart.encode.y).toBeTypeOf('number')
			expect(chart.encode.y).toBeLessThan(result.transactionsByClassDataset.dimensions.length)
		}
	})
})
