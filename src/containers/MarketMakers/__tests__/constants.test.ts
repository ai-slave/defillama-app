import { describe, expect, test } from 'vitest'
import { selectCellNumber } from '../constants'

describe('selectCellNumber', () => {
	const metric = { value: 1000, percentile: 80, rank: 3 }
	test('returns the field matching the active mode', () => {
		expect(selectCellNumber(metric, 'value')).toBe(1000)
		expect(selectCellNumber(metric, 'percentile')).toBe(80)
		expect(selectCellNumber(metric, 'rank')).toBe(3)
	})
	test('returns null for a missing metric', () => {
		expect(selectCellNumber(null, 'value')).toBeNull()
	})
})
