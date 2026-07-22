import { describe, expect, it } from 'vitest'
import {
	buildColumnarTimeSeriesDataset,
	buildSparseTimeSeriesDataset,
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	sliceTimestampDataset
} from './timeSeriesDataset'

describe('timeSeriesDataset', () => {
	it('merges independently timed sparse series once and sorts shared Map output', () => {
		expect(
			buildSparseTimeSeriesDataset([
				{
					name: 'TVL',
					data: [
						[3_000, 12],
						[5_000, null]
					]
				},
				{
					name: 'Fees',
					data: [
						[1_000, 2],
						[3_000, 3]
					]
				}
			])
		).toEqual({
			dimensions: ['timestamp', 'TVL', 'Fees'],
			source: [
				[1_000, null, 2],
				[3_000, 12, 3],
				[5_000, null, null]
			]
		})
	})

	it('builds columnar data directly into canonical rows', () => {
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
				[1767225600000, 10, 4],
				[1767312000000, null, null]
			]
		})
	})

	it('does not mutate columnar dates or series', () => {
		const dates = ['2026-01-01', '2026-01-02'] as const
		const series = [
			{ name: 'Fees', data: [10, undefined] },
			{ name: 'Revenue', data: [4, null] }
		] as const
		const before = structuredClone({ dates, series })

		buildColumnarTimeSeriesDataset(dates, series, (date) => Date.parse(`${date}T00:00:00Z`))

		expect({ dates, series }).toEqual(before)
	})

	it('rejects duplicate display dimensions', () => {
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

	it('fills declared missing values without revalidating numeric API values', () => {
		const dataset = buildColumnarTimeSeriesDataset(
			['2026-01-01', '2026-01-02', '2026-01-03'],
			[{ name: 'Fees', data: [undefined, Number.NaN, Number.POSITIVE_INFINITY] }],
			(date) => Date.parse(`${date}T00:00:00Z`),
			0
		)

		expect(dataset.source.map((row) => row[1])).toEqual([0, Number.NaN, Number.POSITIVE_INFINITY])
	})

	it('materializes only visible series and zero-fills sparse rows', () => {
		const input = {
			dimensions: ['timestamp', 'A', 'B', 'Hidden'],
			source: [
				[1_000, 2, undefined, 9],
				[2_000, undefined, 3, 8]
			]
		}

		expect(materializeZeroFilledDataset(input, ['A', 'B'])).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[1_000, 2, 0],
				[2_000, 0, 3]
			]
		})
		expect(input.source[0]).toEqual([1_000, 2, undefined, 9])
	})

	it('converts second timestamps once and preserves null values', () => {
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

	it('slices duplicate boundaries inclusively without copying row objects', () => {
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
