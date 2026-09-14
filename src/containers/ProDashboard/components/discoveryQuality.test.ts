import { describe, expect, test } from 'vitest'
import { isLowQualityDashboardName } from './discoveryQuality'

describe('isLowQualityDashboardName', () => {
	test.each(['L2s', 'RWA', 'DeFi Yields', 'Stablecoin Flows', 'Testnet Watch', 'test dashboard for Aave'])(
		'keeps "%s"',
		(name) => {
			expect(isLowQualityDashboardName(name)).toBe(false)
		}
	)

	test.each([
		'hgh',
		'test',
		'ab',
		'Test',
		'  TEST ',
		'asdf',
		'qwer',
		'Untitled Dashboard',
		'new  dashboard',
		'My Dashboard'
	])('rejects "%s"', (name) => {
		expect(isLowQualityDashboardName(name)).toBe(true)
	})

	test('treats empty, whitespace-only and missing names as low quality', () => {
		expect(isLowQualityDashboardName('')).toBe(true)
		expect(isLowQualityDashboardName('   ')).toBe(true)
		expect(isLowQualityDashboardName(undefined)).toBe(true)
		expect(isLowQualityDashboardName(null)).toBe(true)
	})
})
