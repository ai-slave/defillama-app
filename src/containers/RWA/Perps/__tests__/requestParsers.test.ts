import { describe, expect, test } from 'vitest'
import { parseChartMetricKey, parseOptionalTarget } from '../requestParsers'

describe('parseChartMetricKey', () => {
	test('accepts the supported metric keys', () => {
		expect(parseChartMetricKey('openInterest')).toBe('openInterest')
		expect(parseChartMetricKey('volume24h')).toBe('volume24h')
		expect(parseChartMetricKey('markets')).toBe('markets')
	})

	test('rejects unsupported values', () => {
		expect(parseChartMetricKey(undefined)).toBeNull()
		expect(parseChartMetricKey(['openInterest'])).toBeNull()
		expect(parseChartMetricKey('activeMcap')).toBeNull()
	})
})

describe('parseOptionalTarget', () => {
	test('trims valid string values', () => {
		expect(parseOptionalTarget(' xyz ')).toBe('xyz')
	})

	test('returns undefined for missing values', () => {
		expect(parseOptionalTarget(undefined)).toBeUndefined()
	})

	test('rejects arrays and blank strings', () => {
		expect(parseOptionalTarget(['xyz'])).toBeNull()
		expect(parseOptionalTarget('   ')).toBeNull()
	})
})
