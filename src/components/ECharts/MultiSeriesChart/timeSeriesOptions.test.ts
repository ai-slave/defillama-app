import { expect, test } from 'vitest'
import { createSingleSeriesChartOptions } from './timeSeriesOptions'
import { createSingleSeriesTooltipFormatter } from './tooltip'

test('preserves a compact unnamed tooltip for single-series charts', () => {
	const tooltip = createSingleSeriesTooltipFormatter('$')([
		{
			seriesName: 'Semantic dataset key',
			marker: '•',
			data: { timestamp: 1_767_225_600_000, 'Semantic dataset key': 5 }
		}
	])

	expect(tooltip).toContain('•&nbsp;&nbsp;$5')
	expect(tooltip).not.toContain('Semantic dataset key')
})

test('formats single-series y-axis labels with the value symbol', () => {
	const yAxis = createSingleSeriesChartOptions('%')?.yAxis
	if (!yAxis || Array.isArray(yAxis) || typeof yAxis.axisLabel?.formatter !== 'function') {
		throw new Error('Expected a single y-axis with a formatter')
	}
	expect(yAxis.axisLabel.formatter(0.123456, 0, undefined)).toBe('0.12 %')
})
