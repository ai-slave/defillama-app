import { describe, expect, it } from 'vitest'
import { isProDashboardProxyType } from './dashboardProxyContract'

describe('isProDashboardProxyType', () => {
	it('accepts supported proxy operations', () => {
		for (const type of ['chart', 'stablecoins', 'yields', 'rwaBreakdown', 'equitiesFilings', 'stablecoinAsset']) {
			expect(isProDashboardProxyType(type)).toBe(true)
		}
	})

	it('rejects unknown and non-string query values', () => {
		expect(isProDashboardProxyType('unknown')).toBe(false)
		expect(isProDashboardProxyType(['chart'])).toBe(false)
		expect(isProDashboardProxyType(undefined)).toBe(false)
	})
})
