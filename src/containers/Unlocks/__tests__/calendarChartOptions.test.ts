import { afterEach, describe, expect, test } from 'vitest'
import { prepareMultiSeriesDataset } from '~/components/ECharts/MultiSeriesChart/datasetAdapter'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { buildUnlocksMultiSeriesChartForDateRange } from '../buildUnlocksMultiSeriesChart'
import { calendarChartOptions } from '../calendarChartOptions'
import type { CalendarUnlockEvent, UnlocksData } from '../calendarTypes'

const TIME_ZONES = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'] as const
const originalTimeZone = process.env.TZ

afterEach(() => {
	process.env.TZ = originalTimeZone
})

function unlockEvent(protocol: string, value: number): CalendarUnlockEvent {
	return { protocol, value, details: `${protocol} unlock`, unlockType: 'Cliff' }
}

function buildChart(unlocksData: UnlocksData, dates: Array<string>) {
	return buildUnlocksMultiSeriesChartForDateRange({ dates, unlocksData })
}

/**
 * Hover one day the way the calendar renders it: the selected-series cap, the renderer's
 * dataset preparation, then axis-trigger params shaped as ECharts sends them for array rows
 * (`value` is the whole row, `encode.y` is the series' column).
 */
function hoverDay(chart: ReturnType<typeof buildChart>, dayIndex: number) {
	const names = chart.charts.map((series) => series.name)
	const selected = buildSelectedAdditiveChart({
		dataset: chart.dataset,
		charts: chart.charts,
		seriesOrder: names,
		selectedCharts: new Set(names)
	})
	const prepared = prepareMultiSeriesDataset(selected.dataset, selected.charts)
	const row = prepared.source[dayIndex]!
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

function tooltipDate(html: string) {
	return html.match(/<div class="font-semibold mb-1">([^<]*)<\/div>/)?.[1]
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
		const chart = buildChart(
			{
				'2026-09-23': { totalValue: 9_000_000, events: [unlockEvent('Beta', 9_000_000)] },
				'2026-09-24': {
					totalValue: 182_370_000,
					events: [unlockEvent('Alpha', 177_370_000), unlockEvent('Beta', 5_000_000)]
				}
			},
			['2026-09-23', '2026-09-24']
		)
		const html = hoverDay(chart, 1)

		expect(rowValue(html, 'Alpha')).toBe('$177.37m')
		expect(rowValue(html, 'Beta')).toBe('$5m')
		expect(totalValue(html)).toBe('$182.37m')
	})

	test('keeps values aligned when more than 10 protocols collapse into Others', () => {
		// 12 protocols on one day: P1 = $12m down to P12 = $1m. The 10 largest stay named and
		// P11 + P12 ($2m + $1m) collapse into Others, which remaps every dataset column.
		const events = Array.from({ length: 12 }, (_, index) => unlockEvent(`P${index + 1}`, (12 - index) * 1_000_000))
		const html = hoverDay(buildChart({ '2026-09-24': { totalValue: 78_000_000, events } }, ['2026-09-24']), 0)

		expect(rowValue(html, 'P1')).toBe('$12m')
		expect(rowValue(html, 'P2')).toBe('$11m')
		expect(rowValue(html, 'P10')).toBe('$3m')
		expect(rowValue(html, 'Others')).toBe('$3m')
		expect(rowValue(html, 'P11')).toBeUndefined()
		// 1 + 2 + … + 12 = 78
		expect(totalValue(html)).toBe('$78m')
	})
})

describe('calendar chart dates', () => {
	// Month/year boundaries, and 2026-11-01, when Los Angeles leaves daylight saving time.
	const dates = ['2026-09-24', '2026-10-31', '2026-11-01', '2026-11-02', '2026-12-31', '2027-01-01']
	const expectedLabels = ['Sep 24, 2026', 'Oct 31, 2026', 'Nov 1, 2026', 'Nov 2, 2026', 'Dec 31, 2026', 'Jan 1, 2027']
	const unlocksData: UnlocksData = Object.fromEntries(
		dates.map((date) => [date, { totalValue: 1_000_000, events: [unlockEvent('Alpha', 1_000_000)] }])
	)

	test.each(TIME_ZONES)('stamps every date key at UTC midnight when built in %s', (timeZone) => {
		process.env.TZ = timeZone
		const timestamps = buildChart(unlocksData, dates).dataset.source.map((row) => row[0])

		expect(timestamps).toEqual(dates.map((date) => Date.parse(`${date}T00:00:00Z`)))
	})

	// The current week/month chart is precomputed on the server; other ranges and filtered views
	// are built in the browser. Both must name the same day in every viewer timezone.
	test.each(TIME_ZONES.flatMap((builtIn) => TIME_ZONES.map((viewedIn) => [builtIn, viewedIn] as const)))(
		'labels each tooltip with its own date when built in %s and viewed in %s',
		(builtIn, viewedIn) => {
			process.env.TZ = builtIn
			const chart = buildChart(unlocksData, dates)
			process.env.TZ = viewedIn

			expect(dates.map((_, index) => tooltipDate(hoverDay(chart, index)))).toEqual(expectedLabels)
		}
	)
})
