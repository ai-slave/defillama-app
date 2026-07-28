import { describe, expect, it } from 'vitest'
import { buildAlignedCartesianChartModel, buildSparseCartesianChartModel } from './model'

describe('cartesian chart models', () => {
	it('builds aligned rows without intermediate tuples', () => {
		const model = buildAlignedCartesianChartModel(
			[2, 3],
			[
				{ name: 'TVL', type: 'line', values: [10, 11] },
				{ name: 'Fees', type: 'bar', values: [1, undefined], stack: 'flows' }
			]
		)
		expect(model).toMatchObject({
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
		expect(model.charts[0]).toEqual({ type: 'line', name: 'TVL', encode: { x: 0, y: 1 } })
	})

	it('keeps independently timed series positional so sibling timestamps do not create line gaps', () => {
		const model = buildSparseCartesianChartModel([
			{ name: 'A', type: 'line', connectNulls: true, data: [[3, 30]] },
			{
				name: 'B',
				type: 'line',
				data: [
					[3, 31],
					[1, 10]
				]
			}
		])
		expect(model.dataset.source).toEqual([])
		expect(model.charts.map((chart) => chart.data)).toEqual([
			[[3000, 30]],
			[
				[1000, 10],
				[3000, 31]
			]
		])
		expect(model.charts[0].connectNulls).toBe(true)
	})

	it('retains explicit null line points while omitting sibling-only timestamps', () => {
		const model = buildSparseCartesianChartModel([
			{
				name: 'TVL',
				type: 'line',
				data: [
					[1, 10],
					[2.5, null],
					[3, 12]
				]
			},
			{ name: 'Fees', type: 'bar', data: [[2, 5]] }
		])

		expect(model.charts[0].data).toEqual([
			[1000, 10],
			[2500, null],
			[3000, 12]
		])
		expect(model.charts[1].data).toEqual([[2000, 5]])
	})

	it('aligns mismatched calendars within a stack without changing unrelated lines', () => {
		const model = buildSparseCartesianChartModel([
			{
				name: 'A',
				type: 'bar',
				stack: 'total',
				data: [
					[1, 10],
					[3, 30]
				]
			},
			{
				name: 'B',
				type: 'bar',
				stack: 'total',
				data: [
					[2, 20],
					[3, 40]
				]
			},
			{
				name: 'TVL',
				type: 'line',
				data: [
					[1.5, 100],
					[3.5, 120]
				]
			}
		])

		expect(model.charts.map((chart) => chart.data)).toEqual([
			[
				[1000, 10],
				[2000, null],
				[3000, 30]
			],
			[
				[1000, null],
				[2000, 20],
				[3000, 40]
			],
			[
				[1500, 100],
				[3500, 120]
			]
		])
	})

	it('keeps explicit and missing stacked-line values as gaps on the stack calendar', () => {
		const model = buildSparseCartesianChartModel([
			{
				name: 'A',
				type: 'line',
				stack: 'total',
				data: [
					[1, 10],
					[3, null]
				]
			},
			{ name: 'B', type: 'line', stack: 'total', data: [[2, 20]] }
		])

		expect(model.charts[0].data).toEqual([
			[1000, 10],
			[2000, null],
			[3000, null]
		])
	})

	it('uses the same canonical output for already aligned sparse series', () => {
		const model = buildSparseCartesianChartModel([
			{
				name: 'A',
				type: 'line',
				data: [
					[2, 20],
					[1, 10]
				]
			},
			{
				name: 'B',
				type: 'bar',
				data: [
					[2, null],
					[1, 11]
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
