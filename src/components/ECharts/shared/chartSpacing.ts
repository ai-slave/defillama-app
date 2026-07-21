import type { GridComponentOption, LegendComponentOption, ScrollableLegendComponentOption } from 'echarts'

/**
 * Charts sit in Cards with
 * padding="none" and must self-inset a VISUAL 8px on all sides.
 *
 * ECharts nuance: grid.left/right/top/bottom position the PLOT RECT and axis
 * labels render outside it — a raw `left: 8` does not give an 8px visual gap.
 * With `outerBoundsMode: 'same'` + `outerBoundsContain: 'axisLabel'` the
 * offsets become OUTER bounds and the plot shrinks inward so labels fit
 * inside them: `left: 8` then means "outermost label ink starts 8px in".
 *
 * The dataZoom slider and legend are positioned independently of the grid —
 * they get their own optical offsets here; grid.top/bottom only RESERVE the rows:
 *   top (with legend):  8 inset + ~24 legend row + 8 gap  = LEGEND_RESERVE
 *   bottom (with zoom): 12 inset + 37 visible slider + 8 gap = ZOOM_RESERVE
 */
export const CHART_INSET = 8

export const CHART_SLIDER_HEIGHT = 30
// ECharts paints the 7px move handle below the slider's 30px layout box and
// the 6px end handles beyond its right edge. Compensate on those two sides so
// the visible slider ink, rather than only its layout box, honors the inset.
const CHART_SLIDER_MOVE_HANDLE_SIZE = 7
const CHART_SLIDER_END_HANDLE_WIDTH = 6
const CHART_SLIDER_BOTTOM_INSET = 12
export const CHART_ZOOM_RESERVE =
	CHART_SLIDER_BOTTOM_INSET + CHART_SLIDER_HEIGHT + CHART_SLIDER_MOVE_HANDLE_SIZE + CHART_INSET // 57
export const CHART_LEGEND_RESERVE = 40
export const CHART_VERTICAL_LEGEND_RIGHT_INSET = 16

/**
 * Keep horizontal scroll-legend ink 8px from both edges without forcing `left`.
 * ECharts right-aligns short legends and uses the left padding as the clip edge
 * only when the legend overflows and paging controls appear.
 */
export const chartHorizontalScrollLegendGeometry = {
	right: CHART_INSET,
	padding: [5, 0, 5, CHART_INSET]
}

export function chartHorizontalScrollLegend(
	legend: LegendComponentOption,
	scrollStyle: Partial<ScrollableLegendComponentOption> = {}
): ScrollableLegendComponentOption {
	return {
		...scrollStyle,
		...legend,
		type: 'scroll',
		orient: legend.orient ?? 'horizontal',
		pageButtonPosition: ('pageButtonPosition' in legend ? legend.pageButtonPosition : undefined) ?? 'end',
		top: legend.top ?? CHART_INSET,
		padding: legend.padding ?? chartHorizontalScrollLegendGeometry.padding,
		right: legend.right ?? chartHorizontalScrollLegendGeometry.right
	}
}

/** Standard cartesian grid; spread and override top/bottom for legend/zoom reserves. */
export const chartGrid = (overrides?: Partial<GridComponentOption>): GridComponentOption => ({
	left: CHART_INSET,
	right: CHART_INSET,
	top: CHART_INSET,
	bottom: CHART_INSET,
	outerBoundsMode: 'same',
	outerBoundsContain: 'axisLabel',
	...overrides
})

/** Slider geometry merged into dataZoom slider entries (colors stay in chartTheme). */
export const chartDataZoomSliderGeometry = {
	left: CHART_INSET,
	right: CHART_INSET + CHART_SLIDER_END_HANDLE_WIDTH,
	bottom: CHART_SLIDER_BOTTOM_INSET + CHART_SLIDER_MOVE_HANDLE_SIZE,
	height: CHART_SLIDER_HEIGHT
} as const

/** Theme-aware paging controls for ECharts scroll legends. */
export const chartLegendScrollStyle = (activeColor: string, inactiveColor: string, pageTextColor: string) => ({
	pageIconColor: activeColor,
	pageIconInactiveColor: inactiveColor,
	pageTextStyle: { color: pageTextColor }
})
