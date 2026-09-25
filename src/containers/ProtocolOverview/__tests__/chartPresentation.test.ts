import { describe, expect, test } from 'vitest'
import { buildChainChartPresentation } from '~/containers/ChainOverview/chartPresentation'
import { buildProtocolChartPresentation, shouldHideProtocolDataZoom } from '../chartPresentation'

const data: Array<[number, number | null]> = [[Date.UTC(2026, 8, 20), 40]]

describe('active address series names', () => {
	test('call grouped active addresses a daily average on protocol and chain charts', () => {
		const protocol = (groupBy: 'daily' | 'weekly') =>
			buildProtocolChartPresentation({
				chartData: { 'Active Addresses': data, 'New Addresses': data },
				chartColors: {},
				groupBy,
				rangeHallmarks: null,
				isThemeDark: false,
				themeText: '#000'
			}).charts.map((chart) => chart.name)
		const chain = (groupBy: 'daily' | 'monthly') =>
			buildChainChartPresentation({ 'Active Addresses': data, 'New Addresses': data }, groupBy).charts.map(
				(chart) => chart.name
			)

		expect(protocol('weekly')).toEqual(['Active Addresses (daily average)', 'New Addresses'])
		expect(chain('monthly')).toEqual(['Active Addresses (daily average)', 'New Addresses'])
		expect(protocol('daily')).toEqual(['Active Addresses', 'New Addresses'])
		expect(chain('daily')).toEqual(['Active Addresses', 'New Addresses'])
	})
})

describe('buildProtocolChartPresentation', () => {
	const present = (
		chartData: Parameters<typeof buildProtocolChartPresentation>[0]['chartData'],
		options: { groupBy?: 'daily' | 'cumulative'; rangeHallmarks?: Array<[[number, number], string]> } = {}
	) =>
		buildProtocolChartPresentation({
			chartData,
			chartColors: {},
			groupBy: options.groupBy ?? 'daily',
			rangeHallmarks: options.rangeHallmarks ?? null,
			isThemeDark: false,
			themeText: '#000'
		})

	test('keeps each series on its own timestamps, null gaps included', () => {
		const { charts, dataset } = present({
			TVL: [
				[1000, 10],
				[2500, null],
				[3000, 12]
			],
			Fees: [[2000, 5]]
		})
		expect(charts.map((chart) => [chart.name, chart.data])).toEqual([
			[
				'TVL',
				[
					[1000, 10],
					[2500, null],
					[3000, 12]
				]
			],
			['Fees', [[2000, 5]]]
		])
		expect(dataset.source).toEqual([])
	})

	test('draws flow metrics as bars, and as lines when cumulative', () => {
		const flow: Array<[number, number]> = [[1000, 2]]
		expect(present({ TVL: flow, Fees: flow }).charts.map((chart) => chart.type)).toEqual(['line', 'bar'])
		expect(present({ TVL: flow, Fees: flow }, { groupBy: 'cumulative' }).charts.map((chart) => chart.type)).toEqual([
			'line',
			'line'
		])
	})

	test('attaches range hallmarks to the first series, bar or line', () => {
		const { charts } = present(
			{ Fees: [[1000, 2]], TVL: [[1000, 10]] },
			{ rangeHallmarks: [[[1000, 3000], 'Migration']] }
		)
		expect(charts.map((chart) => chart.markArea?.data ?? null)).toEqual([
			[[{ name: 'Migration', xAxis: 1000 }, { xAxis: 3000 }]],
			null
		])
	})

	test('shares one axis per metric kind: Mcap with FDV, price and TVL apart', () => {
		const point: Array<[number, number]> = [[1000, 1]]
		const { charts, allYAxis } = present({ 'Token Price': point, Mcap: point, FDV: point, TVL: point })
		expect(charts.map((chart) => [chart.name, chart.yAxisIndex])).toEqual([
			['Token Price', 0],
			['Mcap', 1],
			['FDV', 1],
			['TVL', 2]
		])
		expect(allYAxis).toEqual([
			['Token Price', undefined],
			['Mcap', 1],
			['TVL', 2]
		])
	})
})

test('hides data zoom when asked or when no series has two points to zoom across', () => {
	expect(shouldHideProtocolDataZoom({ TVL: [[1000, 10]], Fees: [[2000, 5]] }, false)).toBe(true)
	expect(
		shouldHideProtocolDataZoom(
			{
				TVL: [
					[1000, 10],
					[2000, 12]
				]
			},
			false
		)
	).toBe(false)
	expect(
		shouldHideProtocolDataZoom(
			{
				TVL: [
					[1000, 10],
					[2000, 12]
				]
			},
			true
		)
	).toBe(true)
})
