import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import type { ChartCapabilities, ChartViewState } from '../chartCapabilities'
import { buildControlsModel, deriveCapabilities, normalizeViewState } from '../chartCapabilities'

const capabilities: ChartCapabilities = {
	allowStack: true,
	allowPercentage: true,
	allowCumulative: false,
	allowGrouping: false,
	allowHallmarks: false,
	allowLabels: false,
	allowLogScale: true,
	logEligibleYAxes: [0],
	groupingOptions: []
}

const baseState: ChartViewState = {
	stacked: false,
	percentage: false,
	cumulative: false,
	grouping: 'day',
	showHallmarks: false,
	showLabels: false,
	logScale: true
}

function getCumulativeCapability(metricClass: 'flow' | 'stock') {
	const config = {
		id: `${metricClass}-bar`,
		type: 'bar',
		title: 'Metric',
		description: '',
		axes: {
			x: { field: 'date', label: 'Date', type: 'time' },
			yAxes: [{ id: 'value', fields: ['value'], label: 'Value', position: 'left' }]
		},
		series: [
			{
				name: 'Metric',
				type: 'bar',
				yAxisId: 'value',
				metricClass,
				dataMapping: { xField: 'date', yField: 'value' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'date', metrics: ['value'] },
		displayOptions: {
			canStack: false,
			canShowPercentage: false,
			canShowCumulative: true,
			supportsGrouping: false
		}
	} satisfies ChartConfiguration

	return deriveCapabilities(config, adaptCartesianChartData(config, [{ date: Date.UTC(2026, 0, 1), value: 10 }]))
}

describe('chartCapabilities', () => {
	it('offers cumulative mode for flow bars but not stock bars', () => {
		expect(getCumulativeCapability('flow').allowCumulative).toBe(true)
		expect(getCumulativeCapability('stock').allowCumulative).toBe(false)
	})

	it('hides log scale while percentage mode is active', () => {
		const state = normalizeViewState({ ...baseState, percentage: true }, capabilities)
		const controls = buildControlsModel('Chart', state, capabilities)

		expect(state.logScale).toBe(false)
		expect(controls.showLogScale).toBe(false)
	})

	it('keeps log scale available for non-percentage charts', () => {
		const state = normalizeViewState(baseState, capabilities)
		const controls = buildControlsModel('Chart', state, capabilities)

		expect(state.logScale).toBe(true)
		expect(controls.showLogScale).toBe(true)
	})

	it('disables and hides log scale while stacked mode is active', () => {
		const state = normalizeViewState({ ...baseState, stacked: true }, capabilities)
		const controls = buildControlsModel('Chart', state, capabilities)

		expect(state.logScale).toBe(false)
		expect(controls.showLogScale).toBe(false)
	})
})
