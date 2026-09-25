import { describe, expect, test } from 'vitest'
import { selectDepthBucket, toBoardRows } from '../shape'

describe('toBoardRows', () => {
	test('lifts identity fields and groups metric triples', () => {
		const rows = toBoardRows([
			{
				marketMakerId: 'flowdesk',
				marketMakerName: 'Flowdesk',
				marketMakerImageUrl: 'https://img/x',
				rank: { percentile: 100, value: 1 },
				bidAskSpread: { percentile: 84, rank: 9, value: 0.318 }
			}
		])
		expect(rows[0].marketMakerId).toBe('flowdesk')
		expect(rows[0].rank).toEqual({ percentile: 100, value: 1 })
		expect(rows[0].metrics.bidAskSpread).toEqual({ percentile: 84, rank: 9, value: 0.318 })
	})
})

describe('selectDepthBucket', () => {
	const row = (marketMakerId: string) => ({
		marketMakerId,
		marketMakerName: marketMakerId,
		marketMakerImageUrl: null,
		rank: { value: 1, percentile: 100 }
	})
	const payload = { depth50: [row('half')], depth100: [row('one')], depth200: [row('two')] }

	test.each([
		['0.5%', 'half'],
		['1%', 'one'],
		['2%', 'two']
	] as const)('maps the %s threshold to its own depth bucket', (threshold, id) => {
		expect(selectDepthBucket(payload, threshold).map((r) => r.marketMakerId)).toEqual([id])
	})
})
