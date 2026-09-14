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
	test('clamps invalid maxBars to one bucket before limiting bars', () => {
		expect(
			limitRwaHorizontalBarData(
				[
					{ name: 'A', value: 3 },
					{ name: 'B', value: 2 },
					{ name: 'Others', value: 1 }
				],
				{ maxBars: 0 }
			)
		).toEqual([{ name: 'Others', value: 6 }])
	})
})
