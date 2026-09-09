import { describe, expect, test } from 'vitest'
import {
	isDashboardChartTypeForSubject,
	getProDashboardChartTypeConfig,
	limitMultiChartItems,
	MAX_MULTI_CHART_SERIES,
	type ChartConfig
} from './types'

const chart = (index: number): ChartConfig => ({
	id: `chart-${index}`,
	kind: 'chart',
	subjectType: 'chain',
	chain: `Chain ${index}`,
	type: 'tvl'
})

describe('limitMultiChartItems', () => {
	test('keeps the first configured series and reuses already-bounded arrays', () => {
		const bounded = Array.from({ length: MAX_MULTI_CHART_SERIES }, (_, index) => chart(index))
		expect(limitMultiChartItems(bounded)).toBe(bounded)

		const oversized = [...bounded, chart(MAX_MULTI_CHART_SERIES)]
		expect(limitMultiChartItems(oversized)).toEqual(bounded)
	})
})

describe('getProDashboardChartTypeConfig', () => {
	test('narrows persisted chart type strings without coercing unknown values', () => {
		expect(getProDashboardChartTypeConfig('fees')).toMatchObject({ title: 'Fees', chartType: 'bar' })
		expect(getProDashboardChartTypeConfig('legacy-unknown')).toBeUndefined()
	})
})

test('validates chart types against the selected subject', () => {
	expect(isDashboardChartTypeForSubject('chain', 'stablecoins')).toBe(true)
	expect(isDashboardChartTypeForSubject('protocol', 'stablecoins')).toBe(false)
	expect(isDashboardChartTypeForSubject('protocol', 'unlocks')).toBe(true)
})
