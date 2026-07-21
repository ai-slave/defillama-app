import { describe, expect, it } from 'vitest'
import { buildBridgedInflowsChartData } from './inflowChart'

describe('buildBridgedInflowsChartData', () => {
	it('keeps missing token observations sparse and drops unselected fields', () => {
		const inflows = [
			{ date: 1, USDC: 10, ignored: 100 },
			{ date: 2, USDT: -20 }
		]
		const result = buildBridgedInflowsChartData(inflows, ['USDC', 'USDT'])

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'USDC', 'USDT'],
			source: [
				[1_000, 10, undefined],
				[2_000, undefined, -20]
			]
		})
		expect(result.dataset.source[0][2]).toBeUndefined()
		expect(result.dataset.source[1][1]).toBeUndefined()
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'USDC',
				encode: { x: 0, y: 1 },
				stack: 'tokenInflows',
				large: false
			},
			{
				type: 'bar',
				name: 'USDT',
				encode: { x: 0, y: 2 },
				stack: 'tokenInflows',
				large: false
			}
		])
		for (const chart of result.charts) expect(chart.encode.y).toBeGreaterThan(0)
		expect(inflows).toEqual([
			{ date: 1, USDC: 10, ignored: 100 },
			{ date: 2, USDT: -20 }
		])
	})

	it('returns a dimensioned empty dataset for no selected tokens', () => {
		expect(buildBridgedInflowsChartData([{ date: 1, USDC: 10 }], [])).toEqual({
			dataset: { dimensions: ['timestamp'], source: [[1_000]] },
			charts: []
		})
	})
})
