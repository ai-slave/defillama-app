import { describe, expect, it } from 'vitest'
import { chartBuilderHasExactRemainder, normalizeChartBuilderConfig } from './chartBuilderCapabilities'
import type { ChartBuilderConfig } from './types'

const baseConfig = (overrides: Partial<ChartBuilderConfig['config']> = {}): ChartBuilderConfig['config'] => ({
	metric: 'tvl',
	mode: 'protocol',
	chainFilterMode: 'include',
	categoryFilterMode: 'include',
	chainCategoryFilterMode: 'include',
	protocolCategoryFilterMode: 'include',
	chains: [],
	categories: [],
	groupBy: 'protocol',
	limit: 10,
	chartType: 'stackedArea',
	displayAs: 'timeSeries',
	...overrides
})

describe('Chart Builder series capabilities', () => {
	it('marks all-protocol adapter chain series as exact Top N only', () => {
		expect(chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'fees', chains: [] })).toBe(false)
		expect(chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'chain-fees', protocol: 'All', chains: [] })).toBe(
			false
		)
	})

	it('keeps exact remainder controls for canonical totals and selected protocols', () => {
		expect(chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'tvl', chains: [] })).toBe(true)
		expect(
			chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'stablecoins', protocol: 'All', chains: ['Base'] })
		).toBe(true)
		expect(
			chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'fees', protocol: 'aave', chains: ['Base'] })
		).toBe(true)
		expect(chartBuilderHasExactRemainder({ mode: 'chains', metric: 'fees', chains: [] })).toBe(true)
	})

	it('marks filtered all-protocol TVL chain series as exact Top N only', () => {
		expect(chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'tvl', chains: ['Base'] })).toBe(false)
		expect(
			chartBuilderHasExactRemainder({ mode: 'protocol', metric: 'tvl', chains: [], chainCategories: ['Rollup'] })
		).toBe(false)
	})

	it('preserves a user-selected Top N view when the producer has an exact remainder', () => {
		const config = baseConfig({ protocol: 'aave', metric: 'fees', hideOthers: true })
		expect(normalizeChartBuilderConfig(config)).toBe(config)
	})

	it('forces Top N and time-series display when no exact remainder exists', () => {
		expect(
			normalizeChartBuilderConfig(baseConfig({ metric: 'fees', hideOthers: false, displayAs: 'percentage' }))
		).toMatchObject({ hideOthers: true, displayAs: 'timeSeries' })
	})

	it('normalizes metrics that the selected mode cannot produce', () => {
		expect(
			normalizeChartBuilderConfig(baseConfig({ mode: 'chains', metric: 'stablecoins', chartType: 'line' }))
		).toMatchObject({ metric: 'tvl', chartType: 'stackedArea' })
		expect(normalizeChartBuilderConfig(baseConfig({ metric: 'chain-fees', protocol: 'aave' })).protocol).toBeUndefined()
	})
})
