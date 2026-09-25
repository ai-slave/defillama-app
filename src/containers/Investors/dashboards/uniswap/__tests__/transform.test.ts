import { describe, expect, test } from 'vitest'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { chartToPeriodDataset, type Chart } from '../transform'

function chart(dates: Array<string>): Chart {
	return { title: 'Swappers', dates, series: [{ name: 'Swappers', data: dates.map((_, index) => index + 1) }] }
}

describe('chartToPeriodDataset', () => {
	test('keys a Monday-stamped weekly payload by the Sunday ending each week, without re-summing', () => {
		// SQL date_trunc('week') stamps weeks at their Monday: Sep 7 and Sep 14, 2026.
		const { dataset, groupBy } = chartToPeriodDataset(chart(['2026-09-07', '2026-09-14', '2026-09-21']))

		expect(groupBy).toBe('weekly')
		expect(dataset.source).toEqual([
			[Date.UTC(2026, 8, 13), 1],
			[Date.UTC(2026, 8, 20), 2],
			[Date.UTC(2026, 8, 27), 3]
		])
		expect(formatTooltipChartDate(dataset.source[1]![0] as number, groupBy)).toBe('14 - 20 Sep 2026')
	})

	test('labels a monthly payload by its month and keeps its first-of-month stamps', () => {
		const { dataset, groupBy } = chartToPeriodDataset(chart(['2026-07-01', '2026-08-01', '2026-09-01']))

		expect(groupBy).toBe('monthly')
		expect(dataset.source.map((row) => row[0])).toEqual([
			Date.UTC(2026, 6, 1),
			Date.UTC(2026, 7, 1),
			Date.UTC(2026, 8, 1)
		])
		expect(formatTooltipChartDate(dataset.source[2]![0] as number, groupBy)).toBe('Sep 1 - 30, 2026')
	})

	test('leaves a daily payload daily', () => {
		const { dataset, groupBy } = chartToPeriodDataset(chart(['2026-09-14', '2026-09-15', '2026-09-16']))

		expect(groupBy).toBe('daily')
		expect(dataset.source.map((row) => row[0])).toEqual([
			Date.UTC(2026, 8, 14),
			Date.UTC(2026, 8, 15),
			Date.UTC(2026, 8, 16)
		])
	})
})
