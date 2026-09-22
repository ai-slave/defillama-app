import { describe, expect, test } from 'vitest'
import { prepareMultiSeriesDataset } from '~/components/ECharts/MultiSeriesChart/datasetAdapter'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { buildUnlocksMultiSeriesChartForDateRange } from '../buildUnlocksMultiSeriesChart'
import { calendarChartOptions } from '../calendarChartOptions'
import type { CalendarUnlockEvent, UnlocksData } from '../calendarTypes'

function unlockEvent(protocol: string, value: number): CalendarUnlockEvent {
	return { protocol, value, details: `${protocol} unlock`, unlockType: 'Cliff' }
}

/**
 * Hover one day the way the calendar renders it: builder output, the selected-series cap,
 * the renderer's dataset preparation, then axis-trigger params shaped as ECharts sends them
 * for array rows (`value` is the whole row, `encode.y` is the series' column).
 */
function hoverDay(unlocksData: UnlocksData, dates: Array<string>, day: string) {
	const chart = buildUnlocksMultiSeriesChartForDateRange({ dates, unlocksData })
	const names = chart.charts.map((series) => series.name)
	const selected = buildSelectedAdditiveChart({
		dataset: chart.dataset,
		charts: chart.charts,
		seriesOrder: names,
		selectedCharts: new Set(names)
	})
	const prepared = prepareMultiSeriesDataset(selected.dataset, selected.charts)
	const row = prepared.source[dates.indexOf(day)]!
	const params = prepared.charts.map((series) => ({
		seriesName: series.name,
		marker: '',
		value: row,
		data: row,
		encode: { x: [series.encode.x], y: [series.encode.y] },
		dimensionNames: prepared.dimensions.map((dimension) => dimension.name),
		axisValue: row[0]
	}))
	return calendarChartOptions.tooltip.formatter(params)
}

function rowValue(html: string, name: string) {
	const match = html.match(new RegExp(`<span> ${name}</span>\\s*<span[^>]*>([^<]+)</span>`))
	return match?.[1]
}

function totalValue(html: string) {
	return html.match(/<strong>Total<\/strong><\/span>\s*<span[^>]*>([^<]+)<\/span>/)?.[1]
}

describe('calendar chart tooltip', () => {
	test('shows each protocol its own unlock value for the hovered day', () => {
		const dates = ['2026-09-23', '2026-09-24']
		const html = hoverDay(
			{
				'2026-09-23': { totalValue: 9_000_000, events: [unlockEvent('Beta', 9_000_000)] },
				'2026-09-24': {
					totalValue: 182_370_000,
					events: [unlockEvent('Alpha', 177_370_000), unlockEvent('Beta', 5_000_000)]
				}
			},
			dates,
			'2026-09-24'
		)

		expect(html).toContain('Sep 24, 2026')
		expect(rowValue(html, 'Alpha')).toBe('$177.37m')
		expect(rowValue(html, 'Beta')).toBe('$5m')
		expect(totalValue(html)).toBe('$182.37m')
	})

	test('keeps values aligned when more than 30 protocols collapse into Others', () => {
		// 32 protocols on one day: P1 = $32m down to P32 = $1m. The 30 largest stay named and
		// P31 + P32 ($2m + $1m) collapse into Others, which remaps every dataset column.
		const events = Array.from({ length: 32 }, (_, index) => unlockEvent(`P${index + 1}`, (32 - index) * 1_000_000))
		const html = hoverDay({ '2026-09-24': { totalValue: 528_000_000, events } }, ['2026-09-24'], '2026-09-24')

		expect(rowValue(html, 'P1')).toBe('$32m')
		expect(rowValue(html, 'P2')).toBe('$31m')
		expect(rowValue(html, 'P30')).toBe('$3m')
		expect(rowValue(html, 'Others')).toBe('$3m')
		expect(rowValue(html, 'P31')).toBeUndefined()
		// 1 + 2 + … + 32 = 528
		expect(totalValue(html)).toBe('$528m')
	})
})
