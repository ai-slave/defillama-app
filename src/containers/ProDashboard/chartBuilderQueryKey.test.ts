import { describe, expect, test } from 'vitest'
import { getChartBuilderQueryKey } from './chartBuilderQueryKey'
import type { ChartBuilderConfig } from './types'

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
	test('includes each canonical filter dimension independently', () => {
		expect(getChartBuilderQueryKey(config).slice(-4)).toEqual(['exclude', 'include', 'exclude', 'include'])
	})
})

test('hideOthers does not change the data identity', () => {
	expect(getChartBuilderQueryKey({ ...config, hideOthers: true })).toEqual(
		getChartBuilderQueryKey({ ...config, hideOthers: false })
	)
})
