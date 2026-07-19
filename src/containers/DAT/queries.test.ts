import { describe, expect, it } from 'vitest'
import { toUnixMsTimestamp } from './api'
import type { IDATTransaction } from './api.types'
import { buildDATTransactionRowsByAsset } from './queries'

describe('toUnixMsTimestamp', () => {
	it('normalizes documented numeric second timestamps without changing millisecond timestamps', () => {
		expect(toUnixMsTimestamp(1_767_225_600)).toBe(1_767_225_600_000)
		expect(toUnixMsTimestamp(1_767_225_600_000)).toBe(1_767_225_600_000)
	})
})

function transaction(overrides: Partial<IDATTransaction>): IDATTransaction {
	return {
		id: 1,
		asset: 'bitcoin',
		amount: '1',
		avg_price: '100',
		usd_value: '100',
		start_date: '2026-01-01',
		end_date: '2026-01-01',
		report_date: '2026-01-02',
		type: 'purchase',
		source_type: '',
		source_url: '',
		source_note: '',
		is_approved: true,
		reject_reason: null,
		last_updated: '',
		ticker: '',
		assetName: '',
		assetTicker: '',
		...overrides
	}
}

describe('buildDATTransactionRowsByAsset', () => {
	it('reverse-iterates the newest-first API response and groups assets in one pass', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ id: 3, end_date: '2026-01-03', amount: '3', avg_price: '300', usd_value: '900' }),
			transaction({ id: 2, asset: 'ethereum', end_date: '2026-01-02', amount: '2' }),
			transaction({ id: 1, end_date: '2026-01-01', amount: '1' })
		])

		expect(result.get('bitcoin')).toEqual([
			[Date.parse('2026-01-01') / 1000, 1, 100, 100],
			[Date.parse('2026-01-03') / 1000, 3, 300, 900]
		])
		expect(result.get('ethereum')).toEqual([[Date.parse('2026-01-02') / 1000, 2, 100, 100]])
	})

	it('keeps sales negative while converting the documented string numerics once', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ type: 'sale', amount: '2.5', avg_price: '12.25', usd_value: '30.625' })
		])

		expect(result.get('bitcoin')?.[0].slice(1)).toEqual([-2.5, 12.25, 30.625])
	})

	it('sorts only an asset whose mostly newest-first response contains a local inversion', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ id: 4, end_date: '2026-01-04', amount: '4' }),
			transaction({ id: 2, end_date: '2026-01-02', amount: '2' }),
			transaction({ id: 3, end_date: '2026-01-03', amount: '3' }),
			transaction({ id: 1, end_date: '2026-01-01', amount: '1' })
		])

		expect(result.get('bitcoin')?.map((item) => item[0])).toEqual([
			Date.parse('2026-01-01') / 1000,
			Date.parse('2026-01-02') / 1000,
			Date.parse('2026-01-03') / 1000,
			Date.parse('2026-01-04') / 1000
		])
	})
})
