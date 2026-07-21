import { describe, expect, it } from 'vitest'
import { buildAlignedCartesianChartModel, buildSparseCartesianChartModel } from './model'

describe('cartesian chart models', () => {
	it('builds aligned rows without intermediate tuples', () => {
		expect(
			buildAlignedCartesianChartModel(
				[2, 3],
				[
					{ name: 'TVL', type: 'line', values: [10, 11] },
					{ name: 'Fees', type: 'bar', values: [1, undefined], stack: 'flows' }
				]
			)
		).toMatchObject({
			dataset: {
				dimensions: ['timestamp', 'TVL', 'Fees'],
				source: [
					[2000, 10, 1],
					[3000, 11, null]
				]
			},
			charts: [
				{ name: 'TVL', encode: { x: 0, y: 1 } },
				{ name: 'Fees', encode: { x: 0, y: 2 }, stack: 'flows' }
			]
		})
	})

	it('aligns sparse series chronologically', () => {
		const model = buildSparseCartesianChartModel([
			{ name: 'A', type: 'line', connectNulls: true, data: [[3, 30]] },
			{
				name: 'B',
				type: 'line',
				data: [
					[1, 10],
					[3, 31]
				]
			}
		])
		expect(model.dataset.source).toEqual([
			[1000, undefined, 10],
			[3000, 30, 31]
		])
		expect(model.charts[0].connectNulls).toBe(true)
	})

	it('uses the same canonical output for already aligned sparse series', () => {
		const model = buildSparseCartesianChartModel([
			{
				name: 'A',
				type: 'line',
				data: [
					[1, 10],
					[2, 20]
				]
			},
			{
				name: 'B',
				type: 'bar',
				data: [
					[1, 11],
					[2, null]
				]
			}
		])
		expect(model.dataset.source).toEqual([
			[1000, 10, 11],
			[2000, 20, null]
		])
	})

	it('preserves category insertion order', () => {
		const model = buildSparseCartesianChartModel(
			[
				{
					name: 'Count',
					type: 'bar',
					data: [
						['10–20', 2],
						['0–10', 1]
					]
				}
			],
			{ xDimension: 'category', timestampMultiplier: 1 }
		)
		expect(model.dataset.source).toEqual([
			['10–20', 2],
			['0–10', 1]
		])
	})

	it('uses positional encodes so display names never become ECharts keys', () => {
		const model = buildAlignedCartesianChartModel(['A'], [{ name: 'constructor', type: 'bar', values: [2] }], {
			xDimension: 'bin',
			timestampMultiplier: 1
		})

		expect(model.dataset).toEqual({
			dimensions: ['bin', 'constructor'],
			source: [['A', 2]]
		})
		expect(model.charts[0]).toMatchObject({ name: 'constructor', encode: { x: 0, y: 1 } })
	})
})
