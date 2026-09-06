import { describe, expect, test } from 'vitest'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from './chartBuilderSeries'

const color = (name: string, fallback?: string) => fallback ?? `color:${name}`

describe('buildChartBuilderSeriesView', () => {
	test('classifies stock metrics separately from flow metrics', () => {
		expect(isChartBuilderSnapshotMetric('tvl')).toBe(true)
		expect(isChartBuilderSnapshotMetric('stablecoins')).toBe(true)
		expect(isChartBuilderSnapshotMetric('open-interest')).toBe(true)
		expect(isChartBuilderSnapshotMetric('fees')).toBe(false)
	})

	test('groups ascending flows by sum and snapshots by last value', () => {
		const series = [
			{
				name: 'A',
				data: [
					[Date.UTC(2024, 0, 1) / 1e3, 10],
					[Date.UTC(2024, 0, 2) / 1e3, 20]
				] as Array<[number, number]>
			}
		]

		const flow = buildChartBuilderSeriesView({
			series,
			grouping: 'week',
			useLastValue: false,
			displayAs: 'timeSeries',
			chartType: 'stackedBar',
			resolveColor: color
		})
		const snapshot = buildChartBuilderSeriesView({
			series,
			grouping: 'week',
			useLastValue: true,
			displayAs: 'timeSeries',
			chartType: 'stackedArea',
			resolveColor: color
		})

		expect(flow.dataset.source).toEqual([[Date.UTC(2024, 0, 1), 30]])
		expect(snapshot.dataset.source).toEqual([[Date.UTC(2024, 0, 1), 20]])
		expect(flow.charts[0]).toMatchObject({ type: 'bar', stack: 'total' })
		expect(snapshot.charts[0]).toMatchObject({ type: 'line', stack: 'total' })
	})

	test('converts aligned ascending series to rows and calculates percentages once', () => {
		const result = buildChartBuilderSeriesView({
			series: [
				{
					name: 'A',
					data: [
						[1, 25],
						[2, 0],
						[3, 20]
					]
				},
				{
					name: 'B',
					data: [
						[1, 75],
						[2, 40],
						[3, 0]
					],
					color: '#123456'
				}
			],
			useLastValue: false,
			displayAs: 'percentage',
			chartType: 'line',
			resolveColor: color
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[1000, 25, 75],
				[2000, 0, 100],
				[3000, 100, 0]
			]
		})
		expect(result.charts).toEqual([
			{ type: 'line', name: 'A', encode: { x: 0, y: 1 }, color: 'color:A' },
			{ type: 'line', name: 'B', encode: { x: 0, y: 2 }, color: '#123456' }
		])
	})

	test('keeps the reserved timestamp series name separate from the x-axis dimension', () => {
		const result = buildChartBuilderSeriesView({
			series: [{ name: 'timestamp', data: [[1, 10]] }],
			useLastValue: false,
			displayAs: 'timeSeries',
			chartType: 'line',
			resolveColor: color
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'timestamp'],
			source: [[1000, 10]]
		})
		expect(result.charts[0]).toMatchObject({ name: 'timestamp', encode: { x: 0, y: 1 } })
	})
})
