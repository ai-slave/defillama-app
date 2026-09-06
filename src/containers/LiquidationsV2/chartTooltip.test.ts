import { describe, expect, test } from 'vitest'
import { getLiquidationsTooltipHtml } from './chartTooltip'

describe('liquidations chart tooltip', () => {
	test('keeps the header, input order, markers, values, and total', () => {
		const output = getLiquidationsTooltipHtml(
			[
				{
					axisValue: 2000,
					seriesName: 'Aave',
					marker: '<span>A</span>',
					value: [2000, 60],
					encode: { x: [0], y: [1] }
				},
				{
					axisValue: 2000,
					seriesName: 'Spark',
					marker: '<span>S</span>',
					data: [2000, 40],
					encode: { x: [0], y: [1] }
				}
			],
			'usd',
			'WBTC'
		)

		expect(output).toContain('Liq Price')
		expect(output).toContain('$2,000')
		expect(output.indexOf('<span>A</span>')).toBeLessThan(output.indexOf('<span>S</span>'))
		expect(output.indexOf('Aave')).toBeLessThan(output.indexOf('Spark'))
		expect(output).toContain('Total')
		expect(output).toContain('$100')
	})

	test('omits sparse, missing, and zero rows', () => {
		const output = getLiquidationsTooltipHtml(
			[
				{ axisValue: 2000, seriesName: 'Missing', value: [2000, null], encode: { x: [0], y: [1] } },
				{ axisValue: 2000, seriesName: 'Zero', value: [2000, 0], encode: { x: [0], y: [1] } },
				{ axisValue: 2000, seriesName: 'Aave', value: [2000, 2], encode: { x: [0], y: [1] } }
			],
			'amount',
			'WBTC'
		)

		expect(output).not.toContain('Missing')
		expect(output).not.toContain('Zero')
		expect(output).toContain('Aave')
		expect(output).toContain('2 WBTC')
	})

	test('normalizes the single tooltip item shape used by touch interactions', () => {
		const output = getLiquidationsTooltipHtml(
			{ axisValue: 0.5, seriesName: 'Aave', marker: 'A', value: [0.5, 0.25], encode: { x: [0], y: [1] } },
			'usd',
			'WBTC'
		)

		expect(output).toContain('$0.5')
		expect(output).toContain('$0.25')
		expect(output).toContain('Aave')
	})
})
