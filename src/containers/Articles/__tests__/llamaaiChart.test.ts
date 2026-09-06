import { describe, expect, test } from 'vitest'
import { isChartConfiguration, isChartData, type ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { LLAMAAI_CHART_MAX_DATA_BYTES, downsampleChartData } from '../llamaaiChart'

const validConfig = {
	id: 'c1',
	type: 'bar',
	title: 'Uniswap Weekly Fees',
	description: '',
	axes: {
		x: { field: 'ts', label: 'Timestamp', type: 'time' },
		yAxes: [{ id: 'value', fields: ['value'], label: 'Value', position: 'left' }]
	},
	series: [
		{
			name: 'Value',
			type: 'bar',
			yAxisId: 'value',
			metricClass: 'flow',
			dataMapping: { xField: 'ts', yField: 'value' },
			styling: {}
		}
	],
	dataTransformation: { timeField: 'ts', metrics: ['value'] }
} satisfies ChartConfiguration

describe('isChartConfiguration', () => {
	test('accepts a plausible chart config and returns it', () => {
		expect(isChartConfiguration(validConfig)).toBe(true)
	})

	test('rejects malformed persisted configs instead of blessing partial objects', () => {
		expect(isChartConfiguration(null)).toBe(false)
		expect(isChartConfiguration('bar')).toBe(false)
		expect(isChartConfiguration({ ...validConfig, type: 7 })).toBe(false)
		expect(isChartConfiguration({ ...validConfig, id: undefined })).toBe(false)
		expect(isChartConfiguration({ id: 'partial', type: 'bar', title: 'Partial' })).toBe(false)
	})
})

describe('isChartData', () => {
	test('accepts flat and keyed arrays while rejecting malformed keyed payloads', () => {
		expect(isChartData([{ ts: 1, value: 2 }])).toBe(true)
		expect(isChartData({ chart: [{ ts: 1, value: 2 }] })).toBe(true)
		expect(isChartData({ chart: { ts: 1, value: 2 } })).toBe(false)
	})
})

describe('downsampleChartData', () => {
	test('leaves small series untouched', () => {
		const rows = Array.from({ length: 100 }, (_, i) => ({ ts: i, value: i }))
		expect(downsampleChartData(rows, 2000)).toBe(rows)
	})

	test('downsamples an array series to the cap, keeping first and last points', () => {
		const rows = Array.from({ length: 10_000 }, (_, i) => ({ ts: i, value: i }))
		const out = downsampleChartData(rows, 2000)
		expect(out.length).toBeLessThanOrEqual(2000)
		expect(out.at(0)?.ts).toBe(0)
		expect(out.at(-1)?.ts).toBe(9999)
	})

	test('downsamples each series of a keyed record independently', () => {
		const data = {
			a: Array.from({ length: 5000 }, (_, i) => ({ ts: i, value: i })),
			b: Array.from({ length: 10 }, (_, i) => ({ ts: i, value: i }))
		}
		const out = downsampleChartData(data, 1000)
		expect(out.a?.length).toBeLessThanOrEqual(1000)
		expect(out.a?.at(-1)?.ts).toBe(4999)
		expect(out.b?.length).toBe(10)
	})

	test('exports a client cap below the 512KB server backstop', () => {
		expect(LLAMAAI_CHART_MAX_DATA_BYTES).toBeLessThan(512 * 1024)
	})
})
