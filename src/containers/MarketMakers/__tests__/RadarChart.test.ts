import { describe, expect, test } from 'vitest'
import { buildRadarOption } from '../RadarChart'

describe('buildRadarOption', () => {
	test('maps scores into the data array in indicator order', () => {
		const option = buildRadarOption({
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		})
		const series = option.series as Array<{ data: Array<{ value: Array<number> }> }>
		expect(series[0].data[0].value).toEqual([9, 8, 7, 6, 5, 4])
	})

	test('coerces null scores to 0 in the data array', () => {
		const option = buildRadarOption({
			composite: null,
			tradingKpis: null,
			trustIntegration: null,
			coverageCapabilities: null,
			uptime: null,
			integrationLevel: null
		})
		const series = option.series as Array<{ data: Array<{ value: Array<number> }> }>
		expect(series[0].data[0].value).toEqual([0, 0, 0, 0, 0, 0])
	})

	test('names every score on one line in the tooltip, including the wrapped axis labels', () => {
		const option = buildRadarOption({
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		})
		const tooltip = option.tooltip as { formatter: () => string }
		expect(tooltip.formatter()).toBe(
			'Composite Score: 9<br/>Trading KPIs: 8<br/>Trust: 7<br/>Coverage & Capabilities: 6<br/>Uptime: 5<br/>Integration Level: 4'
		)
	})
})
