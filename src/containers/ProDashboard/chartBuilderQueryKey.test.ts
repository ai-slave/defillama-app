import { describe, expect, it } from 'vitest'
import { getChartBuilderQueryKey, resolveChartBuilderFilterMode } from './chartBuilderQueryKey'
import type { ChartBuilderConfig } from './types'

const config: ChartBuilderConfig['config'] = {
	metric: 'fees',
	mode: 'chains',
	chains: ['Ethereum'],
	categories: ['Dexs'],
	groupBy: 'protocol',
	limit: 10,
	chartType: 'stackedBar',
	displayAs: 'timeSeries'
}

describe('Pro dashboard chart-builder query identity', () => {
	it('uses the legacy filter mode as the fallback for all specific modes', () => {
		expect(resolveChartBuilderFilterMode(undefined, 'exclude')).toBe('exclude')
		expect(getChartBuilderQueryKey({ ...config, filterMode: 'exclude' }).slice(-4)).toEqual([
			'exclude',
			'exclude',
			'exclude',
			'exclude'
		])
	})

	it('lets specific modes override the saved legacy fallback', () => {
		expect(getChartBuilderQueryKey({ ...config, filterMode: 'exclude', chainFilterMode: 'include' }).slice(-4)).toEqual(
			['include', 'exclude', 'exclude', 'exclude']
		)
	})

	it('ignores invalid persisted modes before building a cache key', () => {
		expect(resolveChartBuilderFilterMode('legacy-mode', 'exclude')).toBe('exclude')
		expect(resolveChartBuilderFilterMode('legacy-mode', 'also-invalid')).toBe('include')
	})
})
