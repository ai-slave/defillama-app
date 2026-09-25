import { expect, test } from 'vitest'
import { buildApiUsageChartData, rankRoutesByTotal } from './apiUsageChart'

const colors = {
	routes: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
	others: 'others',
	split: '',
	muted: '',
	axis: '',
	tooltipBg: '',
	tooltipBorder: ''
}
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
	const { dataset, charts } = buildApiUsageChartData(stats, 3, allRoutes, allRoutes, colors, fetchedAt)
	expect(dataset).toEqual({
		dimensions: ['date', 'a', 'b', 'c', 'd', 'e', 'f', 'Others'],
		source: [
			[Date.UTC(2026, 6, 17), 0, 0, 0, 0, 0, 0, 0],
			[Date.UTC(2026, 6, 18), 0, 0, 0, 0, 0, 0, 0],
			[Date.UTC(2026, 6, 19), 7, 6, 5, 4, 3, 2, 1]
		]
	})
	expect(charts.map((chart) => [chart.name, chart.encode.y, chart.color])).toEqual([
		['a', 1, 'c1'],
		['b', 2, 'c2'],
		['c', 3, 'c3'],
		['d', 4, 'c4'],
		['e', 5, 'c5'],
		['f', 6, 'c6'],
		['Others', 7, 'others']
	])
})

test('charts only the selected routes and keeps each route on its ranked color', () => {
	const { dataset, charts } = buildApiUsageChartData(stats, 1, allRoutes, ['c', 'g'], colors, fetchedAt)
	expect(dataset).toEqual({ dimensions: ['date', 'c', 'g'], source: [[Date.UTC(2026, 6, 19), 5, 1]] })
	expect(charts.map((chart) => [chart.name, chart.color])).toEqual([
		['c', 'c3'],
		['g', 'c7']
	])
})

test('deselecting every route leaves an empty chart over the window', () => {
	const { dataset, charts } = buildApiUsageChartData(stats, 2, allRoutes, [], colors, fetchedAt)
	expect(dataset).toEqual({ dimensions: ['date'], source: [[Date.UTC(2026, 6, 18)], [Date.UTC(2026, 6, 19)]] })
	expect(charts).toEqual([])
})
