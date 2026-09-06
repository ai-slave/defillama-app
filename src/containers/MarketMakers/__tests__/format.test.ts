import { describe, expect, test } from 'vitest'
import {
	formatComposite,
	formatMarketPct,
	formatMetricValue,
	normalizeUptime,
	resolveGrade,
	roundPercentile
} from '../format'

describe('formatComposite', () => {
	test('renders N/A for null', () => {
		expect(formatComposite(null)).toBe('N/A')
	})
	test('renders <5.00 for a value below 5', () => {
		expect(formatComposite(4.99)).toBe('<5.00')
		expect(formatComposite(1)).toBe('<5.00')
	})
	test('renders a two-decimal number for a value of 5 or more', () => {
		expect(formatComposite(5)).toBe('5.00')
		expect(formatComposite(9.4)).toBe('9.40')
	})
})

describe('resolveGrade', () => {
	test('returns null when the composite is null', () => {
		expect(resolveGrade(null)).toBeNull()
	})
	test('maps each composite band to its credit-style grade', () => {
		expect(resolveGrade(10)?.label).toBe('AAA')
		expect(resolveGrade(9.5)?.label).toBe('AAA')
		expect(resolveGrade(9.49)?.label).toBe('AA')
		expect(resolveGrade(9)?.label).toBe('AA')
		expect(resolveGrade(8.99)?.label).toBe('A')
		expect(resolveGrade(8.25)?.label).toBe('A')
		expect(resolveGrade(8.24)?.label).toBe('BBB')
		expect(resolveGrade(7.25)?.label).toBe('BBB')
		expect(resolveGrade(7.24)?.label).toBe('BB')
		expect(resolveGrade(6.25)?.label).toBe('BB')
		expect(resolveGrade(6.24)?.label).toBe('B')
		expect(resolveGrade(5.25)?.label).toBe('B')
		expect(resolveGrade(5.24)?.label).toBe('CCC')
	})
	test('colors AAA/AA/A success, BBB/BB/B warning, CCC error', () => {
		expect(resolveGrade(9.5)?.colorClassName).toBe('text-success')
		expect(resolveGrade(8.5)?.colorClassName).toBe('text-success')
		expect(resolveGrade(7.5)?.colorClassName).toBe('text-warning')
		expect(resolveGrade(6.5)?.colorClassName).toBe('text-warning')
		expect(resolveGrade(5.5)?.colorClassName).toBe('text-warning')
		expect(resolveGrade(1)?.colorClassName).toBe('text-error')
	})
})

describe('roundPercentile', () => {
	test('returns null for null', () => {
		expect(roundPercentile(null)).toBeNull()
	})
	test('rounds to the nearest integer', () => {
		expect(roundPercentile(80.85106382978724)).toBe(81)
		expect(roundPercentile(95.4)).toBe(95)
	})
})

describe('normalizeUptime', () => {
	test('scales a 0..1 fraction up to 0..100', () => {
		expect(normalizeUptime(0.9)).toBe(90)
	})
	test('passes through a value already on the 0..100 scale', () => {
		expect(normalizeUptime(99.75)).toBe(99.75)
	})
	test('returns null for null', () => {
		expect(normalizeUptime(null)).toBeNull()
	})
})

describe('formatMetricValue', () => {
	test('renders N/A for null regardless of kind', () => {
		expect(formatMetricValue(null, 'usd')).toBe('N/A')
	})
	test('abbreviates usd with a dollar sign', () => {
		const out = formatMetricValue(266_553_520, 'usd')
		expect(out).toContain('$266')
		expect(out).toContain('M')
	})
	test('formats a score to two decimals', () => {
		expect(formatMetricValue(9.5, 'score')).toBe('9.50')
	})
	test('appends a percent sign for percent kind', () => {
		expect(formatMetricValue(0.13, 'percent')).toBe('0.13%')
	})
	test('rounds percent values to two decimals without float noise', () => {
		expect(formatMetricValue(99.666, 'percent')).toBe('99.67%')
	})
	test('trims trailing zeros for whole percents', () => {
		expect(formatMetricValue(10, 'percent')).toBe('10%')
	})
	test('formats spread to two decimals', () => {
		expect(formatMetricValue(0.318, 'spread')).toBe('0.32%')
	})
})

describe('formatMarketPct', () => {
	test('labels a market-share percentage', () => {
		expect(formatMarketPct(10)).toBe('10% of Market')
	})
	test('handles a tiny value without throwing', () => {
		expect(formatMarketPct(1.93e-5)).toContain('of Market')
	})
})
