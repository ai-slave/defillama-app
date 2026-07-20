import { describe, expect, it } from 'vitest'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from './chartBuilderSeries'

const color = (name: string, fallback?: string) => fallback ?? `color:${name}`

describe('buildChartBuilderSeriesView', () => {
	it('classifies stock metrics separately from flow metrics', () => {
		expect(isChartBuilderSnapshotMetric('tvl')).toBe(true)
		expect(isChartBuilderSnapshotMetric('stablecoins')).toBe(true)
		expect(isChartBuilderSnapshotMetric('open-interest')).toBe(true)
		expect(isChartBuilderSnapshotMetric('fees')).toBe(false)
	})

	it('groups ascending flows by sum and snapshots by last value', () => {
		const series = [
			{
				name: 'A',
				data: [
					[Date.UTC(2024, 0, 1) / 1e3, 10],
					[Date.UTC(2024, 0, 2) / 1e3, 20]
				] as [number, number][]
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

		expect(flow.dataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), 'series-0': 30 }])
		expect(snapshot.dataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), 'series-0': 20 }])
		expect(flow.charts[0]).toMatchObject({ type: 'bar', stack: 'total' })
		expect(snapshot.charts[0]).toMatchObject({ type: 'line', stack: 'total' })
	})

	it('converts aligned ascending series to rows and calculates percentages once', () => {
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
			dimensions: ['timestamp', 'series-0', 'series-1'],
			source: [
				{ timestamp: 1_000, 'series-0': 25, 'series-1': 75 },
				{ timestamp: 2_000, 'series-0': 0, 'series-1': 100 },
				{ timestamp: 3_000, 'series-0': 100, 'series-1': 0 }
			]
		})
		expect(result.charts).toEqual([
			{ type: 'line', name: 'A', encode: { x: 'timestamp', y: 'series-0' }, color: 'color:A' },
			{ type: 'line', name: 'B', encode: { x: 'timestamp', y: 'series-1' }, color: '#123456' }
		])
	})

	it('preserves special external series names as display identities', () => {
		const result = buildChartBuilderSeriesView({
			series: [{ name: '__proto__', data: [[1, 10]] }],
			useLastValue: false,
			displayAs: 'timeSeries',
			chartType: 'line',
			resolveColor: color
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'series-0'],
			source: [{ timestamp: 1_000, 'series-0': 10 }]
		})
		expect(result.charts[0]).toMatchObject({ name: '__proto__', encode: { y: 'series-0' } })
	})

	it('keeps the reserved timestamp series name separate from the x-axis dimension', () => {
		const result = buildChartBuilderSeriesView({
			series: [{ name: 'timestamp', data: [[1, 10]] }],
			useLastValue: false,
			displayAs: 'timeSeries',
			chartType: 'line',
			resolveColor: color
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'series-0'],
			source: [{ timestamp: 1_000, 'series-0': 10 }]
		})
		expect(result.charts[0]).toMatchObject({ name: 'timestamp', encode: { x: 'timestamp', y: 'series-0' } })
	})
})
