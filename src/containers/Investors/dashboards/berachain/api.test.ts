import { describe, expect, test } from 'vitest'
import { buildBerachainIncome } from './api'

// Aug 1 to Sep 9, 2026: forty daily points across two months.
const DAYS = Array.from({ length: 40 }, (_, index) => Date.UTC(2026, 7, 1 + index) / 1000)
const daily = (value: number): Array<[number, number]> => DAYS.map((day) => [day, value])
const AUG = Date.UTC(2026, 7, 1)
const SEP = Date.UTC(2026, 8, 1)
const LAST_DAY = Date.UTC(2026, 8, 9)

const income = buildBerachainIncome({
	chainFees: daily(1),
	bexRevenue: daily(2),
	bexVolume: daily(3),
	bendFees: daily(4),
	bendRevenue: daily(5)
})

describe('buildBerachainIncome', () => {
	test('sums each monthly breakdown into one row per month labelled as monthly', () => {
		expect(income.berachain.monthly).toEqual({
			dataset: {
				source: [
					[AUG, 31],
					[SEP, 9]
				],
				dimensions: ['timestamp', 'Chain Fees']
			},
			groupBy: 'monthly'
		})
		expect(income.bex.monthly).toEqual({
			dataset: {
				source: [
					[AUG, 62],
					[SEP, 18]
				],
				dimensions: ['timestamp', 'Revenue']
			},
			groupBy: 'monthly'
		})
		expect(income.bend.monthly).toEqual({
			dataset: {
				source: [
					[AUG, 124, 155],
					[SEP, 36, 45]
				],
				dimensions: ['timestamp', 'Fees', 'Revenue']
			},
			groupBy: 'monthly'
		})
	})

	test('keeps the cumulative charts daily, one running total per day', () => {
		expect(income.berachain.chainFeesCumulative.source).toHaveLength(40)
		expect(income.berachain.chainFeesCumulative.source.at(-1)).toEqual([LAST_DAY, 40])
		expect(income.bex.volumeCumulative).toEqual({
			source: DAYS.map((day, index) => [day * 1000, 3 * (index + 1)]),
			dimensions: ['timestamp', 'Volume']
		})
		expect(income.bend.revenueCumulative.dimensions).toEqual(['timestamp', 'Revenue'])
		expect(income.bend.revenueCumulative.source.at(-1)).toEqual([LAST_DAY, 200])
		expect(income.totalRevenue.cumulative.source.at(-1)).toEqual([LAST_DAY, 40, 80, 200])
	})
})
