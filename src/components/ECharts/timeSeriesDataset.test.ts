import { describe, expect, it } from 'vitest'
import {
	buildColumnarTimeSeriesDataset,
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	sliceTimestampDataset
} from './timeSeriesDataset'

describe('timeSeriesDataset', () => {
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
				{ timestamp: 1767225600000, Fees: 10, Revenue: 4 },
				{ timestamp: 1767312000000, Fees: null, Revenue: null }
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

	it('rejects reserved and duplicate dimensions', () => {
		expect(() => buildTimeSeriesDataset([[10, 2]], 'timestamp', 1000)).toThrow('reserved')
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

	it('creates rows compatible with ECharts object dataset cloning', () => {
		const dataset = buildColumnarTimeSeriesDataset(['2026-01-01'], [{ name: 'Value', data: [2] }], (date) =>
			Date.parse(`${date}T00:00:00Z`)
		)
		const row = dataset.source[0]

		expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
		expect(row.hasOwnProperty('timestamp')).toBe(true)
		expect(row.hasOwnProperty('Value')).toBe(true)
	})

	it('preserves a columnar series named __proto__ as an own row value', () => {
		const dataset = buildColumnarTimeSeriesDataset(['2026-01-01'], [{ name: '__proto__', data: [7] }], (date) =>
			Date.parse(`${date}T00:00:00Z`)
		)
		const row = dataset.source[0]

		expect(dataset.dimensions).toEqual(['timestamp', '__proto__'])
		expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
		expect(Object.hasOwn(row, '__proto__')).toBe(true)
		expect(row.__proto__).toBe(7)
	})

	it('fills declared missing values without revalidating numeric API values', () => {
		const dataset = buildColumnarTimeSeriesDataset(
			['2026-01-01', '2026-01-02', '2026-01-03'],
			[{ name: 'Fees', data: [undefined, Number.NaN, Number.POSITIVE_INFINITY] }],
			(date) => Date.parse(`${date}T00:00:00Z`),
			0
		)

		expect(dataset.source.map((row) => row.Fees)).toEqual([0, Number.NaN, Number.POSITIVE_INFINITY])
	})

	it('materializes only visible series and zero-fills sparse rows', () => {
		const input = {
			dimensions: ['timestamp', 'A', 'B', 'Hidden'],
			source: [
				{ timestamp: 1_000, A: 2, Hidden: 9 },
				{ timestamp: 2_000, B: 3, Hidden: 8 }
			]
		}

		expect(materializeZeroFilledDataset(input, ['A', 'B'])).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				{ timestamp: 1_000, A: 2, B: 0 },
				{ timestamp: 2_000, A: 0, B: 3 }
			]
		})
		expect(input.source[0]).toEqual({ timestamp: 1_000, A: 2, Hidden: 9 })
	})

	it('preserves a materialized series named __proto__ as an own row value', () => {
		const inputRow = JSON.parse('{"timestamp":1000,"__proto__":9}')
		const dataset = materializeZeroFilledDataset({ dimensions: ['timestamp', '__proto__'], source: [inputRow] }, [
			'__proto__'
		])
		const row = dataset.source[0]

		expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
		expect(Object.hasOwn(row, '__proto__')).toBe(true)
		expect(row.__proto__).toBe(9)
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
				{ timestamp: 10_000, Value: 2 },
				{ timestamp: 20_000, Value: null }
			]
		})
	})

	it('preserves a single series named __proto__ as an own row value', () => {
		const dataset = buildTimeSeriesDataset([[10, 2]], '__proto__', 1000)
		const row = dataset.source[0]

		expect(dataset.dimensions).toEqual(['timestamp', '__proto__'])
		expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
		expect(Object.hasOwn(row, '__proto__')).toBe(true)
		expect(row.__proto__).toBe(2)
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
			{ timestamp: 20, Value: 2 },
			{ timestamp: 20, Value: 3 }
		])
		expect(sliced.source[0]).toBe(dataset.source[1])
		expect(sliced.source[1]).toBe(dataset.source[2])
		expect(sliced.dimensions).toBe(dataset.dimensions)
		expect(sliceTimestampDataset(dataset, 0, 40)).toBe(dataset)
	})
})
