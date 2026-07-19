import { describe, expect, it } from 'vitest'
import { createAggregateTooltipFormatter, createInflowsTooltipFormatter, formatTooltipChartDate } from './formatters'

describe('shared ECharts tooltip formatters', () => {
	it('reads encoded values from reserved-dimension array rows', () => {
		const item = {
			seriesName: 'hasOwnProperty',
			data: [1700000000000, 111, 222],
			value: [1700000000000, 111, 222],
			encode: { x: [0], y: [2] }
		}

		for (const formatter of [
			createAggregateTooltipFormatter({ valueSymbol: '$' }),
			createInflowsTooltipFormatter({ valueSymbol: '$' })
		]) {
			const output = formatter([item])
			expect(output).toContain('$222')
			expect(output).not.toContain('$111')
		}
	})

	it('renders Others last with separation in aggregate and inflow tooltips', () => {
		const timestamp = 1700000000000
		const aggregate = createAggregateTooltipFormatter({ valueSymbol: '$' })([
			{ seriesName: 'Others', data: { timestamp, Others: 30 } },
			{ seriesName: 'Protocol', data: { timestamp, Protocol: 70 } }
		])
		const inflows = createInflowsTooltipFormatter({ valueSymbol: '$', topN: 2 })([
			{ seriesName: 'Protocol A', data: { timestamp, 'Protocol A': 70 } },
			{ seriesName: 'Protocol B', data: { timestamp, 'Protocol B': 20 } },
			{ seriesName: 'Protocol C', data: { timestamp, 'Protocol C': 10 } }
		])

		for (const output of [aggregate, inflows]) {
			expect(output.indexOf('Others')).toBeGreaterThan(output.indexOf('Total'))
			expect(output.indexOf('Total')).toBeLessThan(output.indexOf('Protocol'))
			expect(output).toContain('margin-top:6px')
		}
		expect(aggregate).toContain('$100')
	})

	it('combines an explicit Others series with capped inflows exactly once', () => {
		const timestamp = 1700000000000
		const output = createInflowsTooltipFormatter({ valueSymbol: '$', topN: 2 })([
			{ seriesName: 'Protocol A', marker: 'A', data: { timestamp, 'Protocol A': 70 } },
			{ seriesName: 'Others', marker: 'O', data: { timestamp, Others: 5 } },
			{ seriesName: 'Protocol B', marker: 'B', data: { timestamp, 'Protocol B': 20 } },
			{ seriesName: 'Protocol C', marker: 'C', data: { timestamp, 'Protocol C': 10 } }
		])

		expect(output.indexOf('Total Inflows')).toBeLessThan(output.indexOf('Protocol A'))
		expect(output.indexOf('Others')).toBeGreaterThan(output.indexOf('Protocol B'))
		expect(output.match(/Others/g)).toHaveLength(1)
		expect(output).toContain('OOthers&nbsp;&nbsp;$15')
		expect(output).toContain('Total Inflows&nbsp;&nbsp;$105')
	})

	it('keeps a true single-series inflow tooltip compact', () => {
		const timestamp = 1700000000000
		const output = createInflowsTooltipFormatter({ valueSymbol: '$' })([
			{ seriesName: 'Protocol', marker: 'P', data: { timestamp, Protocol: 70 } }
		])

		expect(output).toContain('PProtocol&nbsp;&nbsp;$70')
		expect(output).not.toContain('Total Inflows')
		expect(output).not.toContain('Others')
	})

	it('does not add summary rows when every inflow value is empty', () => {
		const timestamp = 1700000000000
		const output = createInflowsTooltipFormatter({ valueSymbol: '$' })([
			{ seriesName: 'Zero', data: { timestamp, Zero: 0 } },
			{ seriesName: 'Missing', data: { timestamp, Missing: null } }
		])

		expect(output).not.toContain('Total Inflows')
		expect(output).not.toContain('Zero')
	})

	it('formats month and quarter boundaries entirely in UTC', () => {
		const julyFirstUtc = Date.UTC(2026, 6, 1)
		const leapYearQuarter = Date.UTC(2024, 1, 29)

		expect(formatTooltipChartDate(julyFirstUtc, 'monthly')).toBe('Jul 1 - 31, 2026')
		expect(formatTooltipChartDate(leapYearQuarter, 'quarterly')).toBe('Jan 1 - Mar 31, 2024')
	})
})
