import type { MultiSeriesYAxisOption } from './types'

// Applies logarithmic scaling to the eligible value y-axes of a MultiSeriesChart option.
// The Log/Linear toggle sets `logScale`; `logEligibleYAxes` (from getLogEligibleYAxes) lists the
// axis indices whose series are all strictly positive — a log axis cannot plot zero/negative
// values, so ineligible axes are left linear. A log axis cannot sit on a non-positive bound, but
// positive and data-driven caller bounds remain valid and must survive the final render pass.
type AxisExtent = {
	min?: number
}

export function getZeroBaselineYAxisMin(extent: AxisExtent) {
	return typeof extent.min === 'number' && extent.min < 0 ? extent.min : 0
}

type YAxisOption = MultiSeriesYAxisOption | undefined
type YAxisOptions = YAxisOption | YAxisOption[]

function removeImplicitMinimum(axis: YAxisOption, configuredAxis: YAxisOption) {
	if (
		!axis ||
		configuredAxis?.type === 'log' ||
		configuredAxis?.scale !== true ||
		Object.hasOwn(configuredAxis, 'min') ||
		axis.min !== getZeroBaselineYAxisMin
	) {
		return axis
	}

	const { min: _implicitMin, ...scaledAxis } = axis
	return scaledAxis
}

// ECharts `scale: true` opts out of including zero only when no explicit min is present.
// Remove our shared implicit baseline for callers that request scaling, but keep caller bounds.
export function applyConfiguredYAxisScale(yAxis: YAxisOptions, configuredYAxis: YAxisOptions): YAxisOptions {
	if (Array.isArray(yAxis)) {
		return yAxis.map((axis, index) =>
			removeImplicitMinimum(axis, Array.isArray(configuredYAxis) ? configuredYAxis[index] : configuredYAxis)
		)
	}

	return removeImplicitMinimum(yAxis, Array.isArray(configuredYAxis) ? configuredYAxis[0] : configuredYAxis)
}

export function applyLogScaleToYAxes(
	axes: MultiSeriesYAxisOption[],
	logScale: boolean | undefined,
	logEligibleYAxes: number[] | undefined
): MultiSeriesYAxisOption[] {
	if (!logScale || !Array.isArray(axes)) return axes
	const eligible = logEligibleYAxes ?? []
	return axes.map((axis, index) => {
		if (!eligible.includes(index)) return axis
		// ECharts gives value/log axes distinct generic axis-label types even though both
		// format numeric values. This is the one internal discriminant conversion; callers
		// still provide a checked ECharts y-axis option at the renderer boundary.
		const next = { ...axis, type: 'log' } as Extract<MultiSeriesYAxisOption, { type?: 'log' }>
		if (next.min === getZeroBaselineYAxisMin || (typeof next.min === 'number' && next.min <= 0)) delete next.min
		if (typeof next.max === 'number' && next.max <= 0) delete next.max
		return next
	})
}
