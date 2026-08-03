import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { areChartDataEqual, areChartsEqual } from '~/containers/LlamaAI/utils/chartComparison'

const chartSeries: ChartConfiguration['series'][number] = {
	name: 'Value',
	type: 'line',
	yAxisId: 'value',
	metricClass: 'stock',
	dataMapping: { xField: 'timestamp', yField: 'value' },
	styling: { color: '#123456' }
}

const chart = {
	id: 'chart-1',
	type: 'line',
	title: 'Chart',
	description: '',
	axes: {
		x: { field: 'timestamp', label: 'Date', type: 'time' },
		yAxes: [{ id: 'value', fields: ['value'], label: 'USD', position: 'left' }]
	},
	series: [chartSeries],
	dataTransformation: { timeField: 'timestamp', metrics: ['value'] },
	displayOptions: {
		canStack: false,
		canShowPercentage: false,
		canShowCumulative: false,
		supportsGrouping: true
	}
} satisfies ChartConfiguration

describe('areChartsEqual', () => {
	it('compares the complete nested chart configuration', () => {
		expect(areChartsEqual([chart], [structuredClone(chart)])).toBe(true)
		expect(
			areChartsEqual(
				[chart],
				[{ ...structuredClone(chart), displayOptions: { ...chart.displayOptions, defaultStacked: true } }]
			)
		).toBe(false)
		expect(
			areChartsEqual(
				[chart],
				[
					{
						...structuredClone(chart),
						series: [{ ...structuredClone(chartSeries), styling: { color: '#abcdef' } }]
					}
				]
			)
		).toBe(false)
	})
})

describe('areChartDataEqual', () => {
	it('treats equivalent keyed chart payloads as equal', () => {
		const rows = [{ date: '2026-01-01', value: 1 }]

		expect(areChartDataEqual({ chart_1: rows }, { chart_1: rows })).toBe(true)
		expect(areChartDataEqual({ chart_1: rows }, { chart_1: [{ date: '2026-01-01', value: 1 }] })).toBe(true)
		expect(areChartDataEqual({ chart_1: rows }, { chart_1: [{ date: '2026-01-01', value: 2 }] })).toBe(false)
	})

	it('compares tuple rows used by scatter and pie chart adapters', () => {
		expect(areChartDataEqual({ scatter: [[1, 2, 'Aave', 'aave']] }, { scatter: [[1, 2, 'Aave', 'aave']] })).toBe(true)
	})

	it('does not treat rows with different undefined keys as equal', () => {
		expect(areChartDataEqual({ chart_1: [{ a: undefined }] }, { chart_1: [{ b: undefined }] })).toBe(false)
	})
})
