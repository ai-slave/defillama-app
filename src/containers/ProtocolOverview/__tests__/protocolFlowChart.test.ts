import { describe, expect, it } from 'vitest'
import { buildProtocolFlowChart, normalizeProtocolFlowChart } from '../protocolFlowChart'

describe('normalizeProtocolFlowChart', () => {
	it('normalizes numeric API seconds and trims only when a positive point exists', () => {
		expect(
			normalizeProtocolFlowChart(
				[
					[1, 0],
					[2, -1],
					[3, 2]
				],
				true
			)
		).toEqual([[3_000, 2]])

		expect(
			normalizeProtocolFlowChart(
				[
					[1, 0],
					[2, -1]
				],
				true
			)
		).toEqual([
			[1_000, 0],
			[2_000, -1]
		])
	})
})

describe('buildProtocolFlowChart', () => {
	const series = [
		{
			name: 'Fees',
			color: '#111111',
			stack: 'Fees',
			points: [
				[Date.UTC(2024, 0, 1), 2],
				[Date.UTC(2024, 0, 1), 3],
				[Date.UTC(2024, 0, 2), 4]
			] as const
		}
	]

	it('sums flow buckets and renders them as bars', () => {
		const result = buildProtocolFlowChart({ groupBy: 'daily', series })
		expect(result.dataset.source).toEqual([
			{ timestamp: Date.UTC(2024, 0, 1), Fees: 5 },
			{ timestamp: Date.UTC(2024, 0, 2), Fees: 4 }
		])
		expect(result.charts[0]).toMatchObject({ type: 'bar', name: 'Fees', stack: 'Fees' })
	})

	it('running-sums flows as lines without filling another sparse series', () => {
		const result = buildProtocolFlowChart({
			groupBy: 'cumulative',
			series: [
				series[0],
				{
					name: 'Revenue',
					color: '#222222',
					stack: 'Revenue',
					points: [[Date.UTC(2024, 0, 3), 7]]
				}
			]
		})

		expect(result.dataset.source).toEqual([
			{ timestamp: Date.UTC(2024, 0, 1), Fees: 5 },
			{ timestamp: Date.UTC(2024, 0, 2), Fees: 9 },
			{ timestamp: Date.UTC(2024, 0, 3), Revenue: 7 }
		])
		expect(result.charts.map((chart) => chart.type)).toEqual(['line', 'line'])
	})
})
