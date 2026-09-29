import { describe, expect, test } from 'vitest'
import { withOptionsRatios } from '../optionsRatios'
import type { IProtocol } from '../types'

const exchange = (name: string, total24h: number, notionalVolume24h: number, extra: Partial<IProtocol> = {}) =>
	({
		name,
		slug: name.toLowerCase(),
		logo: '',
		chains: [],
		category: 'Options',
		total24h,
		total7d: null,
		total30d: null,
		total1y: null,
		totalAllTime: null,
		mcap: null,
		notionalVolume24h,
		...extra
	}) satisfies IProtocol

describe('withOptionsRatios', () => {
	test('flags a notional/premium ratio more than 3x the median exchange', () => {
		const rows = withOptionsRatios([
			exchange('A', 100, 5000),
			exchange('B', 100, 6000),
			exchange('C', 100, 7000),
			exchange('D', 100, 30_000)
		])

		expect(rows.map((row) => [row.name, row.notionalToPremium, row.highRatioMedians ?? null])).toEqual([
			['A', 50, null],
			['B', 60, null],
			['C', 70, null],
			['D', 300, { notionalToPremium: 65 }]
		])
	})

	test('compares child exchanges against the median of top-level exchanges', () => {
		const rows = withOptionsRatios([
			exchange('A', 100, 5000),
			exchange('B', 100, 6000),
			exchange('Parent', 200, 13_000, {
				childProtocols: [exchange('Child 1', 100, 1000), exchange('Child 2', 100, 30_000)]
			})
		])

		expect(rows[2]?.childProtocols?.map((row) => [row.name, row.highRatioMedians ?? null])).toEqual([
			['Child 1', null],
			['Child 2', { notionalToPremium: 60 }]
		])
	})

	test('leaves ratios blank when premium volume is zero', () => {
		const [row] = withOptionsRatios([exchange('A', 0, 5000, { openInterest: 1000 })])

		expect([row?.notionalToPremium, row?.openInterestToPremium]).toEqual([null, null])
	})
})
