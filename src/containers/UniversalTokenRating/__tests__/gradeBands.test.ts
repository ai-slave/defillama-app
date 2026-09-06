import { describe, expect, test } from 'vitest'
import { resolveUtrGrade, resolveUtrGradeOrLabel, utrGradeColor } from '../gradeBands'

const overallScale = [
	{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
	{ min: 40, grade: 'AA', interpretation: 'Very high confidence' },
	{ min: 35, grade: 'A', interpretation: 'High confidence' },
	{ min: 30, grade: 'BBB', interpretation: 'Moderate confidence' },
	{ min: 25, grade: 'BB', interpretation: 'Developing confidence' },
	{ min: 20, grade: 'B', interpretation: 'Low confidence' },
	{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
]

const axisScale = [
	{ min: 8, grade: 'AAA', interpretation: 'Exceptional' },
	{ min: 6, grade: 'AA', interpretation: 'Excellent' },
	{ min: 5, grade: 'A', interpretation: 'Strong' },
	{ min: 4.5, grade: 'BBB', interpretation: 'Good' },
	{ min: 4, grade: 'BB', interpretation: 'Adequate' },
	{ min: 3, grade: 'B', interpretation: 'Limited' },
	{ min: null, grade: 'CCC', interpretation: 'Insufficient' }
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

	test('uses the runtime axis scale at and immediately below each boundary', () => {
		expect(resolveUtrGrade(8, axisScale)).toBe('AAA')
		expect(resolveUtrGrade(7.99, axisScale)).toBe('AA')
		expect(resolveUtrGrade(6, axisScale)).toBe('AA')
		expect(resolveUtrGrade(5.99, axisScale)).toBe('A')
		expect(resolveUtrGrade(3, axisScale)).toBe('B')
		expect(resolveUtrGrade(2.99, axisScale)).toBe('CCC')
	})

	test('returns null without runtime configuration and lets explicit API grades win', () => {
		expect(resolveUtrGrade(60, null)).toBeNull()
		expect(resolveUtrGrade(null, overallScale)).toBeNull()
		expect(resolveUtrGrade(undefined, overallScale)).toBeNull()
		expect(resolveUtrGrade(Number.NaN, overallScale)).toBeNull()
		expect(resolveUtrGradeOrLabel(60, overallScale, 'B')).toBe('B')
	})
})

describe('utrGradeColor', () => {
	test('resolves each grade to its own hue and null to the muted N/A style', () => {
		expect(utrGradeColor('AAA').hex).toBe('#11935f')
		expect(utrGradeColor('CCC').hex).toBe('#b23a38')
		expect(utrGradeColor(null).text).toBe('text-tertiary')
	})
})
