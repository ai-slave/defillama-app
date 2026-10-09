import type { RadarIndicator } from '~/components/ECharts/RadarChart'

export type RadarScores = {
	composite: number | null
	tradingKpis: number | null
	trustIntegration: number | null
	coverageCapabilities: number | null
	uptime: number | null
	integrationLevel: number | null
}

const SCORE_KEYS: Array<keyof RadarScores> = [
	'composite',
	'tradingKpis',
	'trustIntegration',
	'coverageCapabilities',
	'uptime',
	'integrationLevel'
]

// The side labels get about 80px beside the chart in a 375px-wide drawer, so the two longest wrap onto two lines.
export const RADAR_INDICATORS: ReadonlyArray<RadarIndicator> = [
	{ name: 'Composite Score', max: 10 },
	{ name: 'Trading\nKPIs', max: 10 },
	{ name: 'Trust', max: 10 },
	{ name: 'Coverage & Capabilities', max: 10 },
	{ name: 'Uptime', max: 10 },
	{ name: 'Integration\nLevel', max: 10 }
]

/** Scores in RADAR_INDICATORS order; a missing score draws at 0. */
export function radarValues(scores: RadarScores): Array<number> {
	return SCORE_KEYS.map((key) => scores[key] ?? 0)
}
