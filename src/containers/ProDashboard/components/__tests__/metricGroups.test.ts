import { describe, expect, test } from 'vitest'
import { getMetricUnitGroup, resolveSeriesAxisLayout } from '../metricGroups'

describe('getMetricUnitGroup', () => {
	test('treats dollar metrics as the usd group', () => {
		expect(getMetricUnitGroup('fees')).toBe('usd')
		expect(getMetricUnitGroup('holdersRevenue')).toBe('usd')
		expect(getMetricUnitGroup('revenue')).toBe('usd')
		expect(getMetricUnitGroup('tvl')).toBe('usd')
		expect(getMetricUnitGroup('gasUsed')).toBe('usd')
	})

	test('classifies percent, count and ratio metrics', () => {
		expect(getMetricUnitGroup('medianApy')).toBe('percent')
		expect(getMetricUnitGroup('txs')).toBe('count')
		expect(getMetricUnitGroup('activeUsers')).toBe('count')
		expect(getMetricUnitGroup('pfRatio')).toBe('ratio')
		expect(getMetricUnitGroup('psRatio')).toBe('ratio')
	})

	test('falls back to usd for unknown or missing metric types', () => {
		expect(getMetricUnitGroup(undefined)).toBe('usd')
		expect(getMetricUnitGroup('somethingNew')).toBe('usd')
	})
})

describe('resolveSeriesAxisLayout', () => {
	test('keeps two dollar metrics on a single shared axis', () => {
		const layout = resolveSeriesAxisLayout([{ metricType: 'fees' }, { metricType: 'holdersRevenue' }])

		expect(layout.needMultipleAxes).toBe(false)
		expect(layout.axisCount).toBe(1)
		expect(layout.seriesAxisIndexes).toEqual([0, 0])
	})

	test('splits axes when units genuinely differ', () => {
		const layout = resolveSeriesAxisLayout([{ metricType: 'fees' }, { metricType: 'activeUsers' }])

		expect(layout.needMultipleAxes).toBe(true)
		expect(layout.axisCount).toBe(2)
		expect(layout.axisUnitGroups).toEqual(['usd', 'count'])
		expect(layout.seriesAxisIndexes).toEqual([0, 1])
	})

	test('assigns same-unit series to the same axis regardless of order', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'fees' },
			{ metricType: 'medianApy' },
			{ metricType: 'revenue' }
		])

		expect(layout.axisUnitGroups).toEqual(['usd', 'percent'])
		expect(layout.axisCount).toBe(2)
		expect(layout.seriesAxisIndexes).toEqual([0, 1, 0])
	})

	test('caps the axis count at three even with four distinct unit groups', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'fees' },
			{ metricType: 'medianApy' },
			{ metricType: 'txs' },
			{ metricType: 'pfRatio' }
		])

		expect(layout.axisCount).toBe(3)
		expect(layout.seriesAxisIndexes).toEqual([0, 1, 2, 2])
	})

	test('honors explicit yAxisIndex even for same-unit series', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'tvl', yAxisIndex: 0 },
			{ metricType: 'tvl', yAxisIndex: 1 }
		])

		expect(layout.needMultipleAxes).toBe(true)
		expect(layout.axisCount).toBe(2)
		expect(layout.seriesAxisIndexes).toEqual([0, 1])
	})

	test('assigns units to sparse explicit axis indexes', () => {
		const layout = resolveSeriesAxisLayout([{ metricType: 'fees' }, { metricType: 'medianApy', yAxisIndex: 2 }])

		expect(layout.axisCount).toBe(3)
		expect(layout.seriesAxisIndexes).toEqual([0, 2])
		expect(layout.axisUnitGroups[0]).toBe('usd')
		expect(layout.axisUnitGroups[1]).toBeUndefined()
		expect(layout.axisUnitGroups[2]).toBe('percent')
	})

	test('uses a single axis for a single repeated metric', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'volume', magnitude: 1000 },
			{ metricType: 'volume', magnitude: 1_000_000 }
		])

		expect(layout.needMultipleAxes).toBe(false)
		expect(layout.axisCount).toBe(1)
	})

	test('keeps similarly scaled dollar metrics on one axis', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'fees', magnitude: 10_000_000 },
			{ metricType: 'holdersRevenue', magnitude: 50_000_000 }
		])

		expect(layout.needMultipleAxes).toBe(false)
		expect(layout.seriesAxisIndexes).toEqual([0, 0])
	})

	test('splits different dollar metrics whose magnitudes would flatten the smaller series', () => {
		const layout = resolveSeriesAxisLayout([
			{ metricType: 'tokenPrice', magnitude: 65_000 },
			{ metricType: 'tokenVolume', magnitude: 2_300_000_000 }
		])

		expect(layout.needMultipleAxes).toBe(true)
		expect(layout.axisUnitGroups).toEqual(['usd', 'usd'])
		expect(layout.seriesAxisIndexes).toEqual([0, 1])
	})
})
