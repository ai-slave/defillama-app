import { describe, expect, test } from 'vitest'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import { createTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import { createChartBuilderTooltipFormatter } from '../components/chartBuilderTooltip'
import { DASHBOARD_CHART_GROUPING, getCsvPeriodCells, groupData } from '../utils'

// Mon Sep 14, 2026 to Mon Sep 21: one full week plus the next week's first day.
const DAYS = Array.from({ length: 8 }, (_, index) => Date.UTC(2026, 8, 14 + index) / 1e3)

function hover(timestampMs: number, value: number) {
	return [{ seriesName: 'Fees', marker: '', value: [timestampMs, value], encode: { x: [0], y: [1] } }]
}

describe('dashboard weekly grouping', () => {
	test('keys each Monday-to-Sunday week by its Sunday and sums the week', () => {
		expect(
			groupData(
				DAYS.map((day, index): [number, number] => [day, index + 1]),
				'week'
			)
		).toEqual([
			// 1 + 2 + … + 7
			[Date.UTC(2026, 8, 20) / 1e3, 28],
			[Date.UTC(2026, 8, 27) / 1e3, 8]
		])
	})

	test('labels a grouped week with both of its ends in every dashboard tooltip', () => {
		const [[week, value]] = groupData(
			DAYS.map((day): [number, number] => [day, 1]),
			'week'
		)
		const weekMs = week * 1e3
		const groupBy = DASHBOARD_CHART_GROUPING.week

		expect(createChartBuilderTooltipFormatter({ displayAs: 'timeSeries', groupBy })(hover(weekMs, value))).toContain(
			'14 - 20 Sep 2026'
		)
		expect(createTooltipFormatter({ groupBy, valueSymbol: '$' })(hover(weekMs, value))).toContain('14 - 20 Sep 2026')
		const singleSeries = createSingleSeriesChartOptions('$', groupBy).tooltip as { formatter: (p: unknown) => string }
		expect(singleSeries.formatter(hover(weekMs, value))).toContain('14 - 20 Sep 2026')
	})

	test('labels a week that crosses a month and year boundary', () => {
		// Mon Dec 28, 2026 to Sun Jan 3, 2027.
		const [[week]] = groupData([[Date.UTC(2026, 11, 31) / 1e3, 1]], 'week')

		expect(week).toBe(Date.UTC(2027, 0, 3) / 1e3)
		expect(createTooltipFormatter({ groupBy: 'weekly', valueSymbol: '$' })(hover(week * 1e3, 1))).toContain(
			'28 Dec 2026 - 03 Jan 2027'
		)
		expect(getCsvPeriodCells(week, 'week')).toEqual(['2026-12-28', '2027-01-03'])
	})
})

describe('dashboard CSV period columns', () => {
	test('pairs each grouped key with the period its days fall in', () => {
		// Feb 15 and Mar 31, 2024 group into February and Q1; the key is the period's first day.
		const [[february]] = groupData([[Date.UTC(2024, 1, 15) / 1e3, 1]], 'month')
		const [[firstQuarter]] = groupData([[Date.UTC(2024, 2, 31) / 1e3, 1]], 'quarter')

		expect(getCsvPeriodCells(february, 'month')).toEqual(['2024-02-01', '2024-02-29'])
		expect(getCsvPeriodCells(firstQuarter, 'quarter')).toEqual(['2024-01-01', '2024-03-31'])
	})
})
