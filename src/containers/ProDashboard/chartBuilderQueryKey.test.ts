import { describe, expect, it } from 'vitest'
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
	it('includes each canonical filter dimension independently', () => {
		expect(getChartBuilderQueryKey(config).slice(-4)).toEqual(['exclude', 'include', 'exclude', 'include'])
	})
})
