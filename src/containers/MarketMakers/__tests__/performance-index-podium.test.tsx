import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { AggregatedMetrics } from '../PerformanceIndex/data'
import { Podium } from '../PerformanceIndex/Podium'
import { superlativeLeaders, Superlatives } from '../PerformanceIndex/Superlatives'
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
	test('renders the top 3 by composite with rank badges and stats', () => {
		const rows = [
			row('missing', 'No score', null),
			row('fourth', 'Fourth place', 0),
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
		expect(html).not.toContain('Fourth place')
		expect(html).not.toContain('No score')
		expect(html).toContain('GSR')
		expect(html).toContain('Wintermute')
	})
})

describe('Superlatives', () => {
	test('the deepest, busiest and most available maker win their cards, and the tightest spread wins spread', () => {
		const leaders = superlativeLeaders(aggregated)
		expect(
			[leaders.depth, leaders.volume, leaders.spread, leaders.uptime].map((leader) => leader?.marketMakerId)
		).toEqual(['wintermute', 'wintermute', 'lhava', 'lhava'])
	})

	test('every card names the timeframe period', () => {
		const html = renderToStaticMarkup(<Superlatives aggregated={aggregated} period="7D" />)
		expect(html).toContain('Top Avg. (+/-) 2.00% Depth (7D)')
		expect(html).toContain('Highest Volume (Maker &amp; Taker) (7D)')
		expect(html).toContain('Top Bid-Ask Spread (7D)')
		expect(html).toContain('Top KPI Adherence — Combined Uptime (7D)')
	})
})
