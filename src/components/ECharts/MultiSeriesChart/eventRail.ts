import type { CustomSeriesOption, CustomSeriesRenderItemReturn } from 'echarts'
import type * as echarts from 'echarts/core'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { CHART_INSET, CHART_ZOOM_RESERVE } from '../shared/chartSpacing'
import { formatTooltipChartDate } from '../shared/formatters'
import type { MultiSeriesChartArrayRow, MultiSeriesYAxisOption } from './types'

const EVENT_DOT_SIZE = 16
const EVENT_DOT_RADIUS = EVENT_DOT_SIZE / 2
// Point events closer than this at the current zoom share one counted marker, so markers never overlap.
const EVENT_CLUSTER_GAP = EVENT_DOT_SIZE + 2
const EVENT_GLYPH_FONT = '700 10px sans-serif'
const EVENT_RANGE_FILL_OPACITY = 0.3
const EVENT_RANGE_HOVER_FILL_OPACITY = 0.55
const EVENT_RANGE_HOVER_AREA_OPACITY = 0.08
const EVENT_STRIP_VERTICAL_PADDING = 2
const EVENT_STRIP_HEIGHT = EVENT_DOT_SIZE + EVENT_STRIP_VERTICAL_PADDING * 2
const EVENT_STRIP_TOP_GAP = 2
export const EVENT_STRIP_BOTTOM_WITH_ZOOM = CHART_ZOOM_RESERVE - EVENT_STRIP_VERTICAL_PADDING
export const EVENT_STRIP_BOTTOM_NO_ZOOM = 6
const EVENT_HOVER_SCALE = 1.14
const EVENT_HOVER_ANIMATION_MS = 100
const EVENT_RAIL_SERIES_ID = 'echarts-hallmark-events'

// A label naming one of these draws red with a "!". Hack hallmarks lead with "Hack" or "Rug pull" (src/utils/hallmarks.ts).
const DANGER_KEYWORDS = ['depeg', 'hack', 'exploit', 'attack', 'rug']

export type EventRailDatum = {
	/** Only the rail's hidden y position: see `encode` in createEventRailSeries. */
	value: [number]
	fullText: string
	eventDate: number
	isDanger: boolean
	rangeStart?: number
	rangeEnd?: number
	fill: string
	border: string
	/** The glyph or count drawn on the fill. */
	ink: string
}

export type EventHoverState = {
	hoveredEventDate: number | null
}

type PlotRect = { x: number; y: number; width: number; height: number }
type RailElement = NonNullable<CustomSeriesRenderItemReturn>

function isEventHoverDatum(value: unknown): value is Pick<EventRailDatum, 'eventDate'> {
	return value !== null && typeof value === 'object' && 'eventDate' in value && typeof value.eventDate === 'number'
}

