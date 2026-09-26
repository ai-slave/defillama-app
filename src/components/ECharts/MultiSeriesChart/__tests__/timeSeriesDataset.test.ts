import { describe, expect, test } from 'vitest'
import {
	buildColumnarTimeSeriesDataset,
	buildSparseTimeSeriesDataset,
	buildTimeSeriesDataset
} from '../timeSeriesDataset'

describe('timeSeriesDataset', () => {
	test('merges independently timed sparse series once and sorts shared Map output', () => {
		expect(
			buildSparseTimeSeriesDataset([
				{
					name: 'TVL',
					data: [
						[3000, 12],
						[5000, null]
					]
				},
				{
					name: 'Fees',
					data: [
						[1000, 2],
						[3000, 3]
					]
				}
			])
		).toEqual({
			dimensions: ['timestamp', 'TVL', 'Fees'],
			source: [
				[1000, null, 2],
				[3000, 12, 3],
				[5000, null, null]
			]
		})
	})

	test('builds columnar data directly into canonical rows', () => {
		const dataset = buildColumnarTimeSeriesDataset(
			['2026-01-01', '2026-01-02'],
			[
				{ name: 'Fees', data: [10, undefined] },
				{ name: 'Revenue', data: [4, null] }
			],
			(date) => Date.parse(`${date}T00:00:00Z`)
		)

		expect(dataset).toEqual({
			dimensions: ['timestamp', 'Fees', 'Revenue'],
			source: [
				[1_767_225_600_000, 10, 4],
				[1_767_312_000_000, null, null]
			]
		})
	})

	test('rejects duplicate display dimensions', () => {
		expect(() =>
			buildColumnarTimeSeriesDataset(
				['2026-01-01'],
				[
					{ name: 'Fees', data: [10] },
					{ name: 'Fees', data: [20] }
				],
				(date) => Date.parse(`${date}T00:00:00Z`)
			)
		).toThrow('Duplicate series name')
	})

	test('fills missing values with the declared missing value', () => {
		const dataset = buildColumnarTimeSeriesDataset(
			['2026-01-01', '2026-01-02'],
			[{ name: 'Fees', data: [undefined, 5] }],
			(date) => Date.parse(`${date}T00:00:00Z`),
			0
		)

		expect(dataset.source.map((row) => row[1])).toEqual([0, 5])
	})

	test('converts second timestamps once and preserves null values', () => {
		expect(
			buildTimeSeriesDataset(
				[
					[10, 2],
					[20, null]
				],
				'Value',
				1000
			)
		).toEqual({
			dimensions: ['timestamp', 'Value'],
			source: [
				[10_000, 2],
				[20_000, null]
			]
		})
	})
})
