import { describe, expect, test } from 'vitest'
import { buildProtocolFeeChartPresentation, rankBreakdownNames } from '../protocolFeeCharts'

describe('buildProtocolFeeChartPresentation', () => {
	test('builds only the selected base fee series', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [[1, 100]],
			revenue: [[1, 20]],
			holdersRevenue: [[1, 5]],
			selectedCharts: ['Fees', 'Holders Revenue'],
			groupBy: 'daily'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Fees', 'Holders Revenue'],
			source: [[0, 100, 5]]
		})
		expect(result.charts).toMatchObject([
			{ type: 'bar', name: 'Fees', stack: 'Fees' },
			{ type: 'bar', name: 'Holders Revenue', stack: 'Holders Revenue' }
		])
	})

	test('preserves sparse starts between cumulative fee-family lines', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [
				[1, 10],
				[2, 5]
			],
			revenue: [[2, 3]],
			holdersRevenue: [],
			selectedCharts: ['Fees', 'Revenue'],
			groupBy: 'cumulative'
		})

		expect(result.dataset.source).toEqual([
			[1000, 10, null],
			[2000, 15, 3]
		])
		expect(result.charts.map((chart) => chart.type)).toEqual(['line', 'line'])
	})
})

test('ranks breakdown names by their total over the whole history', () => {
	expect(
		rankBreakdownNames([
			[1, { 'Spot Fees': 5, 'Perp Fees': 3 }],
			[2, { 'Perp Fees': 4, 'Builder Code Fees': 1 }]
		])
	).toEqual(['Perp Fees', 'Spot Fees', 'Builder Code Fees'])
})
