import type { CustomSeriesOption } from 'echarts'
import { formatTooltipChartDate } from '../shared/formatters'
import { asTooltipDataRecord } from '../shared/tooltip'
import { EVENT_STRIP_BOTTOM_NO_ZOOM, EVENT_STRIP_BOTTOM_WITH_ZOOM } from './eventRail'

/** One coloured cell per period under the plot, on the event rail's hidden y-axis; never drawn beside the rail. */
export interface StateTimelinePoint {
	/** Period centre, in the dataset's timestamp unit (ms). */
	timestamp: number
	color: string
	/** The cell's tooltip line. */
	label: string
}

export interface StateTimelineOption {
	points: Array<StateTimelinePoint>
	/** Period length; each cell spans half of it either side of its timestamp so neighbours touch. */
	stepMs: number
}

const STRIP_HEIGHT = 8
const STRIP_TOP_GAP = 6
const STATE_TIMELINE_SERIES_ID = 'echarts-state-timeline'

export function getStateTimelineGridBottom(shouldHideDataZoom: boolean) {
	return (shouldHideDataZoom ? EVENT_STRIP_BOTTOM_NO_ZOOM : EVENT_STRIP_BOTTOM_WITH_ZOOM) + STRIP_HEIGHT + STRIP_TOP_GAP
}

export function createStateTimelineSeries({
	timeline,
	yAxisIndex,
	shouldHideDataZoom
}: {
	timeline: StateTimelineOption
	yAxisIndex: number
	shouldHideDataZoom: boolean
}): CustomSeriesOption {
	const half = timeline.stepMs / 2
	const bottom = shouldHideDataZoom ? EVENT_STRIP_BOTTOM_NO_ZOOM : EVENT_STRIP_BOTTOM_WITH_ZOOM
	return {
		id: STATE_TIMELINE_SERIES_ID,
		name: 'Timeline',
		type: 'custom',
		renderItem: (
			params: { dataIndex: number },
			api: { coord: (value: [number, number]) => Array<number>; getHeight: () => number }
		) => {
			const point = timeline.points[params.dataIndex]
			if (!point) return
			const [left] = api.coord([point.timestamp - half, 0])
			const [right] = api.coord([point.timestamp + half, 0])
			if (typeof left !== 'number' || typeof right !== 'number' || !Number.isFinite(left) || !Number.isFinite(right))
				return
			// A day narrower than a pixel still draws a pixel, so a one-day outage survives Max range.
			const width = Math.max(1, right - left)
			return {
				type: 'rect',
				shape: { x: left, y: api.getHeight() - bottom - STRIP_HEIGHT, width, height: STRIP_HEIGHT },
				style: { fill: point.color },
				emphasisDisabled: true
			}
		},
		clip: false,
		xAxisIndex: 0,
		yAxisIndex,
		data: timeline.points.map((point) => ({ value: [point.timestamp, 0], label: point.label })),
		z: 20,
		silent: false,
		animation: false,
		encode: { x: 0, y: 1 },
		tooltip: {
			trigger: 'item',
			formatter: (rawParams: unknown) => {
				const params = asTooltipDataRecord(rawParams)
				const point = asTooltipDataRecord(params?.data)
				const value = Array.isArray(point?.value) ? point.value[0] : null
				if (typeof value !== 'number' || typeof point?.label !== 'string') return ''
				return `${formatTooltipChartDate(value, 'daily')}<li style="list-style:none;font-weight:600;">${point.label}</li>`
			}
		}
	}
}
