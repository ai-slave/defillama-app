import { describe, expect, it } from 'vitest'
import { CHART_INSET } from './chartSpacing'
import {
	asTooltipDataRecord,
	createSignedInflowsTooltipFormatter,
	createSingleSeriesTooltipFormatter
} from './formatters'
import { createSingleSeriesChartOptions } from './timeSeriesChartOptions'

it('reads object tooltip rows without cloning them', () => {
	const row = { timestamp: 1767225600000, Value: 5 }
	expect(asTooltipDataRecord(row)).toBe(row)
})

it('preserves a compact unnamed tooltip for single-series charts', () => {
	const formatter = createSingleSeriesTooltipFormatter('$')
	const tooltip = formatter([
		{ seriesName: 'Semantic dataset key', marker: '•', data: { timestamp: 1767225600000, 'Semantic dataset key': 5 } }
	])

	expect(tooltip).toContain('•&nbsp;&nbsp;$5')
	expect(tooltip).not.toContain('Semantic dataset key')
})

it('preserves the compact single-series grid and axis formatting', () => {
	const options = createSingleSeriesChartOptions('%')

	expect(options?.grid?.top).toBe(CHART_INSET)
	expect(options?.xAxis).toMatchObject({ axisLabel: { hideOverlap: false } })
	expect(options?.yAxis).toMatchObject({ min: undefined, axisLabel: { formatter: expect.any(Function) } })
	expect(Array.isArray(options?.yAxis)).toBe(false)
	const axisLabel = (options!.yAxis as { axisLabel: { formatter: (value: number) => string } }).axisLabel
	expect(axisLabel.formatter(0.123456)).toBe('0.12 %')
})

describe('signed inflows tooltip', () => {
	it('sorts signed values ascending and always includes the total', () => {
		const formatter = createSignedInflowsTooltipFormatter('$')
		const tooltip = formatter([
			{ seriesName: 'Gain', data: { timestamp: 1767225600000, Gain: 30 } },
			{ seriesName: 'Loss', data: { timestamp: 1767225600000, Loss: -10 } }
		])

		expect(tooltip.indexOf('Loss')).toBeLessThan(tooltip.indexOf('Gain'))
		expect(tooltip.indexOf('Total Inflows')).toBeLessThan(tooltip.indexOf('Loss'))
		expect(tooltip).toContain('Total Inflows')
		expect(tooltip).toContain('$20')
	})

	it('combines explicit and capped Others after the signed rows', () => {
		const formatter = createSignedInflowsTooltipFormatter('$')
		const timestamp = 1767225600000
		const params = Array.from({ length: 11 }, (_, index) => ({
			seriesName: `Flow ${index}`,
			marker: '',
			data: { timestamp, [`Flow ${index}`]: index + 1 }
		}))
		params.push({ seriesName: 'Others', marker: 'O', data: { timestamp, Others: 5 } })
		const tooltip = formatter(params)

		expect(tooltip.indexOf('Total Inflows')).toBeLessThan(tooltip.indexOf('Flow 0'))
		expect(tooltip.indexOf('Others')).toBeGreaterThan(tooltip.indexOf('Flow 9'))
		expect(tooltip.match(/Others/g)).toHaveLength(1)
		expect(tooltip).toContain('OOthers&nbsp;&nbsp;$16')
	})

	it('includes a total for a single series', () => {
		const formatter = createSignedInflowsTooltipFormatter('')
		const tooltip = formatter([{ seriesName: 'Inflows', data: { timestamp: 1767225600000, Inflows: 5 } }])

		expect(tooltip).toContain('Inflows')
		expect(tooltip).toContain('Total Inflows')
	})

	it('can preserve the unnamed single-series inflow tooltip', () => {
		const formatter = createSignedInflowsTooltipFormatter('$', true)
		const tooltip = formatter([
			{ seriesName: 'USD Inflows', marker: '•', data: { timestamp: 1767225600000, 'USD Inflows': 5 } }
		])

		expect(tooltip).toContain('•&nbsp;&nbsp;$5')
		expect(tooltip).not.toContain('USD Inflows')
		expect(tooltip).toContain('Total Inflows')
	})

	it('keeps only the ten lowest signed values without changing stable tie order', () => {
		const formatter = createSignedInflowsTooltipFormatter('$')
		const timestamp = 1767225600000
		const tooltip = formatter(
			[12, -5, -5, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((value, index) => ({
				seriesName: `Flow ${index}`,
				data: { timestamp, [`Flow ${index}`]: value }
			}))
		)

		expect(tooltip).not.toContain('Flow 0')
		expect(tooltip).not.toContain('Flow 3')
		expect(tooltip.indexOf('Flow 1')).toBeLessThan(tooltip.indexOf('Flow 2'))
		expect(tooltip.indexOf('Flow 2')).toBeLessThan(tooltip.indexOf('Flow 11'))
		expect(tooltip).toContain('Others&nbsp;&nbsp;$23')
		expect(tooltip).toContain('Total Inflows&nbsp;&nbsp;$65')
	})
})
