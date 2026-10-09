import { describe, expect, test } from 'vitest'
import { createOverviewTooltipFormatter } from '../overviewTooltip'

/** The tooltip as a reader sees it: the text of each list row, top to bottom. */
function rows(output: string) {
	return [...output.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((match) =>
		match[1]!
			.replace(/<[^>]*>/g, '')
			.replaceAll('&nbsp;', ' ')
			.replace(/\s+/g, ' ')
	)
}

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

		expect(rows(output)).toEqual(['aTVL $10', 'bGap $0', 'cGas Used 5 GAS', 'dUnlocks 7 TOKEN'])
	})

	test('leads with the pointed series and keeps the Mcap to TVL row last', () => {
		const output = createOverviewTooltipFormatter({ valueSymbol: '$', unlockTokenSymbol: '' })([
			{ axisValue: 1_700_000_000_000, seriesName: 'TVL', value: [1_700_000_000_000, 10], encode: { y: [1] } },
			{
				axisValue: 1_700_000_000_000,
				seriesName: 'Mcap',
				value: [1_700_000_000_000, 25],
				encode: { y: [1] },
				pointed: true
			}
		])
		expect(rows(output)).toEqual(['Mcap $25', 'TVL $10', 'Mcap/TVL 2.50'])
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
})
