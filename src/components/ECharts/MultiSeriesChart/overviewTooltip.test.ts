import { describe, expect, it } from 'vitest'
import { createOverviewTooltipFormatter } from './overviewTooltip'

describe('overview tooltip', () => {
	it('preserves series order, omits zero gaps, and uses gas and unlock units', () => {
		const output = createOverviewTooltipFormatter({
			valueSymbol: '$',
			unlockTokenSymbol: 'TOKEN',
			seriesValueSymbols: new Map([['Gas Used', 'GAS']])
		})([
			{
				axisValue: 1_700_000_000_000,
				seriesName: 'TVL',
				marker: 'a',
				value: [1_700_000_000_000, 10],
				encode: { y: [1] }
			},
			{
				axisValue: 1_700_000_000_000,
				seriesName: 'Gap',
				marker: 'b',
				value: [1_700_000_000_000, 0],
				encode: { y: [1] }
			},
			{
				axisValue: 1_700_000_000_000,
				seriesName: 'Gas Used',
				marker: 'c',
				value: [1_700_000_000_000, 5],
				encode: { y: [1] }
			},
			{
				axisValue: 1_700_000_000_000,
				seriesName: 'Unlocks',
				marker: 'd',
				value: [1_700_000_000_000, 7],
				encode: { y: [1] }
			}
		])

		expect(output.indexOf('TVL')).toBeLessThan(output.indexOf('Gas Used'))
		expect(output).not.toContain('Gap')
		expect(output).toContain('GAS')
		expect(output).toContain('TOKEN')
	})

	it('keeps the Mcap to TVL derived row', () => {
		const output = createOverviewTooltipFormatter({ valueSymbol: '$', unlockTokenSymbol: '' })([
			{ axisValue: 1_700_000_000_000, seriesName: 'TVL', value: [1_700_000_000_000, 10], encode: { y: [1] } },
			{ axisValue: 1_700_000_000_000, seriesName: 'Mcap', value: [1_700_000_000_000, 25], encode: { y: [1] } }
		])
		expect(output).toContain('Mcap/TVL')
		expect(output).toContain('2.50')
	})
})
