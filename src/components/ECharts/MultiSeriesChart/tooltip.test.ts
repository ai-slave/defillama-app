import { describe, expect, test } from 'vitest'
import { createCappedRemainderTooltipFormatter, createInflowsTooltipFormatter, createTooltipFormatter } from './tooltip'

function tooltipItem(name: string, value: number | null) {
	return {
		seriesName: name,
		marker: '•',
		data: { timestamp: 1_767_225_600_000, [name]: value }
	}
}

describe('MultiSeriesChart tooltip', () => {
	test('reads encoded positional values in inflow tooltips', () => {
		const output = createInflowsTooltipFormatter({ valueSymbol: '$' })([
			{
				seriesName: 'Selected',
				data: [1_700_000_000_000, 111, 222],
				value: [1_700_000_000_000, 111, 222],
				encode: { x: [0], y: [2] }
			}
		])

		expect(output).toContain('$222')
		expect(output).not.toContain('$111')
	})

	test('reconciles explicit and capped inflow remainder values once', () => {
		const timestamp = 1_700_000_000_000
		const output = createInflowsTooltipFormatter({ valueSymbol: '$', topN: 2 })([
			{ seriesName: 'Protocol A', marker: 'A', data: { timestamp, 'Protocol A': 70 } },
			{ seriesName: 'Others', marker: 'O', data: { timestamp, Others: 5 } },
			{ seriesName: 'Protocol B', marker: 'B', data: { timestamp, 'Protocol B': 20 } },
			{ seriesName: 'Protocol C', marker: 'C', data: { timestamp, 'Protocol C': 10 } }
		])

		expect(output.match(/Others/g)).toHaveLength(1)
		expect(output).toContain('OOthers&nbsp;&nbsp;$15')
		expect(output).toContain('Total Inflows&nbsp;&nbsp;$105')
	})

	test('keeps a true single-series inflow tooltip compact', () => {
		const output = createInflowsTooltipFormatter({ valueSymbol: '$' })([tooltipItem('Protocol', 70)])

		expect(output).toContain('Protocol&nbsp;&nbsp;$70')
		expect(output).not.toContain('Total Inflows')
		expect(output).not.toContain('Others')
	})

	test('reconciles a capped high-cardinality tooltip and omits zero rows', () => {
		const formatter = createCappedRemainderTooltipFormatter({ valueSymbol: '$', maxItems: 3 })
		const tooltip = formatter([
			tooltipItem('Pool A', 0),
			tooltipItem('Pool B', 1),
			tooltipItem('Pool C', 2),
			tooltipItem('Pool D', 3),
			tooltipItem('Pool E', 4)
		])

		expect(tooltip).not.toContain('Pool A')
		expect(tooltip).toContain('Pool E')
		expect(tooltip).toContain('Pool D')
		expect(tooltip).not.toContain('Pool B')
		expect(tooltip).not.toContain('Pool C')
		expect(tooltip).toContain('Others&nbsp;&nbsp;$3')
	})

	test('does not fold a user-defined Others series into the hidden tail', () => {
		const formatter = createCappedRemainderTooltipFormatter({
			valueSymbol: '$',
			maxItems: 3,
			explicitRemainderLabel: null
		})
		const tooltip = formatter([
			tooltipItem('Others', 100),
			tooltipItem('A', 40),
			tooltipItem('B', 30),
			tooltipItem('C', 20)
		])

		expect(tooltip).toContain('Others&nbsp;&nbsp;$100')
		expect(tooltip).toContain('Others&nbsp;&nbsp;$50')
		expect(tooltip).not.toContain('Others&nbsp;&nbsp;$120')
	})

	test('reconciles a caller-declared aggregate with the capped tail once', () => {
		const formatter = createCappedRemainderTooltipFormatter({
			valueSymbol: '$',
			maxItems: 3,
			explicitRemainderLabel: 'Other'
		})
		const tooltip = formatter([
			tooltipItem('Other', 100),
			tooltipItem('A', 40),
			tooltipItem('B', 30),
			tooltipItem('C', 20)
		])

		expect(tooltip.match(/Others/g)).toHaveLength(1)
		expect(tooltip).toContain('Others&nbsp;&nbsp;$120')
		expect(tooltip).not.toContain('Other&nbsp;&nbsp;$100')
	})

	test('keeps the aggregate separate from the ordinary series', () => {
		const formatter = createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
		const tooltip = formatter([
			tooltipItem('Others', 100),
			tooltipItem('Protocol A', 40),
			tooltipItem('Protocol B', 60)
		])

		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('Protocol A'))
		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('Protocol B'))
	})

	test('reserves a capped tooltip slot for Others and reports only hidden regular series', () => {
		const formatter = createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$', maxItems: 3 })
		const tooltip = formatter([
			tooltipItem('Protocol A', 10),
			tooltipItem('Others', 100),
			tooltipItem('Protocol B', 20),
			tooltipItem('Protocol C', 30),
			tooltipItem('Protocol D', 40)
		])

		expect(tooltip).toContain('Protocol D')
		expect(tooltip).toContain('Protocol C')
		expect(tooltip).not.toContain('Protocol A')
		expect(tooltip).not.toContain('Protocol B')
		expect(tooltip).toContain('+2 more')
		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('+2 more'))
	})

	test('shows a reconciled total when regular rows are capped', () => {
		const formatter = createTooltipFormatter({
			groupBy: 'daily',
			valueSymbol: '$',
			maxItems: 2,
			showTotalInTooltip: true
		})
		const tooltip = formatter([
			tooltipItem('Marketplace A', 10),
			tooltipItem('Marketplace B', 20),
			tooltipItem('Marketplace C', 30)
		])

		expect(tooltip).toContain('Total: $60')
		expect(tooltip).toContain('+1 more')
		expect(tooltip.indexOf('Total')).toBeLessThan(tooltip.indexOf('Marketplace C'))
	})

	test('requires complete same-unit series only when the caller opts in', () => {
		const items = [tooltipItem('Available', 10), tooltipItem('Unavailable', null)]
		const legacyTooltip = createTooltipFormatter({
			groupBy: 'daily',
			valueSymbol: '$',
			showTotalInTooltip: true
		})(items)
		const exactTooltip = createTooltipFormatter({
			groupBy: 'daily',
			valueSymbol: '$',
			showTotalInTooltip: true,
			requireCompleteTooltipTotal: true
		})(items)

		expect(legacyTooltip).toContain('Total: $10')
		expect(exactTooltip).toContain('Available: $10')
		expect(exactTooltip).not.toContain('Total:')
	})

	test('shows the aggregate when no ordinary series remain', () => {
		const formatter = createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
		const tooltip = formatter([tooltipItem('Others', 100)])

		expect(tooltip).toContain('Others')
	})

	test('formats mixed axes with their per-series symbols', () => {
		const formatter = createTooltipFormatter({
			groupBy: 'daily',
			valueSymbol: '',
			seriesSymbols: new Map([
				['APY', '%'],
				['TVL', '$']
			])
		})
		const tooltip = formatter([tooltipItem('APY', 4.5), tooltipItem('TVL', 10_000)])

		expect(tooltip).toContain('APY: 4.5%')
		expect(tooltip).toContain('TVL: $10,000')
	})
})
