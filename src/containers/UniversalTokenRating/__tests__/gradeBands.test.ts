import { describe, expect, it } from 'vitest'
import { resolveUtrGrade, utrGradeColor } from '../gradeBands'

describe('resolveUtrGrade', () => {
	it('maps the 0-100 overall scale onto the overall bands with inclusive lower cutoffs', () => {
		expect(resolveUtrGrade(100)).toBe('AAA')
		expect(resolveUtrGrade(82.5)).toBe('AAA')
		expect(resolveUtrGrade(82.49)).toBe('AA')
		expect(resolveUtrGrade(75)).toBe('AA')
		expect(resolveUtrGrade(67.5)).toBe('A')
		expect(resolveUtrGrade(63.73)).toBe('BBB')
		expect(resolveUtrGrade(50)).toBe('BB')
		expect(resolveUtrGrade(40)).toBe('B')
		expect(resolveUtrGrade(39.99)).toBe('CCC')
		expect(resolveUtrGrade(0)).toBe('CCC')
	})

	it('maps the 0-10 axis scale onto the axis bands', () => {
		expect(resolveUtrGrade(9.5, 10)).toBe('AAA')
		expect(resolveUtrGrade(9, 10)).toBe('AA')
		expect(resolveUtrGrade(8.5, 10)).toBe('A')
		expect(resolveUtrGrade(7.25, 10)).toBe('BBB')
		expect(resolveUtrGrade(6.25, 10)).toBe('BB')
		expect(resolveUtrGrade(5.25, 10)).toBe('B')
		expect(resolveUtrGrade(5.24, 10)).toBe('CCC')
	})

	it('returns null for missing or invalid scores', () => {
		expect(resolveUtrGrade(null)).toBeNull()
		expect(resolveUtrGrade(undefined)).toBeNull()
		expect(resolveUtrGrade(Number.NaN)).toBeNull()
	})
})

describe('utrGradeColor', () => {
	it('resolves each grade to its own hue and null to the muted N/A style', () => {
		expect(utrGradeColor('AAA').hex).toBe('#11935f')
		expect(utrGradeColor('CCC').hex).toBe('#b23a38')
		expect(utrGradeColor(null).text).toBe('text-tertiary')
	})
})
