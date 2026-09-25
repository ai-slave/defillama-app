import { describe, expect, test } from 'vitest'
import { getProtocolRowMembership } from '../protocolRowMembership'

describe('getProtocolRowMembership', () => {
	test('gives metric presets a canonical source membership and leaves custom tables broad', () => {
		expect(getProtocolRowMembership({ activePresetId: 'open-interest-protocols' })).toEqual({
			kind: 'base-metric',
			family: 'open-interest'
		})
		expect(getProtocolRowMembership({ activePresetId: 'perps-protocols' })).toEqual({
			kind: 'base-metric',
			family: 'perps-volume'
		})
		expect(getProtocolRowMembership({ activePresetId: 'custom' })).toEqual({ kind: 'all-protocols' })
		expect(getProtocolRowMembership({})).toEqual({ kind: 'all-protocols' })
	})
})
