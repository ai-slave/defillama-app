import { describe, expect, test } from 'vitest'
import { getRwaInclusionDefault } from '../inclusion'

describe('RWA inclusion options', () => {
	test('falls back to bridge on and wrappers off when the page did not set them', () => {
		const defaults = { includeStablecoins: true, includeGovernance: false, includeRwaPerps: false }
		expect(getRwaInclusionDefault(defaults, 'includeStablecoins')).toBe(true)
		expect(getRwaInclusionDefault(defaults, 'includeGovernance')).toBe(false)
		expect(getRwaInclusionDefault(defaults, 'includeWrappers')).toBe(false)
		expect(getRwaInclusionDefault(defaults, 'includeBridgeTvl')).toBe(true)
		expect(
			getRwaInclusionDefault({ ...defaults, includeWrappers: true, includeBridgeTvl: false }, 'includeBridgeTvl')
		).toBe(false)
	})
})
