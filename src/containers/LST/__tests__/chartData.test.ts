import { describe, expect, test } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import {
	buildActiveLstChartData,
	buildLstBreakdownChartData,
	buildLstInflowsData,
	buildLstInflowsSeriesData
} from '../chartData'

describe('LST chart data helpers', () => {
	test('constructs only the selected view model', () => {
		const common = {
			areaChartData: [{ date: 1, Lido: 100 }],
			inflowsChartData: { 1: { Lido: -5 } },
			groupBy: 'daily' as const,
			tokens: ['Lido'],
			lsdColors: { Lido: '#111' },
			barChartStacks: { Lido: 'A' }
		}

		expect(buildActiveLstChartData({ ...common, view: 'breakdown' })).toMatchObject({
			kind: 'breakdown',
			data: { dataset: { source: [[1000, 100]] } }
		})
		expect(buildActiveLstChartData({ ...common, view: 'inflows' })).toMatchObject({
			kind: 'inflows',
			data: { dataset: { source: [[0, -5]] } }
		})
	})

	test('builds cumulative inflows by token', () => {
		const result = buildLstInflowsData({
			inflowsChartData: {
				1: { Lido: 10, RocketPool: 5 },
				2: { Lido: 3, RocketPool: -2 }
			},
			groupBy: 'cumulative'
		})

		expect(result).toEqual([
			[
				1,
				new Map([
					['Lido', 10],
					['RocketPool', 5]
				])
			],
			[
				2,
				new Map([
					['Lido', 13],
					['RocketPool', 3]
				])
			]
		])
	})

	test('carries cumulative token totals across independently timed protocol histories', () => {
		const result = buildLstInflowsData({
			inflowsChartData: {
				1: { Lido: 10 },
				2: { RocketPool: 5 },
				3: { Lido: -2 }
			},
			groupBy: 'cumulative'
		})

		expect(result).toEqual([
			[1, new Map([['Lido', 10]])],
			[
				2,
				new Map([
					['RocketPool', 5],
					['Lido', 10]
				])
			],
			[
				3,
				new Map([
					['Lido', 8],
					['RocketPool', 5]
				])
			]
		])
	})

	test('groups non-cumulative inflows by selected period', () => {
		const day1 = 1_704_067_200
		const day2 = 1_704_153_600
		const bucket = getBucketTimestampSec(day1, 'weekly')
		const result = buildLstInflowsData({
			inflowsChartData: {
				[day2]: { Lido: 7 },
				[day1]: { Lido: 3, RocketPool: 1 }
			},
			groupBy: 'weekly'
		})

		expect(result).toEqual([
			[
				bucket,
				new Map([
					['Lido', 10],
					['RocketPool', 1]
				])
			]
		])
	})

	test('builds breakdown and inflow datasets with stable token chart configs', () => {
		const tokens = ['Lido', 'RocketPool']
		const lsdColors = { Lido: '#111', RocketPool: '#222' }

		expect(
			buildLstBreakdownChartData({
				areaChartData: [{ date: 1, Lido: 75, RocketPool: 25 }],
				tokens,
				lsdColors
			})
		).toEqual({
			dataset: {
				source: [[1000, 75, 25]],
				dimensions: ['timestamp', 'Lido', 'RocketPool']
			},
			charts: [
				{ type: 'line', name: 'Lido', encode: { x: 0, y: 1 }, color: '#111', stack: 'breakdown' },
				{
					type: 'line',
					name: 'RocketPool',
					encode: { x: 0, y: 2 },
					color: '#222',
					stack: 'breakdown'
				}
			]
		})

		const inflowsSeriesData = buildLstInflowsSeriesData({
			inflowsData: [
				[
					1,
					new Map([
						['Lido', 10],
						['RocketPool', -1]
					])
				]
			],
			tokens,
			lsdColors,
			barChartStacks: { Lido: 'A', RocketPool: 'A' }
		})

		expect(inflowsSeriesData.dataset).toEqual({
			source: [[1000, 10, -1]],
			dimensions: ['timestamp', 'Lido', 'RocketPool']
		})
		expect(inflowsSeriesData.barCharts).toEqual([
			{
				type: 'bar',
				name: 'Lido',
				encode: { x: 0, y: 1 },
				color: '#111',
				stack: 'A',
				large: false
			},
			{
				type: 'bar',
				name: 'RocketPool',
				encode: { x: 0, y: 2 },
				color: '#222',
				stack: 'A',
				large: false
			}
		])
		expect(inflowsSeriesData.cumulativeCharts).toEqual([
			{
				type: 'line',
				name: 'Lido',
				encode: { x: 0, y: 1 },
				color: '#111'
			},
			{
				type: 'line',
				name: 'RocketPool',
				encode: { x: 0, y: 2 },
				color: '#222'
			}
		])
	})

	test('keeps sparse token rows sparse instead of materializing false zeroes', () => {
		const inflowsData = [
			[1, new Map([['Lido', 10]])],
			[2, new Map([['RocketPool', 5]])]
		] satisfies Array<[number, Map<string, number>]>
		const result = buildLstInflowsSeriesData({
			inflowsData,
			tokens: ['Lido', 'RocketPool'],
			lsdColors: { Lido: '#111', RocketPool: '#222' },
			barChartStacks: { Lido: 'A', RocketPool: 'A' }
		})

		expect(result.dataset.source).toEqual([
			[1000, 10, undefined],
			[2000, undefined, 5]
		])
		for (const chart of [...result.barCharts, ...result.cumulativeCharts]) {
			expect(chart.encode.y).toBeGreaterThan(0)
		}
		expect(inflowsData).toEqual([
			[1, new Map([['Lido', 10]])],
			[2, new Map([['RocketPool', 5]])]
		])
	})
})
