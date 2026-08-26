import { describe, expect, it } from 'vitest'
import {
	limitRwaHorizontalBarData,
	materializeRwaIndependentChartDataset,
	mergeRwaPositionalChartDatasets,
	toRwaMultiSeriesChartDataset
} from '../chartDataset'

describe('toRwaMultiSeriesChartDataset', () => {
	it('preserves dimension order, zero values, and missing values', () => {
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
	it('clamps invalid maxBars to one bucket before limiting bars', () => {
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

describe('mergeRwaPositionalChartDatasets', () => {
	it('keeps an independently timed overlay separate from aligned spot rows', () => {
		expect(
			mergeRwaPositionalChartDatasets(
				{
					dimensions: ['timestamp', 'Spot'],
					source: [
						[1, 10],
						[3, 30]
					]
				},
				{
					dimensions: ['timestamp', 'RWA Perps OI'],
					source: [
						[2, 20],
						[3, null]
					]
				}
			)
		).toEqual({
			dimensions: ['timestamp', 'Spot', 'RWA Perps OI'],
			source: [
				[1, 10],
				[3, 30]
			],
			independentSeries: [
				{
					name: 'RWA Perps OI',
					data: [
						[2, 20],
						[3, null]
					]
				}
			]
		})
	})

	it('materializes the RWA-only independent overlay only for export', () => {
		const dataset = mergeRwaPositionalChartDatasets(
			{
				dimensions: ['timestamp', 'Spot'],
				source: [
					[1, 10],
					[3, null]
				]
			},
			{
				dimensions: ['timestamp', 'RWA Perps OI'],
				source: [
					[2, 20],
					[3, null]
				]
			}
		)

		expect(materializeRwaIndependentChartDataset(dataset)).toEqual({
			dimensions: ['timestamp', 'Spot', 'RWA Perps OI'],
			source: [
				[1, 10, null],
				[2, null, 20],
				[3, null, null]
			]
		})
		expect(dataset.source).toEqual([
			[1, 10],
			[3, null]
		])
	})
})
