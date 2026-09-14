import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

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

describe('RWAKeyMetrics', () => {
	test('shows the headline with its change and the three sections with their rows', () => {
		const markup = renderToStaticMarkup(<RWAKeyMetrics {...props()} />)
		expect(markup).toContain('Total RWA Active Mcap')
		expect(markup).toContain('$800,000')
		expect(markup).toContain('+1.27%')
		expect(markup).toContain('24h')
		expect(markup).toContain('Key Metrics')
		expect(markup).toContain('Total RWA Onchain Mcap')
		expect(markup).toContain('Change (24h)')
		expect(markup).toContain('Active / Onchain')
		expect(markup).toContain('80%')
		expect(markup).toContain('DeFi Active TVL')
		expect(markup).toContain('Utilization')
		expect(markup).toContain('12.5%')
		expect(markup).toContain('Largest protocol')
		expect(markup).toContain('Aave')
		expect(markup).toContain('RWA Perps OI')
		expect(markup).toContain('Change (24h)')
		expect(markup).toContain('+25.00%')
		expect(markup).toContain('DEX share')
		expect(markup).toContain('100%')
		expect(markup).toContain('Volume (24h)')
		expect(markup).not.toContain('Total Asset Issuers')
		expect(markup).not.toContain('Live Assets')
	})

	test('opens with every section collapsed, like the home page', () => {
		const markup = renderToStaticMarkup(<RWAKeyMetrics {...props()} />)
		expect(markup.split('<details').length - 1).toBe(3)
		expect(markup).not.toContain('open=""')
	})

	test('reads 24h on every change, whatever the table period', () => {
		const markup = renderToStaticMarkup(<RWAKeyMetrics {...props()} />)
		expect(markup).toContain('Change (24h)')
		expect(markup).not.toContain('Change (7d)')
		expect(markup).not.toContain('30d')
	})

	test('shows gaps as N/A, never as zero', () => {
		const markup = renderToStaticMarkup(
			<RWAKeyMetrics {...props({ perps: foldRwaPerpsTotals([spotAsset()], true), largestProtocol: null })} />
		)
		expect(markup.split('N/A').length - 1).toBeGreaterThanOrEqual(4)
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
		expect(csv.rows).toContainEqual(['Total RWA Active Mcap', 800_000])
		expect(csv.rows).toContainEqual(['Utilization %', 12.5])
		expect(csv.rows).toContainEqual(['Largest protocol', 'Aave'])
		expect(csv.rows).toContainEqual(['DEX share %', 100])
	})
})
