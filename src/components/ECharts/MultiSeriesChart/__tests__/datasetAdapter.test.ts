import { describe, expect, test } from 'vitest'
import { prepareMultiSeriesDataset } from '../datasetAdapter'

describe('prepareMultiSeriesDataset', () => {
	test('keeps every logical dimension available to CSV while filtering rendered series', () => {
		const source = [
			[1000, 2, 3],
			[2000, 4, 5]
		]
		const prepared = prepareMultiSeriesDataset(
			{
				dimensions: ['timestamp', 'A', 'B'],
				source
			},
			[
				{ type: 'line', name: 'A', encode: { x: 'timestamp', y: 'A' } },
				{ type: 'line', name: 'B', encode: { x: 'timestamp', y: 'B' } }
			]
		)

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'A', 'B'])
		expect(prepared.dimensions).toEqual([
			{ name: '__dimension_0', displayName: 'timestamp' },
			{ name: '__dimension_1', displayName: 'A' },
			{ name: '__dimension_2', displayName: 'B' }
		])
		expect(prepared.source).toBe(source)
		expect(prepared.charts).toMatchObject([
			{ name: 'A', encode: { x: 0, y: 1 } },
			{ name: 'B', encode: { x: 0, y: 2 } }
		])
	})

	test('keeps numeric positions and source identity when display labels are duplicated', () => {
		const source = [[1000, 2, 3]]
		const prepared = prepareMultiSeriesDataset({ dimensions: ['timestamp', 'timestamp', 'B'], source }, [
			{ type: 'line', name: 'timestamp', encode: { x: 0, y: 1 } }
		])

		expect(prepared.logicalDimensions).toEqual(['timestamp', 'timestamp', 'B'])
		expect(prepared.source).toBe(source)
		expect(prepared.charts[0].encode).toEqual({ x: 0, y: 1 })
	})
})
