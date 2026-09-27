import { afterEach, expect, test } from 'vitest'
import { getDefaultBridgeTransactionRange } from '../Transactions'

const originalTz = process.env.TZ

afterEach(() => {
	process.env.TZ = originalTz
})

test('the default month reads the same in every time zone', () => {
	// Half an hour into a UTC day: local arithmetic in Los Angeles would land on the day before.
	const seed = Date.UTC(2026, 2, 1, 0, 30) / 1e3
	process.env.TZ = 'UTC'
	expect(getDefaultBridgeTransactionRange(seed)).toEqual({ startDate: '2026-02-01', endDate: '2026-03-01' })
	process.env.TZ = 'America/Los_Angeles'
	expect(getDefaultBridgeTransactionRange(seed)).toEqual({ startDate: '2026-02-01', endDate: '2026-03-01' })
})
