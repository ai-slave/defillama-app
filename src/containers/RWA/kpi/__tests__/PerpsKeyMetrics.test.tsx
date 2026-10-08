// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa/perps', asPath: '/rwa/perps', push: vi.fn(), replace: vi.fn() })
}))

import { METRIC_VALUE_SELECTOR } from '~/ui/MetricPrimitives'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { buildRwaKpiCsv } from '../kpiRows'
import { RWAPerpsKeyMetrics } from '../PerpsKeyMetrics'
import { foldRwaPerpsKpi } from '../perpsKpi'
import { getRwaPerpsKpiHeadline, getRwaPerpsKpiRows } from '../perpsKpiRows'

const kpi = foldRwaPerpsKpi(
	[
		perpsAsset(),
		perpsAsset({
			id: 'perps-cex',
			venueType: 'CEX',
			openInterest: 15_000,
			openInterestChange24h: null,
			volume24h: 3000,
			fundingRate: 0.0002,
			fundingIntervalHours: 1,
			protocolFees24h: 700
		})
	],
	true
)

function render(value = kpi, headline?: string) {
	const root = document.createElement('div')
	root.innerHTML = renderToStaticMarkup(<RWAPerpsKeyMetrics kpi={value} headline={headline} pageKind="perpsOverview" />)
	return root
}

describe('RWAPerpsKeyMetrics', () => {
	test('heads with open interest and its change, then the 30d sections with the rows they open to', () => {
		const root = render()
		expect(root.textContent).toContain('$20,000+25.00%over 24h')
		expect(Array.from(root.querySelectorAll('summary'), (row) => row.textContent)).toEqual([
			'Volume (30d)$40,000',
			'Markets2',
			'Est. Fees (30d)N/A'
		])
		expect(Array.from(root.querySelectorAll(METRIC_VALUE_SELECTOR), (value) => value.textContent)).toEqual([
			'$40,000',
			'$12,000',
			'$4,000',
			'N/A',
			'2x',
			'2',
			'1',
			'1',
			'1',
			'25%',
			'N/A',
			'$1,000',
			'N/A',
			'N/A'
		])
	})

	test('has no Funding section: no funding, premium or cumulative funding row', () => {
		const text = render().textContent
		expect(text).not.toContain('Funding')
		expect(text).not.toContain('Premium')
	})

	test('heads the page with its headline as the one h1', () => {
		const root = render(kpi, 'Stocks Perps Open Interest')
		expect(Array.from(root.querySelectorAll('h1'), (heading) => heading.textContent)).toEqual([
			'Stocks Perps Open Interest'
		])
	})

	test('shows gaps as N/A, never as zero', () => {
		const root = render(foldRwaPerpsKpi([spotAsset()], true))
		const values = Array.from(root.querySelectorAll(METRIC_VALUE_SELECTOR), (value) => value.textContent)
		expect(values.filter((value) => value !== 'N/A')).toEqual(['0', '0', '0', '0'])
	})

	test('writes every panel row to the csv, raw values', () => {
		const { rows } = buildRwaKpiCsv({
			filename: 'key-metrics.csv',
			headline: getRwaPerpsKpiHeadline(kpi, 'Stocks Perps Open Interest'),
			rows: getRwaPerpsKpiRows(kpi)
		})
		const expected = [
			['Metric', 'Value'],
			['Open Interest', 20_000],
			['Open Interest change (24h) %', 25],
			['Volume (30d)', 40_000],
			['Volume (7d)', 12_000],
			['Volume (24h)', 4000],
			['Volume (all-time)', null],
			['Turnover (30d) x', 2],
			['Markets', 2],
			['Venues', 1],
			['Reference assets', 1],
			['Asset groups', 1],
			['DEX share of OI %', 25],
			['Est. Fees (30d)', null],
			['Est. Fees (24h)', 1000],
			['Est. Fees (7d)', null],
			['Est. Fees (all-time)', null]
		]
		expect(rows).toEqual(expect.arrayContaining(expected))
		expect(rows).toHaveLength(expected.length)
	})
})
