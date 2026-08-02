import { describe, expect, it } from 'vitest'
import { prepareMultiSeriesDataset, projectMultiSeriesDatasetForCharts } from './datasetAdapter'

describe('prepareMultiSeriesDataset', () => {
	it('passes positional rows through and assigns private ECharts dimensions', () => {
		const source = [[1_000, 2, 3]]
		const prepared = prepareMultiSeriesDataset({ dimensions: ['timestamp', 'A', 'B'], source }, [
			{ type: 'line', name: 'A', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'B', encode: { x: 0, y: 2 } }
		])

		expect(prepared.source).toBe(source)
		expect(prepared.dimensions).toEqual([
			{ name: '__dimension_0', displayName: 'timestamp' },
			{ name: '__dimension_1', displayName: 'A' },
			{ name: '__dimension_2', displayName: 'B' }
		])
		expect(prepared.charts.map((chart) => chart.encode)).toEqual([
			{ x: 0, y: 1 },
			{ x: 0, y: 2 }
		])
	})

	it('keeps selected-series history intact and remaps string encodes without copying rows', () => {
		const source = [
			[1_000, 2, 3],
			[2_000, 4, 5]
		]
		const prepared = prepareMultiSeriesDataset(
			{
				dimensions: ['timestamp', 'A', 'B'],
				source
			},
			[
				{ type: 'line', name: 'A', encode: { x: 'timestamp', y: 'A' } },
				{ type: 'line', name: 'B', encode: { x: 'timestamp', y: 'B' } }
			],
			new Set(['B'])
		)

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'A', 'B'])
		expect(prepared.dimensions).toEqual([
			{ name: '__dimension_0', displayName: 'timestamp' },
			{ name: '__dimension_1' },
			{ name: '__dimension_2', displayName: 'B' }
		])
		expect(prepared.source).toBe(source)
		expect(prepared.charts).toMatchObject([
			{ name: 'A', encode: { x: 0, y: 1 } },
			{ name: 'B', encode: { x: 0, y: 2 } }
		])
	})

	it('keeps numeric positions and source identity when display labels are duplicated', () => {
		const source = [[1_000, 2, 3]]
		const prepared = prepareMultiSeriesDataset({ dimensions: ['timestamp', 'timestamp', 'B'], source }, [
			{ type: 'line', name: 'timestamp', encode: { x: 0, y: 1 } }
		])

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'timestamp', 'B'])
		expect(prepared.source).toBe(source)
		expect(prepared.charts[0].encode).toEqual({ x: 0, y: 1 })
	})

	it('projects selected rows only at the explicit export boundary', () => {
		const dataset = {
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[1_000, 2, 3],
				[2_000, 4, 5]
			]
		}
		const projected = projectMultiSeriesDatasetForCharts(dataset, [{ type: 'line', name: 'B', encode: { x: 0, y: 2 } }])

		expect(projected).toEqual({
			dimensions: ['timestamp', 'B'],
			source: [
				[1_000, 3],
				[2_000, 5]
			]
		})
		expect(dataset.source).toEqual([
			[1_000, 2, 3],
			[2_000, 4, 5]
		])
	})
})
