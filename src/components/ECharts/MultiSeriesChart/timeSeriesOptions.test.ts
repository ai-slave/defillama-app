import { expect, it } from 'vitest'
import { CHART_INSET } from '../shared/chartSpacing'
import { createSingleSeriesChartOptions } from './timeSeriesOptions'
import { createSingleSeriesTooltipFormatter } from './tooltip'

it('preserves a compact unnamed tooltip for single-series charts', () => {
	const tooltip = createSingleSeriesTooltipFormatter('$')([
		{ seriesName: 'Semantic dataset key', marker: '•', data: { timestamp: 1767225600000, 'Semantic dataset key': 5 } }
	])

	expect(tooltip).toContain('•&nbsp;&nbsp;$5')
	expect(tooltip).not.toContain('Semantic dataset key')
})

it('preserves the compact single-series grid and axis formatting', () => {
	const options = createSingleSeriesChartOptions('%')
	const grid = Array.isArray(options?.grid) ? options.grid[0] : options?.grid

	expect(grid?.top).toBe(CHART_INSET)
	expect(options?.xAxis).toMatchObject({ axisLabel: { hideOverlap: false } })
	expect(options?.yAxis).toMatchObject({ min: undefined, axisLabel: { formatter: expect.any(Function) } })
	expect(options?.yAxis).not.toHaveProperty('scale')
	expect(Array.isArray(options?.yAxis)).toBe(false)
	const yAxis = options?.yAxis
	if (!yAxis || Array.isArray(yAxis) || typeof yAxis.axisLabel?.formatter !== 'function') {
		throw new Error('Expected a single y-axis with a formatter')
	}
	expect(yAxis.axisLabel.formatter(0.123456, 0, undefined)).toBe('0.12 %')
})
