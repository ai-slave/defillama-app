import { describe, expect, it } from 'vitest'
import { createTooltipFormatter } from '../tooltip'

function tooltipItem(name: string, value: number) {
	return {
		seriesName: name,
		marker: '•',
		data: { timestamp: 1767225600000, [name]: value }
	}
}

describe('MultiSeriesChart2 tooltip', () => {
	it('keeps Others last and visually separates it from ordinary series', () => {
		const formatter = createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
		const tooltip = formatter([
			tooltipItem('Others', 100),
			tooltipItem('Protocol A', 40),
			tooltipItem('Protocol B', 60)
		])

		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('Protocol A'))
		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('Protocol B'))
		expect(tooltip).toContain('margin-top:6px')
		expect(tooltip).toContain('border-top:1px solid')
	})

	it('reserves a capped tooltip slot for Others and reports only hidden regular series', () => {
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

	it('shows a reconciled total when regular rows are capped', () => {
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

	it('does not add aggregate spacing when Others is the only value row', () => {
		const formatter = createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
		const tooltip = formatter([tooltipItem('Others', 100)])

		expect(tooltip).toContain('Others')
		expect(tooltip).not.toContain('border-top')
	})

	it('formats mixed axes with their per-series symbols', () => {
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
