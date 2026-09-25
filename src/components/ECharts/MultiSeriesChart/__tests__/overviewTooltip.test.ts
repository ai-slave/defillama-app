import { describe, expect, test } from 'vitest'
import { createOverviewTooltipFormatter } from '../overviewTooltip'

describe('overview tooltip', () => {
	test('preserves series order, renders known zeroes, and uses gas and unlock units', () => {
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
		expect(output).toContain('Gap&nbsp;&nbsp;$0')
		expect(output).toContain('GAS')
		expect(output).toContain('TOKEN')
	})

	test('keeps the Mcap to TVL derived row', () => {
		const output = createOverviewTooltipFormatter({ valueSymbol: '$', unlockTokenSymbol: '' })([
			{ axisValue: 1_700_000_000_000, seriesName: 'TVL', value: [1_700_000_000_000, 10], encode: { y: [1] } },
			{ axisValue: 1_700_000_000_000, seriesName: 'Mcap', value: [1_700_000_000_000, 25], encode: { y: [1] } }
		])
		expect(output).toContain('Mcap/TVL')
		expect(output).toContain('2.50')
	})

	test('renders a zero Mcap ratio when TVL is positive', () => {
		const output = createOverviewTooltipFormatter({ valueSymbol: '$', unlockTokenSymbol: '' })([
			{ axisValue: 1_700_000_000_000, seriesName: 'TVL', value: [1_700_000_000_000, 10], encode: { y: [1] } },
			{ axisValue: 1_700_000_000_000, seriesName: 'Mcap', value: [1_700_000_000_000, 0], encode: { y: [1] } }
		])
		expect(output).toContain('Mcap/TVL&nbsp;&nbsp;0.00')
	})

	test.each([0, -10])('does not derive Mcap/TVL for non-positive TVL %s', (tvl) => {
		const output = createOverviewTooltipFormatter({ valueSymbol: '$', unlockTokenSymbol: '' })([
			{ axisValue: 1_700_000_000_000, seriesName: 'TVL', value: [1_700_000_000_000, tvl], encode: { y: [1] } },
			{ axisValue: 1_700_000_000_000, seriesName: 'Mcap', value: [1_700_000_000_000, 25], encode: { y: [1] } }
		])
		expect(output).not.toContain('Mcap/TVL')
	})

	test('renders more than ten heterogeneous metrics independently with their own units', () => {
		const timestamp = 1_700_000_000_000
		const seriesValueSymbols = new Map<string, string>()
		const items = Array.from({ length: 12 }, (_, index) => {
			const seriesName = `Metric ${index + 1}`
			if (index % 2 === 0) seriesValueSymbols.set(seriesName, '$')
			return {
				axisValue: timestamp,
				seriesName,
				marker: `${index + 1}`,
				value: [timestamp, index + 1],
				encode: { y: [1] }
			}
		})
		const output = createOverviewTooltipFormatter({
			valueSymbol: 'ETH',
			unlockTokenSymbol: '',
			seriesValueSymbols
		})(items)

		for (let index = 0; index < items.length; index++) {
			const seriesName = `Metric ${index + 1}`
			const expectedValue = index % 2 === 0 ? `$${index + 1}` : `${index + 1} ETH`
			expect(output).toContain(`${seriesName}&nbsp;&nbsp;${expectedValue}`)
		}
		expect(output).not.toContain('Others')
	})
})
