import { describe, expect, test } from 'vitest'
import { getChartBuilderQueryKey } from '../chartBuilderQueryKey'
import type { ChartBuilderConfig } from '../types'

const config: ChartBuilderConfig['config'] = {
	metric: 'fees',
	mode: 'chains',
	chains: ['Ethereum'],
	categories: ['Dexs'],
	groupBy: 'protocol',
	limit: 10,
	chartType: 'stackedBar',
	displayAs: 'timeSeries',
	chainFilterMode: 'exclude',
	categoryFilterMode: 'include',
	chainCategoryFilterMode: 'exclude',
	protocolCategoryFilterMode: 'include'
}

describe('Pro dashboard chart-builder query identity', () => {
	test.each([
		'chainFilterMode',
		'categoryFilterMode',
		'chainCategoryFilterMode',
		'protocolCategoryFilterMode'
	] as const)('flipping only %s changes the data identity', (mode) => {
		const flipped = { ...config, [mode]: config[mode] === 'include' ? 'exclude' : 'include' }
		expect(getChartBuilderQueryKey(flipped)).not.toEqual(getChartBuilderQueryKey(config))
	})
})

test('hideOthers does not change the data identity', () => {
	expect(getChartBuilderQueryKey({ ...config, hideOthers: true })).toEqual(
		getChartBuilderQueryKey({ ...config, hideOthers: false })
	)
	expect(getChartBuilderQueryKey({ ...config, limit: 5 })).not.toEqual(getChartBuilderQueryKey(config))
})
