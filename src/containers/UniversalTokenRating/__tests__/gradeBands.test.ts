import { describe, expect, test } from 'vitest'
import { resolveUtrGrade, resolveUtrGradeOrLabel } from '../gradeBands'

const overallScale = [
	{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
	{ min: 40, grade: 'AA', interpretation: 'Very high confidence' },
	{ min: 35, grade: 'A', interpretation: 'High confidence' },
	{ min: 30, grade: 'BBB', interpretation: 'Moderate confidence' },
	{ min: 25, grade: 'BB', interpretation: 'Developing confidence' },
	{ min: 20, grade: 'B', interpretation: 'Low confidence' },
	{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
]

describe('resolveUtrGrade', () => {
	test('uses the runtime overall scale with inclusive lower cutoffs', () => {
		expect(resolveUtrGrade(100, overallScale)).toBe('AAA')
		expect(resolveUtrGrade(60, overallScale)).toBe('AAA')
		expect(resolveUtrGrade(59.99, overallScale)).toBe('AA')
		expect(resolveUtrGrade(40, overallScale)).toBe('AA')
		expect(resolveUtrGrade(39.99, overallScale)).toBe('A')
		expect(resolveUtrGrade(20, overallScale)).toBe('B')
		expect(resolveUtrGrade(19.99, overallScale)).toBe('CCC')
	})

	test('returns null without runtime configuration and lets explicit API grades win', () => {
		expect(resolveUtrGrade(60, null)).toBeNull()
		expect(resolveUtrGrade(null, overallScale)).toBeNull()
		expect(resolveUtrGrade(undefined, overallScale)).toBeNull()
		expect(resolveUtrGrade(Number.NaN, overallScale)).toBeNull()
		expect(resolveUtrGradeOrLabel(60, overallScale, 'B')).toBe('B')
	})
})
