import { describe, expect, it } from 'vitest'
import { buildRadarOption } from '../RadarChart'

describe('buildRadarOption', () => {
	it('lists the six indicators in order each capped at 10', () => {
		const option = buildRadarOption({
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		})
		const radar = option.radar as { indicator: { name: string; max: number }[] }
		expect(radar.indicator.map((i) => i.name)).toEqual([
			'Composite Score',
			'Trading KPIs',
			'Trust & Integration',
			'Coverage & Capabilities',
			'Uptime',
			'Integration Level'
		])
		expect(radar.indicator.every((i) => i.max === 10)).toBe(true)
	})

	it('maps scores into the data array in indicator order', () => {
		const option = buildRadarOption({
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		})
		const series = option.series as { data: { value: number[] }[] }[]
		expect(series[0].data[0].value).toEqual([9, 8, 7, 6, 5, 4])
	})

	it('coerces null scores to 0 in the data array', () => {
		const option = buildRadarOption({
			composite: null,
			tradingKpis: null,
			trustIntegration: null,
			coverageCapabilities: null,
			uptime: null,
			integrationLevel: null
		})
		const series = option.series as { data: { value: number[] }[] }[]
		expect(series[0].data[0].value).toEqual([0, 0, 0, 0, 0, 0])
	})
})
