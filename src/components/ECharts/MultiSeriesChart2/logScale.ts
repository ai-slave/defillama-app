// Applies logarithmic scaling to the eligible value y-axes of a MultiSeriesChart2 option.
// The Log/Linear toggle sets `logScale`; `logEligibleYAxes` (from getLogEligibleYAxes) lists the
// axis indices whose series are all strictly positive — a log axis cannot plot zero/negative
// values, so ineligible axes are left linear. A log axis also cannot sit on a 0 baseline, so any
// `min`/`max` (e.g. the 0 baseline or the percentage-mode 0–100 clamp) is dropped for it.
export function applyLogScaleToYAxes(
	axes: any[],
	logScale: boolean | undefined,
	logEligibleYAxes: number[] | undefined
): any[] {
	if (!logScale || !Array.isArray(axes)) return axes
	const eligible = logEligibleYAxes ?? []
	return axes.map((axis, index) => {
		if (!eligible.includes(index)) return axis
		const { min: _min, max: _max, ...rest } = axis ?? {}
		return { ...rest, type: 'log' }
	})
}
