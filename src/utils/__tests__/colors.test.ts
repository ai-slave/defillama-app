import { describe, expect, test } from 'vitest'
import { getNDistinctColors } from '~/utils'

describe('getNDistinctColors', () => {
	test('reuses generated palettes without sharing mutable arrays', () => {
		const original = getNDistinctColors(30)
		const expected = [...original]
		original[0] = '#000000'

		const cached = getNDistinctColors(30)
		expect(cached).toEqual(expected)
		expect(cached).not.toBe(original)
	})
})
