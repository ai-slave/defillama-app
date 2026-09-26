// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

import { METRIC_VALUE_SELECTOR } from '~/ui/MetricPrimitives'
import { foldRwaPerpsTotals } from '../../cards/cardData'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { buildRwaKeyMetricsCsv, RWAKeyMetrics, type RWAKeyMetricsProps } from '../KeyMetrics'
import { sumRwaKpiTotals } from '../kpiTotals'

const assets = [spotAsset(), perpsAsset()]

function props(overrides: Partial<RWAKeyMetricsProps> = {}): RWAKeyMetricsProps {
	return {
		metrics: sumRwaKpiTotals(assets, true),
		perps: foldRwaPerpsTotals(assets, true),
		largestProtocol: { name: 'Aave', value: 100_000 },
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

	test('opens with every section collapsed, like the home page', () => {
		const sections = Array.from(render().querySelectorAll('details'))
		expect(sections).toHaveLength(3)
		expect(sections.map((section) => section.open)).toEqual([false, false, false])
	})

	test('shows gaps as N/A, never as zero', () => {
		const root = render({ perps: foldRwaPerpsTotals([spotAsset()], true), largestProtocol: null })
		expect(rowValues(root).slice(6)).toEqual(['N/A', 'N/A', 'N/A', 'N/A', 'N/A'])
	})

	test('shows a missing money value as a gap, never as zero', () => {
		const metrics = { ...props().metrics, defiActiveTvl: null }
		const markup = renderToStaticMarkup(<RWAKeyMetrics {...props({ metrics })} />)
		expect(markup).not.toContain('$0<')
		expect(markup).toContain('N/A')
	})

	test('writes the rows to a csv', () => {
		const csv = buildRwaKeyMetricsCsv(props())
		expect(csv.filename).toBe('rwa-key-metrics.csv')
		expect(csv.rows[0]).toEqual(['Metric', 'Value'])
		expect(csv.rows).toContainEqual(['Total RWA Active AUM', 800_000])
		expect(csv.rows).toContainEqual(['Utilization %', 12.5])
		expect(csv.rows).toContainEqual(['Largest protocol', 'Aave'])
		expect(csv.rows).toContainEqual(['DEX share %', 100])
	})
})
