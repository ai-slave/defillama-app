import { expect, test } from 'vitest'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { buildApiUsageChartData, rankRoutesByTotal } from '../apiUsageChart'

const fetchedAt = Date.UTC(2026, 6, 19, 12)
const stats = [{ date: '2026-07-19', totalRequests: 28, routes: { a: 7, b: 6, c: 5, d: 4, e: 3, f: 2, g: 1 } }]
const allRoutes = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

test('ranks routes by total requests across days, breaking ties alphabetically', () => {
	expect(
		rankRoutesByTotal([
			{ date: '2026-07-18', totalRequests: 5, routes: { z: 3, y: 2 } },
			{ date: '2026-07-19', totalRequests: 4, routes: { y: 1, x: 3 } },
			{ date: '2026-07-20', totalRequests: 0 }
		])
	).toEqual(['x', 'y', 'z'])
})

test('fills days without requests across the window and groups routes past the top six into Others', () => {
	const { dataset, charts } = buildApiUsageChartData(stats, 3, allRoutes, allRoutes, fetchedAt)
	expect(dataset).toEqual({
		dimensions: ['timestamp', 'a', 'b', 'c', 'd', 'e', 'f', 'Others'],
		source: [
			[Date.UTC(2026, 6, 17), 0, 0, 0, 0, 0, 0, 0],
			[Date.UTC(2026, 6, 18), 0, 0, 0, 0, 0, 0, 0],
			[Date.UTC(2026, 6, 19), 7, 6, 5, 4, 3, 2, 1]
		]
	})
	expect(charts.map((chart) => [chart.name, chart.encode.y, chart.color])).toEqual([
		['a', 1, chartColor(0)],
		['b', 2, chartColor(1)],
		['c', 3, chartColor(2)],
		['d', 4, chartColor(3)],
		['e', 5, chartColor(4)],
		['f', 6, chartColor(5)],
		['Others', 7, OTHERS_COLOR]
	])
})

test('charts only the selected routes and keeps each route on its ranked color', () => {
	const { dataset, charts } = buildApiUsageChartData(stats, 1, allRoutes, ['c', 'g'], fetchedAt)
	expect(dataset).toEqual({ dimensions: ['timestamp', 'c', 'g'], source: [[Date.UTC(2026, 6, 19), 5, 1]] })
	expect(charts.map((chart) => [chart.name, chart.color])).toEqual([
		['c', chartColor(2)],
		['g', chartColor(6)]
	])
})

test('deselecting every route leaves an empty chart over the window', () => {
	const { dataset, charts } = buildApiUsageChartData(stats, 2, allRoutes, [], fetchedAt)
	expect(dataset).toEqual({ dimensions: ['timestamp'], source: [[Date.UTC(2026, 6, 18)], [Date.UTC(2026, 6, 19)]] })
	expect(charts).toEqual([])
})
