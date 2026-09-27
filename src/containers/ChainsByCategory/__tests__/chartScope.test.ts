import { describe, expect, test } from 'vitest'
import { getChainsChartIgnoredFilters } from '../index'

describe('getChainsChartIgnoredFilters', () => {
	test('names the table filters the TVL charts ignore', () => {
		expect(getChainsChartIgnoredFilters(null, null, [])).toEqual([])
		expect(getChainsChartIgnoredFilters(1000, null, [])).toEqual(['TVL range'])
		expect(getChainsChartIgnoredFilters(null, 5000, [])).toEqual(['TVL range'])
		expect(getChainsChartIgnoredFilters(null, null, ['L2'])).toEqual(['Group Chains'])
		expect(getChainsChartIgnoredFilters(1000, null, ['L2', 'gas'])).toEqual(['TVL range', 'Group Chains'])
	})
})
