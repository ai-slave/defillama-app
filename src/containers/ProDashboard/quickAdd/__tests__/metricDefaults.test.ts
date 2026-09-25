import { describe, expect, test } from 'vitest'
import { isDashboardChartTypeForSubject } from '../../types'
import { getDefaultMetricAggregator, getSubjectMetricPriority, resolveMetricForSubject } from '../metricDefaults'

describe('quick add metric defaults', () => {
	test('sums flow metrics and takes the latest point of stock metrics', () => {
		for (const type of ['fees', 'revenue', 'volume', 'txs', 'activeUsers', 'newUsers', 'perps', 'incentives']) {
			expect(getDefaultMetricAggregator(type)).toBe('sum')
		}
		for (const type of [
			'tvl',
			'tokenPrice',
			'tokenMcap',
			'openInterest',
			'borrowed',
			'treasury',
			'stablecoins',
			'bridgedTvl',
			'medianApy'
		]) {
			expect(getDefaultMetricAggregator(type)).toBe('latest')
		}
	})

	test('remaps subject specific metric twins', () => {
		expect(resolveMetricForSubject('chain', 'tokenPrice')).toBe('chainPrice')
		expect(resolveMetricForSubject('chain', 'tokenMcap')).toBe('chainMcap')
		expect(resolveMetricForSubject('protocol', 'chainFees')).toBe('fees')
		expect(resolveMetricForSubject('protocol', 'chainRevenue')).toBe('revenue')
		expect(resolveMetricForSubject('chain', 'tvl')).toBe('tvl')
		expect(resolveMetricForSubject('protocol', 'stablecoins')).toBe(null)
		expect(resolveMetricForSubject('chain', 'treasury')).toBe(null)
	})

	test('orders a subject priority list that only holds valid types', () => {
		const protocolPriority = getSubjectMetricPriority('protocol')
		const chainPriority = getSubjectMetricPriority('chain')
		expect(protocolPriority.slice(0, 5)).toEqual(['tvl', 'fees', 'revenue', 'volume', 'activeUsers'])
		expect(chainPriority.slice(0, 4)).toEqual(['tvl', 'fees', 'revenue', 'volume'])
		expect(chainPriority).toContain('chainPrice')
		expect(chainPriority).not.toContain('tokenPrice')
		for (const type of protocolPriority) expect(isDashboardChartTypeForSubject('protocol', type)).toBe(true)
		for (const type of chainPriority) expect(isDashboardChartTypeForSubject('chain', type)).toBe(true)
		expect(new Set(protocolPriority).size).toBe(protocolPriority.length)
		expect(new Set(chainPriority).size).toBe(chainPriority.length)
	})
})
