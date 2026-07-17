import { describe, expect, it } from 'vitest'
import { LLAMAAI_CHART_MAX_DATA_BYTES, downsampleChartData, validateLlamaAIChartConfig } from '../llamaaiChart'

const validConfig = {
	id: 'c1',
	type: 'bar',
	title: 'Uniswap Weekly Fees',
	description: '',
	axes: { x: { field: 'ts' }, yAxes: [{ field: 'value' }] }
}

describe('validateLlamaAIChartConfig', () => {
	it('accepts a plausible chart config and returns it', () => {
		expect(validateLlamaAIChartConfig(validConfig)).toEqual(validConfig)
	})

	it('rejects non-objects and configs without a string type or id', () => {
		expect(validateLlamaAIChartConfig(null)).toBeNull()
		expect(validateLlamaAIChartConfig('bar')).toBeNull()
		expect(validateLlamaAIChartConfig({ ...validConfig, type: 7 })).toBeNull()
		expect(validateLlamaAIChartConfig({ ...validConfig, id: undefined })).toBeNull()
	})
})

describe('downsampleChartData', () => {
	it('leaves small series untouched', () => {
		const rows = Array.from({ length: 100 }, (_, i) => ({ ts: i, value: i }))
		expect(downsampleChartData(rows, 2000)).toBe(rows)
	})

	it('downsamples an array series to the cap, keeping first and last points', () => {
		const rows = Array.from({ length: 10000 }, (_, i) => ({ ts: i, value: i }))
		const out = downsampleChartData(rows, 2000) as Array<{ ts: number }>
		expect(out.length).toBeLessThanOrEqual(2000)
		expect(out[0].ts).toBe(0)
		expect(out[out.length - 1].ts).toBe(9999)
	})

	it('downsamples each series of a keyed record independently', () => {
		const data = {
			a: Array.from({ length: 5000 }, (_, i) => ({ ts: i, value: i })),
			b: Array.from({ length: 10 }, (_, i) => ({ ts: i, value: i }))
		}
		const out = downsampleChartData(data, 1000) as Record<string, Array<{ ts: number }>>
		expect(out.a.length).toBeLessThanOrEqual(1000)
		expect(out.a[out.a.length - 1].ts).toBe(4999)
		expect(out.b.length).toBe(10)
	})

	it('exports a client cap below the 512KB server backstop', () => {
		expect(LLAMAAI_CHART_MAX_DATA_BYTES).toBeLessThan(512 * 1024)
	})
})
