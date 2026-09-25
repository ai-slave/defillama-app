import { describe, expect, test } from 'vitest'
import {
	buildColumnarTimeSeriesDataset,
	buildSparseTimeSeriesDataset,
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	sliceTimestampDataset,
	type TimestampDataset
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

	test('materializes only visible series and zero-fills sparse rows', () => {
		const input: TimestampDataset = {
			dimensions: ['timestamp', 'A', 'B', 'Hidden'],
			source: [
				[1000, 2, undefined, 9],
				[2000, undefined, 3, 8]
			]
		}

		expect(materializeZeroFilledDataset(input, ['A', 'B'])).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[1000, 2, 0],
				[2000, 0, 3]
			]
		})
		expect(input.source[0]).toEqual([1000, 2, undefined, 9])
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

	test('slices duplicate boundaries inclusively without copying row objects', () => {
		const dataset = buildTimeSeriesDataset(
			[
				[10, 1],
				[20, 2],
				[20, 3],
				[30, 4]
			],
			'Value',
			1
		)
		const sliced = sliceTimestampDataset(dataset, 20, 20)

		expect(sliced.source).toEqual([
			[20, 2],
			[20, 3]
		])
		expect(sliced.source[0]).toBe(dataset.source[1])
		expect(sliced.source[1]).toBe(dataset.source[2])
		expect(sliced.dimensions).toBe(dataset.dimensions)
		expect(sliceTimestampDataset(dataset, 0, 40)).toBe(dataset)
	})
})
