import { describe, expect, test } from 'vitest'
import { limitRwaHorizontalBarData, toRwaMultiSeriesChartDataset } from '../chartDataset'

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
	test('sorts the bars, drops non-positive values and folds the overflow into Others', () => {
		const items = [
			{ name: 'Zero', value: 0 },
			{ name: 'Negative', value: -3 },
			{ name: 'Others', value: 5 },
			{ name: 'Tie', value: 11 },
			...Array.from({ length: 11 }, (_, index) => ({ name: `Asset ${index + 1}`, value: index + 1 }))
		]
		expect(limitRwaHorizontalBarData(items, { sort: true })).toEqual([
			{ name: 'Asset 11', value: 11 },
			{ name: 'Tie', value: 11 },
			{ name: 'Asset 10', value: 10 },
			{ name: 'Asset 9', value: 9 },
			{ name: 'Asset 8', value: 8 },
			{ name: 'Asset 7', value: 7 },
			{ name: 'Asset 6', value: 6 },
			{ name: 'Asset 5', value: 5 },
			{ name: 'Others', value: 5 + 4 + 3 + 2 + 1 }
		])
	})
})
