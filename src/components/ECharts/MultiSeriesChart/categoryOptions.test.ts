import { describe, expect, test } from 'vitest'
import { createCategoryTooltipFormatter } from './tooltip'

describe('category chart tooltip', () => {
	test('keeps the category header and reads object-row values', () => {
		const formatter = createCategoryTooltipFormatter('$')
		const tooltip = formatter([
			{
				axisValue: 'Pool A',
				seriesName: 'Principal',
				marker: '•',
				data: { name: 'Pool A', Principal: 1250 }
			}
		])

		expect(tooltip).toContain('<strong>Pool A</strong>')
		expect(tooltip).toContain('Principal')
		expect(tooltip).toContain('$1,250')
	})

	test('preserves negative values and omits legacy zero rows', () => {
		const formatter = createCategoryTooltipFormatter('%')
		const tooltip = formatter([
			{ axisValue: 'Bucket', seriesName: 'Loss', data: { Loss: -2.5 } },
			{ axisValue: 'Bucket', seriesName: 'Flat', data: { Flat: 0 } }
		])

		expect(tooltip).toContain('Loss')
		expect(tooltip).toContain('-2.5 %')
		expect(tooltip).not.toContain('Flat')
	})
})
