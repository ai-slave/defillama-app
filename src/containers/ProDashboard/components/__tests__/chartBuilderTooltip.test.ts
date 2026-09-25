import { describe, expect, test } from 'vitest'
import { createChartBuilderTooltipFormatter } from '../chartBuilderTooltip'

describe('Pro chart builder tooltip', () => {
	test('renders the total first and explicit Others last', () => {
		const formatter = createChartBuilderTooltipFormatter({ displayAs: 'timeSeries' })
		const timestamp = 1_767_225_600_000
		const output = formatter([
			{
				seriesName: 'Small',
				marker: 'S',
				data: { timestamp, 'series-0': 20 },
				encode: { y: [1] },
				dimensionNames: ['timestamp', 'series-0']
			},
			{
				seriesName: 'Others (8 protocols)',
				marker: 'O',
				data: { timestamp, 'series-1': 10 },
				encode: { y: [2] },
				dimensionNames: ['timestamp', 'series-0', 'series-1']
			},
			{
				seriesName: 'Large',
				marker: 'L',
				data: { timestamp, 'series-2': 70 },
				encode: { y: [3] },
				dimensionNames: ['timestamp', 'series-0', 'series-1', 'series-2']
			}
		])

		expect(output.indexOf('Total')).toBeLessThan(output.indexOf('Large'))
		expect(output.indexOf('Large')).toBeLessThan(output.indexOf('Small'))
		expect(output.indexOf('Others')).toBeGreaterThan(output.indexOf('Small'))
		expect(output).toContain('$100')
	})

	test('omits a redundant total for one series and retains all values for a large tooltip', () => {
		const single = createChartBuilderTooltipFormatter({ displayAs: 'percentage', useTwoColumns: true })([
			{ seriesName: 'Only', value: [1_767_225_600_000, 100] }
		])
		const many = createChartBuilderTooltipFormatter({ displayAs: 'timeSeries', useTwoColumns: true })(
			Array.from({ length: 11 }, (_, index) => ({ seriesName: `Series ${index}`, value: [1_767_225_600_000, index] }))
		)

		expect(single).not.toContain('Total')
		expect(single).toMatch(/100\s*%/)
		for (let i = 0; i < 11; i++) expect(many).toContain(`Series ${i}`)
		expect(many).toContain('$55')
	})
})
