import type * as echarts from 'echarts/core'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	type EventHoverState,
	type EventRailDatum,
	getDatasetTimeBounds,
	getSeriesTimeBounds
} from './eventRail'

afterEach(() => {
	vi.useRealTimers()
})

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

	test('replaces hover listeners, repositions an active mark line, and cancels pending cleanup', () => {
		vi.useFakeTimers()
		const handlers = new Map<string, (...args: Array<any>) => void>()
		const on = vi.fn((event: string, handler: (...args: Array<any>) => void) => handlers.set(event, handler))
		const off = vi.fn((event: string, handler: (...args: Array<any>) => void) => {
			if (handlers.get(event) === handler) handlers.delete(event)
		})
		const setOption = vi.fn()
		const instance = {
			isDisposed: () => false,
			on,
			off,
			setOption
		} as unknown as echarts.ECharts
		const event = {
			value: [100, 0],
			eventDate: 100,
			fullText: 'Upgrade',
			iconPath: '',
			iconSize: 1,
			iconOffsetY: 0,
			iconColor: '#fff',
			itemStyle: { color: '#fff', borderColor: '#fff', borderWidth: 1 }
		} satisfies EventRailDatum
		const hoverState: EventHoverState = { hoveredEventDate: null }
		let x = 10

		const cleanupFirst = attachEventHoverHandlers({
			instance,
			eventRailData: [event],
			hoverState,
			getEventMarkLineShape: () => ({ x1: x, y1: 1, x2: x, y2: 2 })
		})
		handlers.get('mouseover')?.({ seriesName: 'Events', data: event })
		expect(setOption).toHaveBeenLastCalledWith({
			graphic: [{ id: 'echarts-hallmark-markline', shape: { x1: 10, y1: 1, x2: 10, y2: 2 }, invisible: false }]
		})

		x = 20
		handlers.get('finished')?.()
		expect(setOption).toHaveBeenLastCalledWith({
			graphic: [{ id: 'echarts-hallmark-markline', shape: { x1: 20, y1: 1, x2: 20, y2: 2 }, invisible: false }]
		})

		handlers.get('mouseout')?.({ seriesName: 'Events' })
		cleanupFirst()
		const callsAfterCleanup = setOption.mock.calls.length
		vi.advanceTimersByTime(40)
		expect(setOption).toHaveBeenCalledTimes(callsAfterCleanup)
		expect(handlers.size).toBe(0)

		const cleanupSecond = attachEventHoverHandlers({
			instance,
			eventRailData: [{ ...event, eventDate: 200, value: [200, 0] }],
			hoverState,
			getEventMarkLineShape: () => ({ x1: 30, y1: 1, x2: 30, y2: 2 })
		})
		cleanupSecond()

		expect(on.mock.calls.map(([name]) => name)).toEqual([
			'mouseover',
			'mouseout',
			'datazoom',
			'finished',
			'mouseover',
			'mouseout',
			'datazoom',
			'finished'
		])
		expect(off.mock.calls.map(([name]) => name)).toEqual(on.mock.calls.map(([name]) => name))
	})
})
