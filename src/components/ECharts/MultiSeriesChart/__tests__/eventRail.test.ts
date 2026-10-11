import * as echarts from 'echarts'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	clusterPointEvents,
	type EventHoverState,
	type EventRailDatum,
	getDatasetTimeBounds,
	getSeriesTimeBounds
} from '../eventRail'

let chart: echarts.ECharts | undefined

afterEach(() => {
	chart?.dispose()
	chart = undefined
	vi.useRealTimers()
})

// Pointer events reach listeners through the instance's event bus; an SSR chart has no pointer.
const emit = (event: string, params?: unknown) =>
	(chart as unknown as { trigger(event: string, params?: unknown): void }).trigger(event, params)

describe('hallmark event-rail tooltip', () => {
	function tooltipFor(events: Array<EventRailDatum>, dataIndex: number) {
		const series = createEventRailSeries({
			eventRailData: events,
			eventStripYAxisIndex: 1,
			hoverState: { hoveredEventDate: null },
			shouldHideDataZoom: false,
			isThemeDark: false
		})
		return (series.tooltip as { formatter: (params: { dataIndex: number }) => string }).formatter({ dataIndex })
	}

	test('names a point event by its own day and a range event by its span', () => {
		const { events } = buildEventRailData({
			hallmarks: [[Date.UTC(2026, 8, 14) / 1e3, 'Upgrade']],
			rangeHallmarks: [[[Date.UTC(2026, 8, 1) / 1e3, Date.UTC(2026, 8, 4) / 1e3], 'Incident']],
			isThemeDark: false
		})
		const header = (text: string) =>
			tooltipFor(
				events,
				events.findIndex((event) => event.fullText === text)
			).split('<li')[0]

		expect(header('Upgrade')).toBe('14 Sep 2026')
		// The range's midpoint falls at noon on Sep 2; the header names the whole span instead.
		expect(header('Incident')).toBe('01 Sep 2026 - 04 Sep 2026')
	})

	test('shows a dashboard annotation as text, never as markup', () => {
		const { events } = buildEventRailData({
			hallmarks: [[Date.UTC(2026, 8, 14) / 1e3, '<img src=x onerror=alert(1)>']],
			isThemeDark: false
		})

		const html = tooltipFor(events, 0)
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
		expect(html).not.toContain('<img')
	})
})

describe('hallmark event-rail clusters', () => {
	const pointEvents = (dates: Array<number>) =>
		buildEventRailData({ hallmarks: dates.map((date) => [date, `Event ${date}`]), isThemeDark: false }).events
	// Hallmarks are unix seconds and events carry milliseconds, so one second is one pixel here.
	const toX = (date: number) => date / 1e3

	test('merges point events that would overlap and keeps distant ones apart', () => {
		const events = pointEvents([100, 105, 112, 200])

		// Each neighbor within a marker's width joins the run, so a chain of close events stays one marker.
		expect([...clusterPointEvents(events, toX, 0, 1000)]).toEqual([
			[0, [0, 1, 2]],
			[3, [3]]
		])
	})

	test('leaves range events and events outside the zoomed plot out of every marker', () => {
		const { events } = buildEventRailData({
			hallmarks: [
				[50, 'Before the window'],
				[150, 'Inside'],
				[900, 'After the window']
			],
			rangeHallmarks: [[[140, 160], 'Range']],
			isThemeDark: false
		})

		const clusters = clusterPointEvents(events, toX, 100, 800)
		expect([...clusters.values()].flat().map((index) => events[index]!.fullText)).toEqual(['Inside'])
	})
})

describe('hallmark event-rail time bounds', () => {
	test('reads numeric and numeric-string endpoints', () => {
		expect(getDatasetTimeBounds([[100], [200]], 0)).toEqual({ min: 100, max: 200 })
		expect(getDatasetTimeBounds([['100'], ['200']], 0)).toEqual({ min: 100, max: 200 })
		expect(
			getSeriesTimeBounds([
				['100', 1],
				['200', 2]
			])
		).toEqual({ min: 100, max: 200 })
		expect(getDatasetTimeBounds([[''], ['invalid']], 0)).toEqual({
			min: undefined,
			max: undefined
		})
		expect(getDatasetTimeBounds([], 0)).toEqual({ min: undefined, max: undefined })
	})

	test('skips invalid boundary rows', () => {
		const source = [[undefined], [100], [200], [null]]
		const series: Array<[number | string, number] | unknown> = [undefined, ['100', 1], [200, 2], null]

		expect(getDatasetTimeBounds(source, 0)).toEqual({ min: 100, max: 200 })
		expect(getSeriesTimeBounds(series)).toEqual({ min: 100, max: 200 })
	})
})

