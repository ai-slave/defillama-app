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
	const payload = {
		depth50: [
			{ marketMakerId: 'a', marketMakerName: 'A', marketMakerImageUrl: null, rank: { value: 1, percentile: 100 } }
		],
		depth100: [],
		depth200: []
	}
	test('selects the 0.5% bucket', () => {
		expect(selectDepthBucket(payload, '0.5%')[0].marketMakerId).toBe('a')
	})
	test('returns an empty array for an empty bucket', () => {
		expect(selectDepthBucket(payload, '1%')).toEqual([])
	})
})
