import { describe, expect, it } from 'vitest'
import { getPoolStability } from '../stability'

const detail = {
	stability_30d: { base_reward_intrinsic: 0.72 }
}

describe('getPoolStability', () => {
	it('returns the score and rating when the full APY composition is available', () => {
		expect(getPoolStability(detail)).toEqual({ score: 0.72, rating: 'stable' })
	})

	it('returns null when the pool has no stability score', () => {
		expect(getPoolStability({ ...detail, stability_30d: {} })).toBeNull()
	})
})