function isDangerLabel(label: string) {
	const normalized = label.toLowerCase()
	return DANGER_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

// Ramp steps as hex, because canvas cannot read var(); the contrast policy (rule 5) fails when a copy drifts from its
// token. Every point fill holds 3:1 on the plot surface and its ink 4.5:1 on the fill, so a marker reads by its fill,
// not only its 1px border: the light grey is step 9 with white ink, since step 8 is 2.9:1 on white.
const EVENT_DOTS = {
	danger: {
		fill: { light: ['--crimson-9', '#d11b3b'], dark: ['--crimson-9', '#d11a3b'] },
		border: { light: ['--crimson-11', '#bd0a31'], dark: ['--crimson-11', '#ff686f'] },
		ink: { light: '#ffffff', dark: '#ffffff' }
	},
	range: {
		fill: { light: ['--violet-9', '#7d4dd7'], dark: ['--violet-11', '#a884ff'] },
		border: { light: ['--violet-11', '#6f41c2'], dark: ['--violet-12', '#e3dcff'] },
		ink: { light: '#351e5f', dark: '#351e5f' }
	},
	other: {
		fill: { light: ['--neutral-9', '#6a6a6a'], dark: ['--neutral-11', '#989b9c'] },
		border: { light: ['--neutral-10', '#656565'], dark: ['--neutral-12', '#dee1e2'] },
		ink: { light: '#ffffff', dark: '#2b2b2b' }
	}
} as const

export function buildEventRailData({
	hallmarks,
	rangeHallmarks,
	isThemeDark
}: {
	hallmarks?: Array<[number, string]> | null | undefined
	rangeHallmarks?: Array<[[number, number], string]> | null | undefined
	isThemeDark: boolean
}) {
	const sortedEvents = [
		...(hallmarks ?? []).map(([timestamp, label]) => ({
			timestamp: timestamp * 1e3,
			fullText: label,
			isRange: false as const
		})),
		...(rangeHallmarks ?? []).map(([[start, end], label]) => {
			const normalizedStart = start * 1e3
			const normalizedEnd = end * 1e3

			return {
				timestamp: Math.round((normalizedStart + normalizedEnd) / 2),
				fullText: label,
				isRange: true as const,
				rangeStart: normalizedStart,
				rangeEnd: normalizedEnd
			}
		})
	].sort((a, b) => a.timestamp - b.timestamp)

	const mode = isThemeDark ? 'dark' : 'light'
	const events: Array<EventRailDatum> = sortedEvents.map((event) => {
		const isDanger = isDangerLabel(event.fullText)
		const dot = EVENT_DOTS[isDanger ? 'danger' : event.isRange ? 'range' : 'other']

		return {
			value: [0],
			fullText: event.fullText,
			eventDate: event.timestamp,
			isDanger,
			...(event.isRange ? { rangeStart: event.rangeStart, rangeEnd: event.rangeEnd } : {}),
			fill: dot.fill[mode][1],
			border: dot.border[mode][1],
			ink: dot.ink[mode]
		}
	})

	return { events }
}

/**
 * Groups the point events inside the plot into runs whose neighbours sit closer than EVENT_CLUSTER_GAP pixels.
 * Keys are each run's first index, the one item that draws the run's marker. Events arrive sorted by date.
 */
export function clusterPointEvents(
	events: Array<EventRailDatum>,
	toX: (date: number) => number,
	plotLeft: number,
	plotRight: number
) {
	const clusters = new Map<number, Array<number>>()
	let leader = -1
	let lastX = -Infinity
	for (let index = 0; index < events.length; index++) {
		const event = events[index]!
		if (event.rangeStart != null) continue
		const x = toX(event.eventDate)
		// Half a pixel of slack keeps the first and last day, which land on the plot edges.
		if (x < plotLeft - 0.5 || x > plotRight + 0.5) continue
		if (leader >= 0 && x - lastX < EVENT_CLUSTER_GAP) {
			clusters.get(leader)!.push(index)
		} else {
			leader = index
			clusters.set(index, [index])
		}
		lastX = x
	}
	return clusters
}

function getEventStripCenterY(chartHeight: number, shouldHideDataZoom: boolean) {
	const stripBottom = shouldHideDataZoom ? EVENT_STRIP_BOTTOM_NO_ZOOM : EVENT_STRIP_BOTTOM_WITH_ZOOM
	return chartHeight - stripBottom - EVENT_STRIP_HEIGHT / 2
}

export function getMainGridBottom({
	shouldShowEventRail,
	shouldHideDataZoom
}: {
	shouldShowEventRail: boolean
	shouldHideDataZoom: boolean
}) {
	if (!shouldShowEventRail) {
		return shouldHideDataZoom ? CHART_INSET : CHART_ZOOM_RESERVE
	}

	return shouldHideDataZoom
		? EVENT_STRIP_BOTTOM_NO_ZOOM + EVENT_STRIP_HEIGHT + EVENT_STRIP_TOP_GAP
		: EVENT_STRIP_BOTTOM_WITH_ZOOM + EVENT_STRIP_HEIGHT + EVENT_STRIP_TOP_GAP
}

export function createEventStripYAxis(): MultiSeriesYAxisOption {
	return {
		type: 'value',
		min: -1,
		max: 1,
		show: false,
		scale: true
	}
}

function readTimestampEndpoint(value: unknown) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
	if (typeof value !== 'string' || value.trim() === '') return undefined

	// Some API boundaries expose timestamps as numeric strings. Canonical chart rows
	// remain numeric, so valid endpoints still take the constant-time fast path.
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

export function getSeriesTimeBounds(data: ReadonlyArray<readonly [number | string, unknown] | unknown>) {
	let min: number | undefined
	let max: number | undefined
	for (const point of data) {
		if (!Array.isArray(point)) continue
		min = readTimestampEndpoint(point[0])
		if (min !== undefined) break
	}
	for (let index = data.length - 1; index >= 0; index--) {
		const point = data[index]
		if (!Array.isArray(point)) continue
		max = readTimestampEndpoint(point[0])
		if (max !== undefined) break
	}
	return { min, max }
}

export function getDatasetTimeBounds(source: Array<MultiSeriesChartArrayRow>, timestampIndex: number) {
	let min: number | undefined
	let max: number | undefined
	for (const row of source) {
		min = readTimestampEndpoint(row![timestampIndex])
		if (min !== undefined) break
	}
	for (let index = source.length - 1; index >= 0; index--) {
		max = readTimestampEndpoint(source[index]![timestampIndex])
		if (max !== undefined) break
	}
	return { min, max }
}

function eventTooltipBlock(event: EventRailDatum) {
	// Show the event's own date, or its date range, whatever grouping the chart uses.
	const header =
		event.rangeStart != null && event.rangeEnd != null
			? `${formatTooltipChartDate(event.rangeStart, 'daily')} - ${formatTooltipChartDate(event.rangeEnd, 'daily')}`
			: formatTooltipChartDate(event.eventDate, 'daily')

	return `${header}<li style="list-style:none;font-weight:600;">${escapeHtml(event.fullText)}</li>`
}

const blurOpaque = { style: { opacity: 1 } }

/**
 * A count, or "!", centred in the marker-sized square at (left, top). The "!" is drawn as a bar and a dot on whole
 * pixels: a 10px font's gap between them is under a pixel on a 1x screen and blurs into one bar.
 */
function glyph(text: string, left: number, top: number, ink: string): RailElement {
	if (text === '!') {
		const x = left + EVENT_DOT_RADIUS - 1
		return {
			type: 'group',
			silent: true,
			children: [
				{ type: 'rect', shape: { x, y: top + 3, width: 2, height: 6, r: 1 }, style: { fill: ink }, blur: blurOpaque },
				{ type: 'rect', shape: { x, y: top + 11, width: 2, height: 2, r: 1 }, style: { fill: ink }, blur: blurOpaque }
			]
		}
	}
	return {
		type: 'text',
		silent: true,
		style: {
			text,
			x: left + EVENT_DOT_RADIUS,
			y: top + EVENT_DOT_RADIUS + 0.5,
			align: 'center',
			verticalAlign: 'middle',
			fill: ink,
			font: EVENT_GLYPH_FONT
		},
		blur: blurOpaque
	}
}

export function createEventRailSeries({
	eventRailData,
	eventStripYAxisIndex,
	hoverState,
	shouldHideDataZoom,
	isThemeDark
}: {
	eventRailData: Array<EventRailDatum>
	eventStripYAxisIndex: number
	hoverState: EventHoverState
	shouldHideDataZoom: boolean
	isThemeDark: boolean
}): CustomSeriesOption {
	const guideColor = isThemeDark ? 'rgba(152, 155, 156, 0.7)' : 'rgba(106, 106, 106, 0.55)'
	const firstPointDate = eventRailData.find((event) => event.rangeStart == null)?.eventDate
	const lastPointDate = eventRailData.findLast((event) => event.rangeStart == null)?.eventDate
	// renderItem runs once per item, and the tooltip reads what was drawn. A time axis is linear, so the positions of
	// two dates and the plot edges pin the layout: zoom or resize changes the key, a hover redraw reuses it.
	let layout: { key: string; clusters: Map<number, Array<number>> } | null = null
	const getClusters = (toX: (date: number) => number, plot: PlotRect) => {
		const key = `${toX(firstPointDate!)}:${toX(lastPointDate!)}:${plot.x}:${plot.width}`
		if (layout?.key !== key) {
			layout = { key, clusters: clusterPointEvents(eventRailData, toX, plot.x, plot.x + plot.width) }
		}
		return layout.clusters
	}

	return {
		id: EVENT_RAIL_SERIES_ID,
		name: 'Events',
		type: 'custom',
		renderItem: (
			params: { dataIndex: number; coordSys: unknown },
			api: { coord: (value: [number, number]) => Array<number>; getHeight: () => number }
		) => {
			const event = eventRailData[params.dataIndex]!
			// ECharts types coordSys loosely; on the cartesian2d grid the rail uses, it is the plot rectangle.
			const plot = params.coordSys as PlotRect
			const toX = (date: number) => api.coord([date, 0])[0]!
			const top = getEventStripCenterY(api.getHeight(), shouldHideDataZoom) - EVENT_DOT_RADIUS
			const isHovered = hoverState.hoveredEventDate === event.eventDate

			if (event.rangeStart != null && event.rangeEnd != null) {
				const left = Math.max(plot.x, toX(event.rangeStart))
				const right = Math.min(plot.x + plot.width, toX(event.rangeEnd))
				if (right < left) return
				// A range shorter than a marker still draws a marker's width around its span, so it stays hoverable.
				const width = Math.max(EVENT_DOT_SIZE, right - left)
				const x = Math.round((left + right - width) / 2)
				const children: Array<RailElement> = [
					{
						type: 'rect',
						shape: { x, y: top, width, height: EVENT_DOT_SIZE, r: EVENT_DOT_RADIUS },
						style: {
							fill: event.fill,
							// A danger range (a depeg) stays solid with its "!", so it never reads fainter than a hack.
							fillOpacity: event.isDanger ? 1 : isHovered ? EVENT_RANGE_HOVER_FILL_OPACITY : EVENT_RANGE_FILL_OPACITY,
							stroke: event.border,
							lineWidth: 1
						},
						blur: blurOpaque
					}
				]
				if (event.isDanger) children.push(glyph('!', x, top, event.ink))
				if (isHovered) {
					children.push({
						type: 'rect',
						silent: true,
						shape: { x: left, y: plot.y, width: right - left, height: plot.height },
						style: { fill: event.fill, fillOpacity: EVENT_RANGE_HOVER_AREA_OPACITY }
					})
				}
				return { type: 'group', cursor: 'pointer', focus: 'none', emphasisDisabled: true, children }
			}

			const members = getClusters(toX, plot).get(params.dataIndex)
			// An earlier event's marker already counts this one, or it sits outside the zoomed plot.
			if (!members) return

			// A cluster takes the danger look when any member is a hack, so grouping never hides one.
			let look = event
			for (const index of members) {
				if (eventRailData[index]!.isDanger) {
					look = eventRailData[index]!
					break
				}
			}
			const label = members.length > 1 ? String(members.length) : look.isDanger ? '!' : ''
			const centerX = (toX(event.eventDate) + toX(eventRailData[members.at(-1)!]!.eventDate)) / 2
			const markerChildren: Array<RailElement> = [
				{
					type: 'circle',
					shape: { cx: EVENT_DOT_RADIUS, cy: EVENT_DOT_RADIUS, r: EVENT_DOT_RADIUS - 0.5 },
					style: { fill: look.fill, stroke: look.border, lineWidth: 1 },
					blur: blurOpaque
				}
			]
			if (label) markerChildren.push(glyph(label, 0, 0, look.ink))

			// The marker stays the first child, so ECharts keeps the element and animates the hover scale.
			const children: Array<RailElement> = [
				{
					type: 'group',
					// Whole pixels keep the 1px ring and the glyph crisp.
					x: Math.round(centerX) - EVENT_DOT_RADIUS,
					y: top,
					originX: EVENT_DOT_RADIUS,
					originY: EVENT_DOT_RADIUS,
					scaleX: isHovered ? EVENT_HOVER_SCALE : 1,
					scaleY: isHovered ? EVENT_HOVER_SCALE : 1,
					transition: ['scaleX', 'scaleY'],
					updateAnimation: { duration: EVENT_HOVER_ANIMATION_MS, easing: 'cubicOut' },
					children: markerChildren
				}
			]
			if (isHovered) {
				// One guide per member shows where each counted event sits on the plot.
				for (const index of members) {
					const x = toX(eventRailData[index]!.eventDate)
					children.push({
						type: 'line',
						silent: true,
						shape: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height },
						style: { stroke: guideColor, lineWidth: 1, lineDash: [6, 4] }
					})
				}
			}
			return { type: 'group', cursor: 'pointer', focus: 'none', emphasisDisabled: true, children }
		},
		clip: false,
		xAxisIndex: 0,
		yAxisIndex: eventStripYAxisIndex,
		data: eventRailData,
		z: 20,
		silent: false,
		animation: false,
		// No x dimension, so dataZoom never filters the rail: it filtered a range whose midpoint left the window, and an
		// event just outside it that could lead a cluster. renderItem places, clips and clusters every event itself.
		encode: { y: 0 },
		tooltip: {
			trigger: 'item',
			formatter: (params: { dataIndex: number }) => {
				const members = layout?.clusters.get(params.dataIndex) ?? [params.dataIndex]
				return members.map((index) => eventTooltipBlock(eventRailData[index]!)).join('<div style="height:6px"></div>')
			}
		}
	}
}

