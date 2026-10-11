// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa/perps/venue/ondo', asPath: '/rwa/perps/venue/ondo', push: vi.fn() })
}))

import { buildRwaKpiCsv } from '../../kpi/kpiRows'
import { getRwaPerpsKpiHeadline, getRwaVenueKpiRows } from '../../kpi/perpsKpiRows'
import { perpsAsset } from '../../table/__tests__/fixtures'
import { RWAVenueKeyMetrics, type RWAVenueKeyMetricsProps } from '../VenueKeyMetrics'
import { foldRwaVenueKpi } from '../venueKpi'

const kpi = foldRwaVenueKpi([perpsAsset({ volume24h: 0, protocolFees30d: 3000 }), perpsAsset({ id: 'b' })], 40_000)

function render(props: Partial<RWAVenueKeyMetricsProps> = {}) {
	const root = document.createElement('div')
	root.innerHTML = renderToStaticMarkup(
		<RWAVenueKeyMetrics
			venue="Ondo"
			logo={null}
			venueSlug="ondo"
			kpi={kpi}
			venueType="DEX"
			takerFeeBps={4.5}
			{...props}
		/>
	)
	return root
}

const labels = (root: HTMLElement) =>
	Array.from(root.querySelectorAll('[data-metric-label]'), (label) => label.textContent)

/** The venue type tag: an element whose whole text is the type, outside the h1. */
const typeTags = (root: HTMLElement) =>
	Array.from(root.querySelectorAll('*'))
		.filter((element) => !element.closest('h1'))
		.map((element) => element.textContent)
		.filter((text) => text === 'DEX' || text === 'CEX')

describe('RWAVenueKeyMetrics', () => {
	test('names the venue with its type tag and heads with open interest', () => {
		const root = render()
		// The h1 is the name alone; the tag sits beside it, so search reads the venue's name.
		expect(root.querySelector('h1')?.textContent).toBe('Ondo')
		expect(typeTags(root)).toContain('DEX')
		expect(root.textContent).toContain('Open Interest$10,000')
	})

	test('opens Volume, Markets and Est. Fees, no Funding', () => {
		expect(labels(render())).toEqual([
			'Volume (30d)',
			'7d',
			'24h',
			'All-time',
			'Turnover (30d)',
			'Markets',
			'Reference Assets',
			'Asset Groups',
			'Share of DEX OI',
			'Est. Fees (30d)',
			'24h',
			'All-time',
			'Est. Annual',
			'Taker Fee'
		])
		const text = render().textContent
		expect(text).not.toContain('With volume today')
		expect(text).toContain('25%')
		expect(text).toContain('4.5 bps')
	})

	test('reads the CEX share for a CEX venue and hides the taker fee without one', () => {
		const root = render({ venueType: 'CEX', takerFeeBps: null })
		expect(labels(root)).toContain('Share of CEX OI')
		expect(labels(root)).not.toContain('Taker Fee')
		expect(typeTags(root)).toContain('CEX')
		expect(typeTags(root)).not.toContain('DEX')
	})

	test('lists every panel row and sub row as a csv line, raw values, in panel order', () => {
		const { rows } = buildRwaKpiCsv({
			filename: 'key-metrics.csv',
			headline: getRwaPerpsKpiHeadline(kpi),
			rows: getRwaVenueKpiRows(kpi, 'DEX', 4.5)
		})
		const expected = [
			['Metric', 'Value'],
			['Open Interest', 10_000],
			['Open Interest change (24h) %', 25],
			['Volume (30d)', 40_000],
			['Volume (7d)', 12_000],
			['Volume (24h)', 1000],
			['Volume (all-time)', null],
			['Turnover (30d) x', 4],
			['Markets', 2],
			['Reference Assets', 1],
			['Asset Groups', 1],
			['Share of DEX OI %', 25],
			['Est. Fees (30d)', 3000],
			['Est. Fees (24h)', 600],
			['Est. Fees (all-time)', null],
			['Est. Annual Fees', 36_500],
			['Taker Fee (bps)', 4.5]
		]
		expect(rows).toEqual(expected)
	})
})
