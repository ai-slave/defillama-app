import { describe, expect, test } from 'vitest'
import { processAdjustedTvl } from '../tvl'

describe('TVL adjustment helpers', () => {
	test('subtracts doublecounted and liquid staking TVL while adding their overlap', () => {
		expect(
			processAdjustedTvl({
				tvl: [
					[1_700_000_000, 150.9],
					[1_700_086_400, 80]
				],
				doublecounted: [[1_700_000_000, 30.8]],
				liquidstaking: [[1_700_000_000, 60.2]],
				dcAndLsOverlap: [[1_700_000_000, 10.9]]
			})
		).toEqual([
			[1_700_000_000, 70],
			[1_700_086_400, 80]
		])
	})
})
