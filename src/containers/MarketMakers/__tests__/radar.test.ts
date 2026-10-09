import { describe, expect, test } from 'vitest'
import { buildRadarOption } from '~/components/ECharts/RadarChart'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import { RADAR_INDICATORS, radarValues } from '../radar'

const scores = {
	composite: 9,
	tradingKpis: 8,
	trustIntegration: 7,
	coverageCapabilities: 6,
	uptime: 5,
	integrationLevel: 4
}

describe('market maker radar', () => {
	test('lists the scores in indicator order', () => {
		expect(radarValues(scores)).toEqual([9, 8, 7, 6, 5, 4])
	})

	test('draws missing scores at 0', () => {
		expect(
			radarValues({
				composite: null,
				tradingKpis: null,
				trustIntegration: null,
				coverageCapabilities: null,
				uptime: null,
				integrationLevel: null
			})
		).toEqual([0, 0, 0, 0, 0, 0])
	})

	test('names every score on one line in the tooltip, including the wrapped axis labels', () => {
		const option = buildRadarOption(RADAR_INDICATORS, radarValues(scores), getChartTheme(true))
		const tooltip = option.tooltip as { formatter: () => string }
		expect(tooltip.formatter()).toBe(
			'Composite Score: 9<br/>Trading KPIs: 8<br/>Trust: 7<br/>Coverage &amp; Capabilities: 6<br/>Uptime: 5<br/>Integration Level: 4'
		)
	})
})
