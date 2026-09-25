import { describe, expect, test } from 'vitest'
import { parseChartMetricKey } from '../requestParsers'

describe('parseChartMetricKey', () => {
	test('accepts the perps metric keys and rejects spot-only ones', () => {
		expect(parseChartMetricKey('openInterest')).toBe('openInterest')
		expect(parseChartMetricKey('volume24h')).toBe('volume24h')
		expect(parseChartMetricKey('markets')).toBe('markets')
		expect(parseChartMetricKey('activeMcap')).toBeNull()
	})
})
