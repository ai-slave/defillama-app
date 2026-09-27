import { describe, expect, test } from 'vitest'
import {
	formatCompactNumber,
	formatFixedNumber,
	formatNumber,
	formatPercent,
	formatPercentChange,
	formatRatio,
	formatUsd,
	roundNumber,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '../numberFormat'

describe('number formatting', () => {
	test('formats standard and compact numbers with consistent rounding', () => {
		expect(formatNumber(1234.567)).toBe('1,234.57')
		expect(formatCompactNumber(1234.567)).toBe('1.23K')
		expect(formatCompactNumber(7_534_000)).toBe('7.53M')
		expect(formatCompactNumber(16_763_000_000)).toBe('16.763B')
		expect(formatCompactNumber(7_910_000_000)).toBe('7.91B')
		expect(formatCompactNumber(3_300_000_000)).toBe('3.3B')
		expect(formatCompactNumber(1_234_500_000_000)).toBe('1.235T')
		expect(formatCompactNumber(999_999)).toBe('1M')
		expect(formatCompactNumber(1200, { minimumCompactValue: 1_000_000 })).toBe('1,200')
		expect(formatCompactNumber(123_000_000, { minimumCompactValue: 1_000_000 })).toBe('123M')
		expect(formatCompactNumber(123_000_000, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })).toBe(
			'123m'
		)
		expect(formatNumber(0.0015)).toBe('0.0015')
		expect(formatNumber('1234.567')).toBe('1,234.57')
		expect(formatCompactNumber(0.0015)).toBe('0.0015')
		expect(formatNumber(-0)).toBe('0')
	})

	test('centralizes fixed-width serialization and numeric rounding', () => {
		expect(formatFixedNumber(1.2, 2)).toBe('1.20')
		expect(formatFixedNumber(null, 2)).toBeNull()
		expect(roundNumber(1.235, 2)).toBe(1.24)
	})

	test('formats USD with adaptive precision', () => {
		expect(formatUsd(1_234_567, { compact: true })).toBe('$1.23M')
		expect(formatUsd(16_763_000_000, { compact: true, compactSuffix: 'lowercase' })).toBe('$16.763b')
		expect(formatUsd(7_910_000_000, { compact: true, compactSuffix: 'lowercase' })).toBe('$7.91b')
		expect(formatUsd(3_300_000_000, { compact: true, compactSuffix: 'lowercase' })).toBe('$3.3b')
		expect(formatUsd(1200, { compact: true, minimumCompactValue: 1_000_000 })).toBe('$1,200')
		expect(formatUsd(123_000_000, { compact: true, minimumCompactValue: 1_000_000 })).toBe('$123M')
		expect(
			formatUsd(123_000_000, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		).toBe('$123m')
		expect(formatUsd(0.0015)).toBe('$0.0015')
		expect(formatUsd(-0)).toBe('$0')
	})

	test('rounds expanded USD amounts of $1,000 or more to whole dollars', () => {
		expect(formatUsd(4872.16, USD_LOWERCASE_MILLIONS_OPTIONS)).toBe('$4,872')
		expect(formatUsd(-4872.16)).toBe('-$4,872')
	})

	test('shows full cents on expanded USD amounts below $1,000', () => {
		expect(formatUsd(5.4, USD_LOWERCASE_MILLIONS_OPTIONS)).toBe('$5.40')
		expect(formatUsd(999.5)).toBe('$999.50')
		expect(formatUsd(0.5)).toBe('$0.50')
		expect(formatUsd(-59.9)).toBe('-$59.90')
	})

	test('keeps exact whole-dollar USD amounts below $1,000 without padded cents', () => {
		expect(formatUsd(5)).toBe('$5')
		expect(formatUsd(875, USD_LOWERCASE_MILLIONS_OPTIONS)).toBe('$875')
	})

	test('keeps cents on large USD amounts when the caller sets precision', () => {
		expect(formatUsd(95_123.456, { maximumFractionDigits: 2 })).toBe('$95,123.46')
		expect(formatUsd(1234.5, { minimumFractionDigits: 2 })).toBe('$1,234.50')
	})

	test('formats ratios without changing their underlying value', () => {
		expect(formatRatio(1.239)).toBe('1.24')
		expect(formatRatio(1.235)).toBe('1.24')
		expect(formatRatio(0.0015)).toBe('<0.01')
		expect(formatRatio(-0.0015)).toBe('>-0.01')
		expect(formatRatio(0.0015, { maximumFractionDigits: 4 })).toBe('0.0015')
	})

	test('requires explicit percentage scaling and preserves small values', () => {
		expect(formatPercent(0.0015, { input: 'fraction' })).toBe('0.15%')
		expect(formatPercent(0.15, { input: 'percent' })).toBe('0.15%')
		expect(formatPercent(0.00015, { input: 'fraction' })).toBe('0.015%')
		expect(formatPercent(0.0000015, { input: 'fraction' })).toBe('0.00015%')
		expect(formatPercent(-0.0000015, { input: 'fraction' })).toBe('-0.00015%')
		expect(
			formatPercent(12.3, {
				input: 'percent',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				signDisplay: 'always',
				useGrouping: false
			})
		).toBe('+12.30%')
		expect(
			formatPercent(0.001, {
				input: 'percent',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		).toBe('0.00%')
		expect(
			formatPercent(0.001, {
				input: 'percent',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				smallValueDisplay: 'threshold'
			})
		).toBe('<0.01%')
		expect(
			formatPercent(1_200_000, {
				input: 'percent',
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		).toBe('1.2m%')
		expect(
			formatPercent(16_763_000_000, {
				input: 'percent',
				compact: true,
				compactSuffix: 'lowercase'
			})
		).toBe('16.763b%')
	})

	test('formats signed percentage changes and tiny nonzero changes', () => {
		expect(formatPercentChange(1.239)).toBe('+1.24%')
		expect(formatPercentChange(-1.239)).toBe('-1.24%')
		expect(formatPercentChange(101.2)).toBe('+101%')
		expect(formatPercentChange(0)).toBe('0%')
		expect(formatPercentChange(0.00001)).toBe('<0.0001%')
		expect(formatPercentChange(-0.00001)).toBe('>-0.0001%')
	})

	test('returns null for missing and non-finite values', () => {
		for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			expect(formatNumber(value)).toBeNull()
			expect(formatCompactNumber(value)).toBeNull()
			expect(formatUsd(value)).toBeNull()
			expect(formatRatio(value)).toBeNull()
			expect(formatPercent(value, { input: 'percent' })).toBeNull()
			expect(formatPercentChange(value)).toBeNull()
		}
	})
})