export function attachEventHoverHandlers({
	instance,
	eventRailData,
	hoverState
}: {
	instance: echarts.ECharts
	eventRailData: Array<EventRailDatum>
	hoverState: EventHoverState
}) {
	if (eventRailData.length === 0) return () => {}
	let clearHoverTimer: ReturnType<typeof setTimeout> | null = null

	const setHoveredEvent = (eventDate: number | null) => {
		if (instance.isDisposed() || hoverState.hoveredEventDate === eventDate) return
		hoverState.hoveredEventDate = eventDate
		// Redrawing the rail scales the hovered marker and draws its guides.
		instance.setOption({ series: [{ id: EVENT_RAIL_SERIES_ID, data: eventRailData }] })
	}

	const handleEventMouseOver = (params: { seriesName?: string; data?: unknown }) => {
		if (params.seriesName !== 'Events') return
		if (clearHoverTimer != null) clearTimeout(clearHoverTimer)
		clearHoverTimer = null
		if (isEventHoverDatum(params.data)) setHoveredEvent(params.data.eventDate)
	}

	// The pointer crossing between a marker's own shapes fires mouseout then mouseover; the delay keeps it from flickering.
	const handleEventMouseOut = (params: { seriesName?: string }) => {
		if (params.seriesName !== 'Events') return
		if (clearHoverTimer != null) clearTimeout(clearHoverTimer)
		clearHoverTimer = setTimeout(() => {
			clearHoverTimer = null
			setHoveredEvent(null)
		}, 40)
	}

	instance.on('mouseover', handleEventMouseOver)
	instance.on('mouseout', handleEventMouseOut)

	return () => {
		if (clearHoverTimer != null) clearTimeout(clearHoverTimer)
		if (instance.isDisposed()) return
		instance.off('mouseover', handleEventMouseOver)
		instance.off('mouseout', handleEventMouseOut)
	}
}
