import { describe, expect, it } from 'vitest'
import { formatChartValue, formatTooltipChartDate, formatTooltipValue } from './formatters'

describe('shared ECharts value formatters', () => {
	it('formats adaptive values and tooltip symbols', () => {
		expect(formatChartValue(12_345, '$')).toBe('$12.35K')
		expect(formatChartValue(-0.000123, '%')).toBe('-0.000123%')
		expect(formatTooltipValue(12.345, '%')).toBe('12.35 %')
	})

	it('formats month and quarter boundaries entirely in UTC', () => {
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 1), 'monthly')).toBe('Jul 1 - 31, 2026')
		expect(formatTooltipChartDate(Date.UTC(2024, 1, 29), 'quarterly')).toBe('Jan 1 - Mar 31, 2024')
	})
})
