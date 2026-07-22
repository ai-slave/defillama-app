import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AggregatedMetrics } from '../PerformanceIndex/data'
import { Podium } from '../PerformanceIndex/Podium'
import { Superlatives } from '../PerformanceIndex/Superlatives'
import type { PerformanceRow } from '../PerformanceIndex/types'

const row = (
	id: string,
	name: string,
	composite: number | null,
	activeEngagementsCount: number | null = null,
	medianEngagementsFdv: number | null = null
): PerformanceRow => ({
	marketMakerId: id,
	marketMakerName: name,
	marketMakerImageUrl: null,
	composite,
	grade: null,
	tradingKpis: composite,
	trustIntegration: composite,
	coverageCapabilities: composite,
	uptime: composite,
	integrationLevel: 3,
	integrationStatus: 'full',
	activeEngagementsCount,
	medianEngagementsFdv
})

const agg = (
	id: string,
	name: string,
	depth: number,
	spread: number,
	volume: number,
	uptime: number
): AggregatedMetrics => ({
	marketMakerId: id,
	marketMakerName: name,
	marketMakerImageUrl: null,
	bidAskDepth: { value: depth, percentile: null, rank: 1 },
	topOfBookSpread: { value: spread, percentile: null, rank: 2 },
	dailyFillVolume: { value: volume, percentile: null, rank: 3 },
	combinedUptime: { value: uptime, percentile: null, rank: 1 }
})

const aggregated: Record<string, AggregatedMetrics> = {
	lhava: agg('lhava', 'Lhava', 1_000_000, 0.05, 5_000_000, 99.9),
	wintermute: agg('wintermute', 'Wintermute', 2_000_000, 0.2, 9_000_000, 95)
}

describe('Podium', () => {
	it('renders the top 3 by composite with rank badges and stats', () => {
		const rows = [
			row('gsr', 'GSR', 1),
			row('lhava', 'Lhava', 9.5, 12, 250_000_000),
			row('wintermute', 'Wintermute', 7, 30, 500_000_000)
		]
		const html = renderToStaticMarkup(<Podium rows={rows} aggregated={aggregated} />)
		expect(html).toContain('Lhava')
		expect(html).toContain('9.50')
		expect(html).toContain('12 active engagements')
		expect(html).toContain('Composite Score')
		expect(html).toContain('Avg 2.00% Depth')
		expect(html).toContain('Rank:')
		expect(html).toContain('#C9971C')
	})
})

describe('Superlatives', () => {
	it('selects max depth/volume/uptime and min spread leaders, with the timeframe period in each label', () => {
		const html = renderToStaticMarkup(<Superlatives aggregated={aggregated} period="7D" />)
		expect(html).toContain('Top Avg. (+/-) 2.00% Depth (7D)')
		expect(html).toContain('Highest Volume (Maker &amp; Taker) (7D)')
		expect(html).toContain('Top Bid-Ask Spread (7D)')
		expect(html).toContain('Top KPI Adherence — Combined Uptime (7D)')
		expect(html).toContain('Wintermute')
		expect(html).toContain('Lhava')
	})
})