describe('hallmark event-rail rendering', () => {
	const year = (month: number, day: number) => Date.UTC(2026, month, day)

	function renderRail(
		hallmarks: Array<[number, string]>,
		{ rangeHallmarks, zoom }: { rangeHallmarks?: Array<[[number, number], string]>; zoom?: [number, number] } = {}
	) {
		// The rail tests read dates in milliseconds; hallmarks arrive in unix seconds.
		const { events } = buildEventRailData({
			hallmarks: hallmarks.map(([date, label]) => [date / 1e3, label]),
			rangeHallmarks: rangeHallmarks?.map(([[start, end], label]) => [[start / 1e3, end / 1e3], label]),
			isThemeDark: false
		})
		const hoverState: EventHoverState = { hoveredEventDate: null }
		const series = createEventRailSeries({
			eventRailData: events,
			eventStripYAxisIndex: 1,
			hoverState,
			shouldHideDataZoom: false,
			isThemeDark: false
		})
		// Records which events the rail draws a shape for.
		const drawn = new Set<number>()
		const renderItem = series.renderItem as (params: { dataIndex: number }, api: unknown) => unknown
		series.renderItem = ((params: { dataIndex: number }, api: unknown) => {
			const element = renderItem(params, api)
			if (element) drawn.add(events[params.dataIndex]!.eventDate)
			return element
		}) as typeof series.renderItem
		chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 300 })
		chart.setOption({
			xAxis: { type: 'time' },
			yAxis: [{}, createEventStripYAxis()],
			...(zoom ? { dataZoom: [{ type: 'inside', startValue: zoom[0], endValue: zoom[1] }] } : {}),
			series: [
				{
					type: 'line',
					data: [
						[year(0, 1), 1],
						[year(11, 31), 2]
					]
				},
				series
			]
		})
		const tooltip = (dataIndex: number) =>
			(series.tooltip as { formatter: (params: { dataIndex: number }) => string }).formatter({ dataIndex })
		return { events, hoverState, tooltip, drawn }
	}

	const guideCount = () => chart!.renderToSVGString().match(/stroke-dasharray/g)?.length ?? 0

	test('lists every event a grouped marker counts in its tooltip', () => {
		const { tooltip } = renderRail([
			[year(8, 1), 'Upgrade'],
			[year(8, 2), 'Hack · Access Control'],
			[year(10, 1), 'Listing']
		])

		expect(tooltip(0)).toContain('Upgrade')
		expect(tooltip(0)).toContain('Hack · Access Control')
		expect(tooltip(2)).not.toContain('Upgrade')
	})

	test('draws an event just inside the zoom window when one just outside would have led its marker', () => {
		// An hour is a fraction of a pixel here, so the event an hour before the window sits within the plot's edge
		// slack while the zoom itself excludes it.
		const { drawn } = renderRail(
			[
				[year(2, 1) - 3_600_000, 'Just before the window'],
				[year(2, 2), 'Inside the window']
			],
			{ zoom: [year(2, 1), year(11, 31)] }
		)

		expect(drawn.size).toBe(1)
	})

	test('keeps drawing a range band while the zoom shows only part of its span', () => {
		const { drawn } = renderRail([], {
			rangeHallmarks: [[[year(0, 10), year(4, 20)], 'Rewards program']],
			zoom: [year(0, 15), year(1, 1)]
		})

		expect(drawn).toEqual(new Set([Math.round((year(0, 10) + year(4, 20)) / 2)]))
	})

	test('draws a guide for each hovered event and clears them once the pointer leaves', () => {
		vi.useFakeTimers()
		const { events, hoverState } = renderRail([
			[year(8, 1), 'Upgrade'],
			[year(8, 2), 'Audit'],
			[year(10, 1), 'Listing']
		])
		const detach = attachEventHoverHandlers({ instance: chart!, eventRailData: events, hoverState })
		expect(guideCount()).toBe(0)

		emit('mouseover', { seriesName: 'Events', data: events[0] })
		expect(guideCount()).toBe(2)

		emit('mouseout', { seriesName: 'Events' })
		vi.advanceTimersByTime(40)
		expect(guideCount()).toBe(0)

		detach()
		emit('mouseover', { seriesName: 'Events', data: events[2] })
		expect(guideCount()).toBe(0)
	})
})
