import { describe, expect, it } from 'vitest'
import { formatChartEmphasisDate, formatChartValue, formatTooltipChartDate, formatTooltipValue } from './formatters'

describe('shared ECharts value formatters', () => {
	it('formats adaptive values and tooltip symbols', () => {
		expect(formatChartValue(12_345, '$')).toBe('$12.35K')
		expect(formatChartValue(-0.000123, '%')).toBe('-0.000123%')
		expect(formatTooltipValue(12.345, '%')).toBe('12.35 %')
	})

	it('formats month and quarter boundaries entirely in UTC', () => {
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 1), 'monthly')).toBe('Jul 1 - 31, 2026')
		expect(formatTooltipChartDate(Date.UTC(2024, 1, 1), 'monthly')).toBe('Feb 1 - 29, 2024')
		expect(formatTooltipChartDate(Date.UTC(2024, 1, 29), 'quarterly')).toBe('Jan 1 - Mar 31, 2024')
	})

	it('preserves the existing UTC daily, weekly, and yearly labels', () => {
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 24), 'daily')).toBe('24 Jul 2026')
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 24), 'weekly')).toBe('18 - 24 Jul 2026')
		expect(formatTooltipChartDate(Date.UTC(2026, 0, 2), 'weekly')).toBe('27 Dec 2025 - 02 Jan 2026')
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 24), 'yearly')).toBe('Jan 1 - Dec 31, 2026')
	})

	it('keeps non-midnight chart timestamps and emphasis labels in UTC without fixing the viewer locale', () => {
		const intraday = Date.UTC(2026, 6, 24, 16, 30)
		const midnightHour = Date.UTC(2026, 6, 24, 0, 30)
		const date = new Date(intraday)
		const intradayOptions: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'UTC'
		}
		const emphasisOptions: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'UTC'
		}

		expect(formatTooltipChartDate(intraday, 'daily')).toBe(
			new Intl.DateTimeFormat(undefined, intradayOptions).format(date)
		)
		expect(formatTooltipChartDate(midnightHour, 'daily')).toBe(
			new Intl.DateTimeFormat(undefined, intradayOptions).format(new Date(midnightHour))
		)
		expect(formatChartEmphasisDate(intraday)).toBe(new Intl.DateTimeFormat(undefined, emphasisOptions).format(date))
	})

	it('keeps hideTime as a date-only chart label for intraday points', () => {
		expect(formatTooltipChartDate(Date.UTC(2026, 6, 24, 16, 30), 'daily', true)).toBe('24 Jul 2026')
	})
})
