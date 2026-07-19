import { describe, expect, it } from 'vitest'
import { createChartBuilderTooltipFormatter, dashboardGroupingToTooltipGroupBy } from './chartBuilderTooltip'

describe('Pro chart builder tooltip', () => {
	it('renders the total first and explicit Others last', () => {
		const formatter = createChartBuilderTooltipFormatter({ displayAs: 'timeSeries' })
		const timestamp = 1767225600000
		const output = formatter([
			{ seriesName: 'Small', marker: 'S', value: [timestamp, 20] },
			{ seriesName: 'Others', marker: 'O', value: [timestamp, 10] },
			{ seriesName: 'Large', marker: 'L', value: [timestamp, 70] }
		])

		expect(output.indexOf('Total')).toBeLessThan(output.indexOf('Large'))
		expect(output.indexOf('Large')).toBeLessThan(output.indexOf('Small'))
		expect(output.indexOf('Others')).toBeGreaterThan(output.indexOf('Small'))
		expect(output).toContain('margin-top:6px')
		expect(output).toContain('$100')
	})

	it('keeps a single series compact and uses two columns only for more than ten regular rows', () => {
		const single = createChartBuilderTooltipFormatter({ displayAs: 'percentage', useTwoColumns: true })([
			{ seriesName: 'Only', value: [1767225600000, 100] }
		])
		const many = createChartBuilderTooltipFormatter({ displayAs: 'timeSeries', useTwoColumns: true })(
			Array.from({ length: 11 }, (_, index) => ({ seriesName: `Series ${index}`, value: [1767225600000, index] }))
		)

		expect(single).not.toContain('Total')
		expect(single).not.toContain('grid-template-columns')
		expect(many).toContain('grid-template-columns:1fr 1fr')
	})

	it('maps dashboard groupings to the shared tooltip grouping names', () => {
		expect(dashboardGroupingToTooltipGroupBy('day')).toBe('daily')
		expect(dashboardGroupingToTooltipGroupBy('week')).toBe('weekly')
		expect(dashboardGroupingToTooltipGroupBy('quarter')).toBe('quarterly')
	})
})
