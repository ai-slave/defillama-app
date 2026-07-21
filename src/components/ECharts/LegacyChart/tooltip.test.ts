import { describe, expect, it } from 'vitest'
import { createAggregateTooltipFormatter } from './tooltip'

describe('legacy aggregate tooltip', () => {
	it('reads encoded reserved-name values', () => {
		const output = createAggregateTooltipFormatter({ valueSymbol: '$' })([
			{
				seriesName: 'hasOwnProperty',
				data: [1700000000000, 111, 222],
				value: [1700000000000, 111, 222],
				encode: { x: [0], y: [2] }
			}
		])

		expect(output).toContain('$222')
		expect(output).not.toContain('$111')
	})

	it('keeps an explicit Others aggregate last and reconciles the total', () => {
		const timestamp = 1700000000000
		const output = createAggregateTooltipFormatter({ valueSymbol: '$' })([
			{ seriesName: 'Others', data: { timestamp, Others: 30 } },
			{ seriesName: 'Protocol', data: { timestamp, Protocol: 70 } }
		])

		expect(output.indexOf('Others')).toBeGreaterThan(output.indexOf('Protocol'))
		expect(output.indexOf('Total')).toBeLessThan(output.indexOf('Protocol'))
		expect(output).toContain('margin-top:6px')
		expect(output).toContain('$100')
	})
})
