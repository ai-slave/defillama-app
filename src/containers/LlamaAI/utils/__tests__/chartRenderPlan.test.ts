import { describe, expect, test } from 'vitest'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import { adaptPieChartData } from '~/containers/LlamaAI/utils/chartAdapters/pie'
import { deriveCapabilities, type ChartViewState } from '~/containers/LlamaAI/utils/chartCapabilities'
import { buildRenderPlan } from '~/containers/LlamaAI/utils/chartRenderPlan'

const state: ChartViewState = {
	stacked: false,
	percentage: false,
	cumulative: false,
	grouping: 'day',
	showHallmarks: false,
	showLabels: false,
	logScale: false
}

describe('LlamaAI chart render plan', () => {
	test('does not print the config axis labels as y-axis names', () => {
		const config = {
			id: 'multi-axis',
			type: 'combo',
			title: 'Protocol metrics',
			description: '',
			axes: {
				x: { field: 'date', label: 'Date', type: 'time' },
				yAxes: [
					{ id: 'tvl', fields: ['tvl'], label: 'TVL', position: 'left' },
					{ id: 'apy', fields: ['apy'], label: 'APY', position: 'right' }
				]
			},
			series: [
				{
					name: 'TVL',
					type: 'line',
					yAxisId: 'tvl',
					metricClass: 'stock',
					dataMapping: { xField: 'date', yField: 'tvl' },
					styling: {}
				},
				{
					name: 'APY',
					type: 'line',
					yAxisId: 'apy',
					metricClass: 'stock',
					dataMapping: { xField: 'date', yField: 'apy' },
					styling: {}
				}
			],
			dataTransformation: { timeField: 'date', metrics: ['tvl', 'apy'] },
			displayOptions: {
				canStack: false,
				canShowPercentage: false,
				canShowCumulative: false,
				supportsGrouping: false
			}
		} satisfies ChartConfiguration
		const adapted = adaptCartesianChartData(config, [{ date: Date.UTC(2026, 0, 1), tvl: 100, apy: 5 }])
		const plan = buildRenderPlan(config, adapted, state, deriveCapabilities(config, adapted))
		if (plan.rendererKind !== 'cartesian') throw new Error('Expected Cartesian render plan')

		const yAxis = plan.rendererProps.chartOptions?.yAxis
		if (!Array.isArray(yAxis)) throw new Error('Expected multiple configured axes')
		expect(yAxis.map((axis) => axis.name)).toEqual([undefined, undefined])
	})

	test('draws a pie up to the series cap with Others while its CSV keeps every slice', () => {
		const config = {
			id: 'fees-share',
			type: 'pie',
			title: 'Fees share',
			description: '',
			axes: {
				x: { field: 'protocol', label: 'Protocol', type: 'category' },
				yAxes: [{ id: 'fees', fields: ['fees'], label: 'Fees', position: 'left' }]
			},
			series: [
				{
					name: 'Fees',
					type: 'bar',
					yAxisId: 'fees',
					metricClass: 'flow',
					dataMapping: { xField: 'protocol', yField: 'fees' },
					styling: {}
				}
			],
			dataTransformation: { timeField: 'protocol', metrics: ['fees'] },
			displayOptions: {
				canStack: false,
				canShowPercentage: false,
				canShowCumulative: false,
				supportsGrouping: false
			}
		} satisfies ChartConfiguration
		const rows: Array<{ protocol: string; fees: number }> = []
		for (let rank = 0; rank < CHART_SERIES_LIMIT + 2; rank++) rows.push({ protocol: `P${rank}`, fees: 100 - rank })
		const adapted = adaptPieChartData(config, rows)
		const plan = buildRenderPlan(config, adapted, state, deriveCapabilities(config, adapted))
		if (plan.rendererKind !== 'pie') throw new Error('Expected pie render plan')

		expect(plan.rendererProps.chartData).toHaveLength(CHART_SERIES_LIMIT + 1)
		expect(plan.rendererProps.chartData.at(-1)?.name).toBe('Others')
		expect(plan.exportModel?.csvRows).toHaveLength(CHART_SERIES_LIMIT + 3)
	})
})
