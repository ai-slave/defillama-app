import { afterEach, describe, expect, test } from 'vitest'
import { prepareMultiSeriesDataset } from '~/components/ECharts/MultiSeriesChart/datasetAdapter'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
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
function hoverDay(chart: ReturnType<typeof buildChart>, dayIndex: number, pointedSeries?: string) {
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
		axisValue: row[0],
		pointed: series.name === pointedSeries
	}))
	return calendarChartOptions.tooltip.formatter(params)
}

/** The tooltip as a reader sees it, one text line per row: the date, the "Name $value" rows, then the total. */
function tooltipRows(html: string) {
	return html
		.split('</div>')
		.map((row) =>
			row
				.replace(/<[^>]*>/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		)
		.filter(Boolean)
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
		expect(tooltipRows(hoverDay(chart, 1)).slice(1)).toEqual(['Alpha $177.37m', 'Beta $5m', 'Total $182.37m'])
	})

	test('leads with the pointed protocol without changing the total', () => {
		const chart = buildChart(
			{
				'2026-09-24': {
					totalValue: 182_370_000,
					events: [unlockEvent('Alpha', 177_370_000), unlockEvent('Beta', 5_000_000)]
				}
			},
			['2026-09-24']
		)
		expect(tooltipRows(hoverDay(chart, 0, 'Beta')).slice(1)).toEqual(['Beta $5m', 'Alpha $177.37m', 'Total $182.37m'])
	})

	test('keeps values aligned when protocols past the series limit collapse into Others', () => {
		// Two protocols past the limit, valued down to $1m: the last two ($2m + $1m) collapse into
		// Others, which remaps every dataset column.
		const count = CHART_SERIES_LIMIT + 2
		const millions = Array.from({ length: count }, (_, index) => count - index)
		const events = millions.map((value, index) => unlockEvent(`P${index + 1}`, value * 1_000_000))
		const total = (count * (count + 1)) / 2
		const rows = tooltipRows(
			hoverDay(buildChart({ '2026-09-24': { totalValue: total * 1_000_000, events } }, ['2026-09-24']), 0)
		).slice(1)
		const named = millions.slice(0, CHART_SERIES_LIMIT).map((value, index) => `P${index + 1} $${value}m`)

		// The last named protocol and Others are both $3m, a tie in the value sort, so compare the rows as a set.
		expect(rows.slice(0, -1)).toHaveLength(CHART_SERIES_LIMIT + 1)
		expect(rows.slice(0, -1)).toEqual(expect.arrayContaining([...named, 'Others $3m']))
		expect(rows.at(-1)).toBe(`Total $${total}m`)
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

			expect(dates.map((_, index) => tooltipRows(hoverDay(chart, index))[0])).toEqual(expectedLabels)
		}
	)
})
