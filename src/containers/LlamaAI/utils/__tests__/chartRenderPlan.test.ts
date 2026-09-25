import { describe, expect, test } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
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
})
