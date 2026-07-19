import { describe, expect, it } from 'vitest'
import { buildBridgedInflowsChartData } from './inflowChart'

describe('buildBridgedInflowsChartData', () => {
	it('keeps missing token observations sparse and drops unselected fields', () => {
		const result = buildBridgedInflowsChartData(
			[
				{ date: 1, USDC: 10, ignored: 100 },
				{ date: 2, USDT: 20 }
			],
			['USDC', 'USDT']
		)

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'USDC', 'USDT'],
			source: [
				{ timestamp: 1_000, USDC: 10 },
				{ timestamp: 2_000, USDT: 20 }
			]
		})
		expect(Object.hasOwn(result.dataset.source[0], 'USDT')).toBe(false)
		expect(Object.hasOwn(result.dataset.source[1], 'USDC')).toBe(false)
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'USDC',
				encode: { x: 'timestamp', y: 'USDC' },
				stack: 'tokenInflows',
				large: false
			},
			{
				type: 'bar',
				name: 'USDT',
				encode: { x: 'timestamp', y: 'USDT' },
				stack: 'tokenInflows',
				large: false
			}
		])
	})
})
