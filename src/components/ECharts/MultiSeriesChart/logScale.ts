import { mergeDeep } from '../shared/merge'
import type { MultiSeriesYAxisOption, MultiSeriesYAxisOverride } from './types'

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
type YAxisOptions = YAxisOption | MultiSeriesYAxisOption[]
type ConfiguredYAxisOption = MultiSeriesYAxisOverride | undefined
type ConfiguredYAxisOptions = ConfiguredYAxisOption | MultiSeriesYAxisOverride[]

export function mergeYAxisOption(
	base: MultiSeriesYAxisOption,
	override: MultiSeriesYAxisOverride
): MultiSeriesYAxisOption {
	const merged = mergeDeep(base, override)
	if (merged.type === 'log') {
		if ('scale' in merged) delete merged.scale
	} else if ('logBase' in merged) {
		delete merged.logBase
	}
	if (Object.hasOwn(override, 'min') && override.min === undefined) delete merged.min
	return merged
}

function removeImplicitMinimum(axis: MultiSeriesYAxisOption, configuredAxis: ConfiguredYAxisOption) {
	if (
		!configuredAxis ||
		configuredAxis?.type === 'log' ||
		!('scale' in configuredAxis) ||
		configuredAxis.scale !== true ||
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
export function applyConfiguredYAxisScale(yAxis: YAxisOptions, configuredYAxis: ConfiguredYAxisOptions): YAxisOptions {
	if (Array.isArray(yAxis)) {
		return yAxis.map((axis, index) =>
			removeImplicitMinimum(axis, Array.isArray(configuredYAxis) ? configuredYAxis[index] : configuredYAxis)
		)
	}

	if (!yAxis) return yAxis
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
		if (axis.type === 'log') {
			const next = { ...axis }
			if (next.min === getZeroBaselineYAxisMin || (typeof next.min === 'number' && next.min <= 0)) delete next.min
			if (typeof next.max === 'number' && next.max <= 0) delete next.max
			return next
		}
		const { type: _valueAxisType, scale: _valueAxisScale, ...sharedAxis } = axis
		// ECharts gives value/log axes distinct generic axis-label types even though both
		// format numeric values. Seed the log variant, then merge the shared numeric fields;
		// callers still provide a checked ECharts y-axis option at the renderer boundary.
		const next = mergeDeep<Extract<MultiSeriesYAxisOption, { type: 'log' }>>({ type: 'log' }, sharedAxis)
		if (next.min === getZeroBaselineYAxisMin || (typeof next.min === 'number' && next.min <= 0)) delete next.min
		if (typeof next.max === 'number' && next.max <= 0) delete next.max
		return next
	})
}
