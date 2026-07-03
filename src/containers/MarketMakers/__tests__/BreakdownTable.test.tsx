import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
	BREAKDOWN_SKELETON_ROWS,
	BreakdownTable,
	BreakdownTableSkeleton,
	type BreakdownRowConfig
} from '../BreakdownTable'

const ROWS: BreakdownRowConfig[] = [
	{ label: 'Bid & Ask Depth 50 bps (USD)', key: 'bidAskDepth50', kind: 'usd' },
	{ label: 'Uptime %, Bid & Ask Depth 50 bps', key: 'bidAskDepth50Uptime', kind: 'percent' }
]

describe('BreakdownTable', () => {
	it('renders Value, Percentile and Rank with percentile and rank heatmap backgrounds', () => {
		const data = {
			bidAskDepth50: { value: 266553520, percentile: 95, rank: 2 }
		}
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={data} />)

		expect(html).toContain('Depth KPIs, Detailed Breakdown')
		expect(html).toContain('Last 30D')
		expect(html).toContain('$266')
		expect(html).toContain('95%')
		expect(html).toContain('>2<')
		expect(html).toContain('bg-[rgba(60,150,105,')
	})

	it('renders N/A with no fill for a missing metric or sub-value', () => {
		const data = {
			bidAskDepth50: { value: null, percentile: null, rank: null }
		}
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={data} />)

		expect(html).toContain('N/A')
		expect(html).not.toContain('bg-[rgba(60,150,105,')
	})

	it('renders N/A when the metric key is entirely absent', () => {
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={{}} />)

		expect(html).toContain('N/A')
		expect(html).not.toContain('bg-[rgba(60,150,105,')
	})
})

describe('BreakdownTableSkeleton', () => {
	it('renders the fixed depth row count', () => {
		const html = renderToStaticMarkup(
			<BreakdownTableSkeleton title="Depth KPIs" rowCount={BREAKDOWN_SKELETON_ROWS.depth} />
		)
		const rows = html.split('animate-pulse').length - 1
		expect(BREAKDOWN_SKELETON_ROWS.depth).toBe(24)
		expect(rows).toBe(BREAKDOWN_SKELETON_ROWS.depth + 1)
	})

	it('uses the fixed row counts depth=24, volume=9, spread=2, kpi=4', () => {
		expect(BREAKDOWN_SKELETON_ROWS).toEqual({ depth: 24, volume: 9, spread: 2, kpi: 4 })
	})
})
