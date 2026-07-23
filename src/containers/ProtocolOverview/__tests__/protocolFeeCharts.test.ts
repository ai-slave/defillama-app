import { describe, expect, it } from 'vitest'
import { buildProtocolFeeChartPresentation } from '../protocolFeeCharts'

describe('buildProtocolFeeChartPresentation', () => {
	it('skips grouping work when no chart is selected', () => {
		expect(
			buildProtocolFeeChartPresentation({
				fees: [[1, 100]],
				revenue: [[1, 20]],
				holdersRevenue: [[1, 5]],
				selectedCharts: [],
				groupBy: 'daily'
			})
		).toEqual({ dataset: { source: [], dimensions: ['timestamp'] }, charts: [] })
	})

	it('builds only the selected base fee series', () => {
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

	it('preserves sparse starts between cumulative fee-family lines', () => {
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
			[1_000, 10, null],
			[2_000, 15, 3]
		])
		expect(result.charts.map((chart) => chart.type)).toEqual(['line', 'line'])
	})
})
