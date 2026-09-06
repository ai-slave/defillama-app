import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { BreakdownTable, type BreakdownRowConfig } from '../BreakdownTable'

const ROWS: Array<BreakdownRowConfig> = [
	{ label: 'Bid & Ask Depth 50 bps (USD)', key: 'bidAskDepth50', kind: 'usd' },
	{ label: 'Uptime %, Bid & Ask Depth 50 bps', key: 'bidAskDepth50Uptime', kind: 'percent' }
]

describe('BreakdownTable', () => {
	test('renders value, percentile, and rank', () => {
		const data = {
			bidAskDepth50: { value: 266_553_520, percentile: 95, rank: 2 }
		}
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={data} />)

		expect(html).toContain('Depth KPIs, Detailed Breakdown')
		expect(html).toContain('Last 30D')
		expect(html).toContain('$266')
		expect(html).toContain('95%')
		expect(html).toContain('>2<')
	})

	test('renders N/A with no fill for a missing metric or sub-value', () => {
		const data = {
			bidAskDepth50: { value: null, percentile: null, rank: null }
		}
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={data} />)

		expect(html).toContain('N/A')
	})

	test('renders N/A when the metric key is entirely absent', () => {
		const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={{}} />)

		expect(html).toContain('N/A')
	})
})
