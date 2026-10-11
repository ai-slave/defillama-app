import { describe, expect, test } from 'vitest'
import { getRwaChartTotalLabel } from '../chartAggregation'
import { getRwaPerpsChartMetricSpec } from '../chartBreakdown'
import {
	isRwaTotalSeriesLabel,
	limitRwaHorizontalBarData,
	RWA_MAX_HORIZONTAL_BARS,
	toRwaMultiSeriesChartDataset
} from '../chartDataset'

describe('toRwaMultiSeriesChartDataset', () => {
	test('preserves dimension order, zero values, and missing values', () => {
		expect(
			toRwaMultiSeriesChartDataset({
				dimensions: ['timestamp', 'Beta', 'Alpha'],
				source: [
					{ timestamp: 1, Alpha: 10, Beta: 20 },
					{ timestamp: 2, Beta: 0 }
				]
			})
		).toEqual({
			dimensions: ['timestamp', 'Beta', 'Alpha'],
			source: [
				[1, 20, 10],
				[2, 0, null]
			]
		})
	})
})

describe('limitRwaHorizontalBarData', () => {
	test('sorts the bars, drops non-positive values and keeps up to the bar cap, the overflow folded into Others last', () => {
		const cap = RWA_MAX_HORIZONTAL_BARS
		const items = [
			{ name: 'Zero', value: 0 },
			{ name: 'Negative', value: -3 },
			{ name: 'Others', value: 5 },
			{ name: 'Tie', value: cap + 1 },
			...Array.from({ length: cap + 1 }, (_, index) => ({ name: `Asset ${index + 1}`, value: index + 1 }))
		]
		const bars = limitRwaHorizontalBarData(items, { sort: true })
		expect(bars).toHaveLength(cap)
		expect(bars.slice(0, 3)).toEqual([
			{ name: `Asset ${cap + 1}`, value: cap + 1 },
			{ name: 'Tie', value: cap + 1 },
			{ name: `Asset ${cap}`, value: cap }
		])
		expect(bars.slice(-2)).toEqual([
			{ name: 'Asset 4', value: 4 },
			{ name: 'Others', value: 5 + 3 + 2 + 1 }
		])
	})
})

describe('isRwaTotalSeriesLabel', () => {
	test('knows the Total line of every metric the charts draw, and no member named Total something', () => {
		for (const metric of ['activeMcap', 'onChainMcap', 'defiActiveTvl'] as const) {
			expect(isRwaTotalSeriesLabel(getRwaChartTotalLabel(metric))).toBe(true)
		}
		for (const metric of ['openInterest', 'volume', 'markets'] as const) {
			expect(isRwaTotalSeriesLabel(getRwaPerpsChartMetricSpec(metric).totalLabel)).toBe(true)
		}
		expect(isRwaTotalSeriesLabel('Total Crypto Market Cap ex-BTC')).toBe(false)
	})
})
