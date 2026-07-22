import { describe, expect, it } from 'vitest'
import { buildTimeSeriesChart } from './timeSeriesBuilder'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('buildTimeSeriesChart', () => {
	it('returns an empty chart spec for empty series input', () => {
		expect(buildTimeSeriesChart({ kind: 'periodBars', groupBy: 'weekly', series: [] })).toEqual({
			dataset: { source: [], dimensions: ['timestamp'] },
			charts: []
		})
	})

	it('sums values for periodBars buckets', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'periodBars',
				groupBy: 'weekly',
				series: [
					{
						name: 'Fees',
						color: '#111111',
						stack: 'volume',
						points: [
							[toMs(2024, 1, 15), 10],
							[toMs(2024, 1, 17), 5],
							[toMs(2024, 1, 22), 30]
						]
					}
				]
			})
		).toEqual({
			dataset: {
				source: [
					[toMs(2024, 1, 21), 15],
					[toMs(2024, 1, 28), 30]
				],
				dimensions: ['timestamp', 'Fees']
			},
			charts: [
				{
					type: 'bar',
					name: 'Fees',
					encode: { x: 0, y: 1 },
					stack: 'volume',
					color: '#111111',
					large: false
				}
			]
		})
	})

	it('keeps the last value for periodLines buckets', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'periodLines',
				groupBy: 'monthly',
				series: [
					{
						name: 'TVL',
						color: '#222222',
						points: [
							[toMs(2024, 3, 1), 10],
							[toMs(2024, 3, 15), 20],
							[toMs(2024, 3, 31), 30]
						]
					}
				]
			})
		).toEqual({
			dataset: {
				source: [],
				dimensions: ['timestamp', 'TVL']
			},
			charts: [
				{
					type: 'line',
					name: 'TVL',
					encode: { x: 0, y: 1 },
					color: '#222222',
					data: [[toMs(2024, 3, 1), 30]]
				}
			]
		})
	})

	it('builds cumulative lines without bucketting timestamps', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'cumulativeLines',
				series: [
					{
						name: 'Inflows',
						color: '#333333',
						points: [
							[toMs(2024, 1, 1), 10],
							[toMs(2024, 1, 2), 5],
							[toMs(2024, 1, 3), 15]
						]
					}
				]
			})
		).toEqual({
			dataset: {
				source: [
					[toMs(2024, 1, 1), 10],
					[toMs(2024, 1, 2), 15],
					[toMs(2024, 1, 3), 30]
				],
				dimensions: ['timestamp', 'Inflows']
			},
			charts: [
				{
					type: 'line',
					name: 'Inflows',
					encode: { x: 0, y: 1 },
					color: '#333333'
				}
			]
		})
	})

	it('fills missing series values with null in dense rows', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'periodBars',
				groupBy: 'daily',
				series: [
					{
						name: 'A',
						color: '#111111',
						stack: 'asset',
						points: [[toMs(2024, 1, 1), 10]]
					},
					{
						name: 'B',
						color: '#222222',
						stack: 'asset',
						points: [[toMs(2024, 1, 2), 20]]
					}
				]
			})
		).toEqual({
			dataset: {
				source: [
					[toMs(2024, 1, 1), 10, null],
					[toMs(2024, 1, 2), null, 20]
				],
				dimensions: ['timestamp', 'A', 'B']
			},
			charts: [
				{
					type: 'bar',
					name: 'A',
					encode: { x: 0, y: 1 },
					stack: 'asset',
					color: '#111111',
					large: false
				},
				{
					type: 'bar',
					name: 'B',
					encode: { x: 0, y: 2 },
					stack: 'asset',
					color: '#222222',
					large: false
				}
			]
		})
	})

	it('keeps mixed sparse line buckets independent while retaining the last value per series', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'periodLines',
				groupBy: 'weekly',
				series: [
					{
						name: 'TVL',
						color: '#111111',
						points: [
							[toMs(2024, 1, 15), 10],
							[toMs(2024, 1, 17), 12],
							[toMs(2024, 1, 29), 30]
						]
					},
					{
						name: 'Price',
						color: '#222222',
						points: [
							[toMs(2024, 1, 22), 20],
							[toMs(2024, 1, 24), 22]
						]
					}
				]
			}).charts.map((chart) => chart.data)
		).toEqual([
			[
				[toMs(2024, 1, 21), 12],
				[toMs(2024, 2, 4), 30]
			],
			[[toMs(2024, 1, 28), 22]]
		])
	})

	it('preserves input order for dimensions and charts', () => {
		const result = buildTimeSeriesChart({
			kind: 'periodBars',
			groupBy: 'daily',
			series: [
				{
					name: 'Second',
					color: '#222222',
					stack: 'asset',
					points: [[toMs(2024, 1, 1), 2]]
				},
				{
					name: 'First',
					color: '#111111',
					stack: 'asset',
					points: [[toMs(2024, 1, 1), 1]]
				}
			]
		})

		expect(result.dataset.dimensions).toEqual(['timestamp', 'Second', 'First'])
		expect(result.charts.map((item) => item.name)).toEqual(['Second', 'First'])
	})

	it('sums duplicate timestamps before applying cumulative totals', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'cumulativeLines',
				series: [
					{
						name: 'Inflows',
						color: '#333333',
						points: [
							[toMs(2024, 1, 1), 10],
							[toMs(2024, 1, 1), 5],
							[toMs(2024, 1, 2), 7]
						]
					}
				]
			}).dataset.source
		).toEqual([
			[toMs(2024, 1, 1), 15],
			[toMs(2024, 1, 2), 22]
		])
	})

	it('carries cumulative totals across shared timestamps so lines do not gap', () => {
		expect(
			buildTimeSeriesChart({
				kind: 'cumulativeLines',
				series: [
					{
						name: 'Bitcoin',
						color: '#f97316',
						points: [
							[toMs(2024, 1, 1), 10],
							[toMs(2024, 1, 3), 5]
						]
					},
					{
						name: 'Ethereum',
						color: '#2563eb',
						points: [[toMs(2024, 1, 2), 7]]
					}
				]
			}).dataset.source
		).toEqual([
			[toMs(2024, 1, 1), 10, 0],
			[toMs(2024, 1, 2), 10, 7],
			[toMs(2024, 1, 3), 15, 7]
		])
	})

	it('throws for duplicate series names', () => {
		expect(() =>
			buildTimeSeriesChart({
				kind: 'periodBars',
				groupBy: 'daily',
				series: [
					{ name: 'A', color: '#111111', stack: 'asset', points: [[toMs(2024, 1, 1), 1]] },
					{ name: 'A', color: '#222222', stack: 'asset', points: [[toMs(2024, 1, 2), 2]] }
				]
			})
		).toThrow('Duplicate series name "A" is not allowed')
	})

	it('does not mutate input series or point tuples', () => {
		const points = [
			[toMs(2024, 1, 1), 2],
			[toMs(2024, 1, 1), 3],
			[toMs(2024, 1, 2), 4]
		] as const
		const input = {
			kind: 'cumulativeLines',
			series: [{ name: 'Inflows', color: '#111111', points }]
		} as const
		const before = structuredClone(input)

		buildTimeSeriesChart(input)

		expect(input).toEqual(before)
		expect(input.series[0].points).toBe(points)
	})
})
