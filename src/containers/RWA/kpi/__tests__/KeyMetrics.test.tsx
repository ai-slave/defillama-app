// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

import { METRIC_VALUE_SELECTOR } from '~/ui/MetricPrimitives'
import { foldRwaPerpsTotals } from '../../cards/cardData'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { getRwaAssetsKpiHeadline, getRwaOverviewKpiRows, RWA_OVERVIEW_KPI_LABEL } from '../assetsKpiRows'
import { RWAKeyMetrics, type RWAKeyMetricsProps } from '../KeyMetrics'
import { buildRwaKpiCsv } from '../kpiRows'
import { sumRwaKpiTotals } from '../kpiTotals'

const assets = [spotAsset(), perpsAsset()]

function props(overrides: Partial<RWAKeyMetricsProps> = {}): RWAKeyMetricsProps {
	return {
		metrics: sumRwaKpiTotals(assets, true),
		perps: foldRwaPerpsTotals([perpsAsset()]),
		largestProtocol: { name: 'Aave', value: 100_000 },
		pageKind: 'overview',
		...overrides
	}
}

function render(overrides: Partial<RWAKeyMetricsProps> = {}) {
	const root = document.createElement('div')
	root.innerHTML = renderToStaticMarkup(<RWAKeyMetrics {...props(overrides)} />)
	return root
}

/* Every section and row value in panel order: onchain AUM, its change, active / onchain, DeFi TVL, its change,
utilization, largest protocol, perps OI, its change, DEX share, perps volume. */
function rowValues(root: HTMLElement) {
	return Array.from(root.querySelectorAll(METRIC_VALUE_SELECTOR), (value) => value.textContent)
}

describe('RWAKeyMetrics', () => {
	test('shows the headline with its change and every section and row value', () => {
		const root = render()
		expect(root.textContent).toContain('$800,000+1.27%over 24h')
		expect(rowValues(root)).toEqual([
			'$1m',
			'+1.01%',
			'80%',
			'$100,000',
			'+1.01%',
			'12.5%',
			'Aave$100,000',
			'$5,000',
			'+25.00%',
			'100%',
			'$1,000'
		])
	})

	test('heads the page with its headline as the one h1, or as an h2 inside another page', () => {
		const page = render({ headline: 'Ethereum RWA Active AUM' })
		expect(Array.from(page.querySelectorAll('h1'), (heading) => heading.textContent)).toEqual([
			'Ethereum RWA Active AUM'
		])
		const embedded = render()
		expect(embedded.querySelectorAll('h1')).toHaveLength(0)
		expect(Array.from(embedded.querySelectorAll('h2'), (heading) => heading.textContent)).toContain(
			'Total RWA Active AUM'
		)
	})

	test('opens with every section collapsed, like the home page', () => {
		const sections = Array.from(render().querySelectorAll('details'))
		expect(sections).toHaveLength(3)
		expect(sections.map((section) => section.open)).toEqual([false, false, false])
	})

	test('shows gaps as N/A, never as zero', () => {
		const root = render({ perps: foldRwaPerpsTotals([]), largestProtocol: null })
		expect(rowValues(root).slice(6)).toEqual(['N/A', 'N/A', 'N/A', 'N/A', 'N/A'])
	})

	test('shows a missing money value as a gap, never as zero', () => {
		const metrics = { ...props().metrics, defiActiveTvl: null }
		const markup = renderToStaticMarkup(<RWAKeyMetrics {...props({ metrics })} />)
		expect(markup).not.toContain('$0<')
		expect(markup).toContain('N/A')
	})

	test('lists every panel row and sub row as a csv line, raw values, in panel order', () => {
		const { metrics, perps, largestProtocol } = props()
		const { rows } = buildRwaKpiCsv({
			filename: 'key-metrics.csv',
			headline: getRwaAssetsKpiHeadline(metrics, RWA_OVERVIEW_KPI_LABEL),
			rows: getRwaOverviewKpiRows(metrics, perps, largestProtocol)
		})
		const expected = [
			['Metric', 'Value'],
			['Total RWA Active AUM', 800_000],
			['Active AUM change (24h) %', 1.2658227848101267],
			['Total RWA Onchain AUM', 1_000_000],
			['Onchain AUM change (24h) %', 1.0101010101010102],
			['Active / Onchain %', 80],
			['DeFi Active TVL', 100_000],
			['DeFi Active TVL change (24h) %', 1.0101010101010102],
			['Utilization %', 12.5],
			['Largest Protocol', 'Aave'],
			['Largest Protocol DeFi Active TVL', 100_000],
			['RWA Perps OI', 5000],
			['RWA Perps OI change (24h) %', 25],
			['DEX Share %', 100],
			['Perps volume (24h)', 1000]
		]
		expect(rows).toEqual(expected)
	})
})
