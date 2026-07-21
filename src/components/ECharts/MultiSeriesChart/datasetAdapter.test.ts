import { describe, expect, it } from 'vitest'
import { prepareMultiSeriesDataset } from './datasetAdapter'

describe('prepareMultiSeriesDataset', () => {
	it('passes positional rows through and assigns private ECharts dimensions', () => {
		const source = [[1_000, 2, 3]]
		const prepared = prepareMultiSeriesDataset({ dimensions: ['timestamp', 'A', 'B'], source }, [
			{ type: 'line', name: 'A', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'B', encode: { x: 0, y: 2 } }
		])

		expect(prepared.source).toBe(source)
		expect(prepared.dimensions).toEqual(['__dimension_0', '__dimension_1', '__dimension_2'])
		expect(prepared.charts.map((chart) => chart.encode)).toEqual([
			{ x: 0, y: 1 },
			{ x: 0, y: 2 }
		])
	})

	it('projects selected positional columns and remaps string encodes', () => {
		const prepared = prepareMultiSeriesDataset(
			{
				dimensions: ['timestamp', 'A', 'B'],
				source: [
					[1_000, 2, 3],
					[2_000, 4, 5]
				]
			},
			[
				{ type: 'line', name: 'A', encode: { x: 'timestamp', y: 'A' } },
				{ type: 'line', name: 'B', encode: { x: 'timestamp', y: 'B' } }
			],
			new Set(['B'])
		)

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'B'])
		expect(prepared.source).toEqual([
			[1_000, 3],
			[2_000, 5]
		])
		expect(prepared.charts).toMatchObject([
			{ name: 'A', encode: { x: 0, y: -1 } },
			{ name: 'B', encode: { x: 0, y: 1 } }
		])
	})

	it('projects numeric positions even when display labels are duplicated', () => {
		const prepared = prepareMultiSeriesDataset(
			{ dimensions: ['timestamp', 'timestamp', 'B'], source: [[1_000, 2, 3]] },
			[{ type: 'line', name: 'timestamp', encode: { x: 0, y: 1 } }],
			new Set(['timestamp'])
		)

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'timestamp'])
		expect(prepared.source).toEqual([[1_000, 2]])
		expect(prepared.charts[0].encode).toEqual({ x: 0, y: 1 })
	})
})
