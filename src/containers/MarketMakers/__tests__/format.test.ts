import { describe, expect, it } from 'vitest'
import { formatComposite, formatMarketPct, formatMetricValue, normalizeUptime, roundPercentile } from '../format'

describe('formatComposite', () => {
	it('renders N/A for null', () => {
		expect(formatComposite(null)).toBe('N/A')
	})
	it('renders <5.00 for a value below 5', () => {
		expect(formatComposite(4.99)).toBe('<5.00')
		expect(formatComposite(1)).toBe('<5.00')
	})
	it('renders a two-decimal number for a value of 5 or more', () => {
		expect(formatComposite(5)).toBe('5.00')
		expect(formatComposite(9.4)).toBe('9.40')
	})
})

describe('roundPercentile', () => {
	it('returns null for null', () => {
		expect(roundPercentile(null)).toBeNull()
	})
	it('rounds to the nearest integer', () => {
		expect(roundPercentile(80.85106382978724)).toBe(81)
		expect(roundPercentile(95.4)).toBe(95)
	})
})

describe('normalizeUptime', () => {
	it('scales a 0..1 fraction up to 0..100', () => {
		expect(normalizeUptime(0.9)).toBe(90)
	})
	it('passes through a value already on the 0..100 scale', () => {
		expect(normalizeUptime(99.75)).toBe(99.75)
	})
	it('returns null for null', () => {
		expect(normalizeUptime(null)).toBeNull()
	})
})

describe('formatMetricValue', () => {
	it('renders N/A for null regardless of kind', () => {
		expect(formatMetricValue(null, 'usd')).toBe('N/A')
	})
	it('abbreviates usd with a dollar sign', () => {
		const out = formatMetricValue(266553520, 'usd')
		expect(out).toContain('$266')
		expect(out).toContain('M')
	})
	it('formats a score to two decimals', () => {
		expect(formatMetricValue(9.5, 'score')).toBe('9.50')
	})
	it('appends a percent sign for percent kind', () => {
		expect(formatMetricValue(0.13, 'percent')).toBe('0.13%')
	})
	it('rounds percent values to two decimals without float noise', () => {
		expect(formatMetricValue(99.666, 'percent')).toBe('99.67%')
	})
	it('trims trailing zeros for whole percents', () => {
		expect(formatMetricValue(10, 'percent')).toBe('10%')
	})
	it('formats spread to two decimals', () => {
		expect(formatMetricValue(0.318, 'spread')).toBe('0.32%')
	})
})

describe('formatMarketPct', () => {
	it('labels a market-share percentage', () => {
		expect(formatMarketPct(10)).toBe('10% of Market')
	})
	it('handles a tiny value without throwing', () => {
		expect(formatMarketPct(1.93e-5)).toContain('of Market')
	})
})
