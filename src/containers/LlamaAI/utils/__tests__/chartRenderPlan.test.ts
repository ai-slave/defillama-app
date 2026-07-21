import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import { adaptHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
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
	it('keeps Cartesian config labels hidden while preserving multi-axis positions', () => {
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

		expect(plan.rendererProps.chartOptions?.xAxis).toBeUndefined()
		expect(plan.rendererProps.chartOptions?.grid).toBeUndefined()
		const yAxis = plan.rendererProps.chartOptions?.yAxis
		if (!Array.isArray(yAxis)) throw new Error('Expected multiple configured axes')
		expect(yAxis.map((axis) => axis.position)).toEqual(['left', 'right'])
		expect(yAxis.every((axis) => !('name' in axis))).toBe(true)
	})

	it('keeps horizontal-bar config labels out of renderer axis props', () => {
		const config = {
			id: 'hbar',
			type: 'hbar',
			title: 'Fees by protocol',
			description: '',
			axes: {
				x: { field: 'protocol', label: 'Protocol', type: 'category' },
				yAxes: [{ id: 'fees', fields: ['fees'], label: 'Fees', position: 'left' }]
			},
			series: [
				{
					name: 'Fees',
					type: 'hbar',
					yAxisId: 'fees',
					metricClass: 'flow',
					dataMapping: { xField: 'protocol', yField: 'fees' },
					styling: {}
				}
			],
			dataTransformation: { timeField: '', metrics: ['fees'] },
			displayOptions: {
				canStack: false,
				canShowPercentage: false,
				canShowCumulative: false,
				supportsGrouping: false
			}
		} satisfies ChartConfiguration
		const adapted = adaptHBarChartData(config, [{ protocol: 'Aave', fees: 10 }])
		const plan = buildRenderPlan(config, adapted, state, deriveCapabilities(config, adapted))
		if (plan.rendererKind !== 'hbar') throw new Error('Expected horizontal-bar render plan')

		expect(plan.rendererProps).not.toHaveProperty('categoryAxisLabel')
		expect(plan.rendererProps).not.toHaveProperty('valueAxisLabel')
	})
})
