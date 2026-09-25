import * as echarts from 'echarts'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	type EventHoverState,
	getDatasetTimeBounds,
	getSeriesTimeBounds,
	mergeGraphicWithEventMarkLinePlaceholder
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
	function hoverHeader(data: ReturnType<typeof buildEventRailData>['events'][number]) {
		const series = createEventRailSeries({
			eventRailData: [data],
			eventStripYAxisIndex: 1,
			hoverState: { hoveredEventDate: null },
			shouldHideDataZoom: false
		})
		const formatter = (series.tooltip as { formatter: (params: unknown) => string }).formatter
		return formatter({ data }).split('<li')[0]
	}

	test('names a point event by its own day and a range event by its span', () => {
		const { events } = buildEventRailData({
			hallmarks: [[Date.UTC(2026, 8, 14), 'Upgrade']],
			rangeHallmarks: [[[Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 4)], 'Incident']],
			isThemeDark: false
		})
		const byText = Object.fromEntries(events.map((event) => [event.fullText, event]))

		expect(hoverHeader(byText['Upgrade']!)).toBe('14 Sep 2026')
		// The range's midpoint falls at noon on Sep 2; the header names the whole span instead.
		expect(hoverHeader(byText['Incident']!)).toBe('01 Sep 2026 - 04 Sep 2026')
	})
})

describe('hallmark event-rail time bounds', () => {
	test('reads bounds from the ends of an ascending series without re-sorting it', () => {
		const data: Array<[number, number]> = [
			[100, 1],
			[200, 2],
			[300, 3]
		]

		expect(getSeriesTimeBounds(data)).toEqual({ min: 100, max: 300 })
		expect(data).toEqual([
			[100, 1],
			[200, 2],
			[300, 3]
		])
	})

	test('reads numeric and numeric-string endpoints without sorting', () => {
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

	test('skips invalid boundary rows without sorting the source', () => {
		const source = [[undefined], [100], [200], [null]]
		const series: Array<[number | string, number] | unknown> = [undefined, ['100', 1], [200, 2], null]

		expect(getDatasetTimeBounds(source, 0)).toEqual({ min: 100, max: 200 })
		expect(getSeriesTimeBounds(series)).toEqual({ min: 100, max: 200 })
		expect(source.map((row) => row[0])).toEqual([undefined, 100, 200, null])
		expect(series).toEqual([undefined, ['100', 1], [200, 2], null])
	})

	test('draws the hovered event mark line, follows it on redraw, and hides it once the pointer leaves', () => {
		vi.useFakeTimers()
		const { events } = buildEventRailData({ hallmarks: [[Date.UTC(2026, 8, 14), 'Upgrade']], isThemeDark: false })
		const event = events[0]!
		const hoverState: EventHoverState = { hoveredEventDate: null }
		chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 300 })
		chart.setOption({
			xAxis: { type: 'time' },
			yAxis: [{}, createEventStripYAxis()],
			graphic: mergeGraphicWithEventMarkLinePlaceholder(undefined, false),
			series: [
				createEventRailSeries({ eventRailData: events, eventStripYAxisIndex: 1, hoverState, shouldHideDataZoom: false })
			]
		})
		let x = 10
		const detach = attachEventHoverHandlers({
			instance: chart,
			eventRailData: events,
			hoverState,
			getEventMarkLineShape: () => ({ x1: x, y1: 1, x2: x, y2: 2 })
		})
		const markLine = () => {
			const line = (chart.getOption() as any).graphic[0].elements.find(
				(element: { id: string }) => element.id === 'echarts-hallmark-markline'
			)
			return { shape: line.shape, invisible: line.invisible }
		}

		emit('mouseover', { seriesName: 'Events', data: event })
		expect(markLine()).toEqual({ shape: { x1: 10, y1: 1, x2: 10, y2: 2 }, invisible: false })

		x = 20
		emit('finished')
		expect(markLine()).toEqual({ shape: { x1: 20, y1: 1, x2: 20, y2: 2 }, invisible: false })

		emit('mouseout', { seriesName: 'Events' })
		vi.advanceTimersByTime(40)
		expect(markLine().invisible).toBe(true)
		expect(hoverState.hoveredEventDate).toBeNull()

		detach()
		emit('mouseover', { seriesName: 'Events', data: event })
		expect(markLine().invisible).toBe(true)
	})
})
