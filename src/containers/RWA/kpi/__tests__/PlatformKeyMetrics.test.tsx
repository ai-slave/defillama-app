// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => <span data-logo /> }))

import type { RWAPlatformMeta } from '../../PlatformPage/api.types'
import { spotAsset } from '../../table/__tests__/fixtures'
import { getRwaAssetsKpiHeadline, getRwaPlatformKpiRows, RWA_PLATFORM_KPI_LABEL } from '../assetsKpiRows'
import { buildRwaKpiCsv } from '../kpiRows'
import { RWAPlatformKeyMetrics } from '../PlatformKeyMetrics'
import { foldRwaPlatformKpi } from '../platformKpi'

const meta = {
	name: 'Ondo',
	slug: 'ondo',
	logo: 'https://icons.example/ondo.png',
	suspicious: false,
	suspiciousReason: null,
	estAnnualRevenueUsd: null,
	revenueConfidence: null
} as unknown as RWAPlatformMeta

const kpi = foldRwaPlatformKpi(
	[spotAsset(), spotAsset({ id: 'b', canonicalMarketId: 'b', accessModel: 'Permissionless', attestations: true })],
	{ includeBridgeTvl: true }
)

describe('RWAPlatformKeyMetrics', () => {
	test('headlines the active AUM fold with its 24h change', () => {
		const root = document.createElement('div')
		root.innerHTML = renderToStaticMarkup(<RWAPlatformKeyMetrics meta={meta} kpi={kpi} />)
		expect(root.textContent).toContain('Active AUM$1.6m+1.27%over 24h')
	})

	test('reads N/A where nothing is priced, never $0', () => {
		const empty = foldRwaPlatformKpi(
			[
				spotAsset({
					onChainMcap: null,
					activeMcap: null,
					defiActiveTvl: { total: 0, breakdown: [] },
					priors: undefined
				})
			],
			{ includeBridgeTvl: true }
		)
		const markup = renderToStaticMarkup(<RWAPlatformKeyMetrics meta={meta} kpi={empty} />)
		const between = (from: string, to: string) => markup.slice(markup.indexOf(from), markup.indexOf(to))
		expect(between('Active AUM', 'Key Metrics')).toContain('N/A')
		expect(between('Active AUM', 'Key Metrics')).not.toContain('$0')
		expect(between('Onchain AUM', 'Active / Onchain')).toContain('N/A')
		expect(between('Net Flows 30d', 'Live Assets')).not.toContain('$0')
		expect(between('Largest Protocol', 'Net Flows 30d')).toContain('N/A')
	})

	test('shows est. annual revenue and the suspicious badge only when the index flags them', () => {
		const text = (platform: RWAPlatformMeta) => {
			const root = document.createElement('div')
			root.innerHTML = renderToStaticMarkup(<RWAPlatformKeyMetrics meta={platform} kpi={kpi} />)
			return root.textContent
		}
		const flagged = text({ ...meta, estAnnualRevenueUsd: 4_200_000, revenueConfidence: null, suspicious: true })
		expect(flagged).toContain('Est. Annual Revenue$4.2mConfidenceN/A')
		expect(flagged).toContain('Suspicious')

		const plain = text(meta)
		expect(plain).not.toContain('Est. Annual Revenue')
		expect(plain).not.toContain('Suspicious')
	})

	test('lists every panel row and sub row as a csv line, raw values, in panel order', () => {
		const { rows } = buildRwaKpiCsv({
			filename: 'key-metrics.csv',
			headline: getRwaAssetsKpiHeadline(kpi.metrics, RWA_PLATFORM_KPI_LABEL),
			rows: getRwaPlatformKpiRows(kpi, {
				...meta,
				estAnnualRevenueUsd: 4_200_000,
				revenueConfidence: 'Issuer-Disclosed'
			})
		})
		const expected = [
			['Metric', 'Value'],
			['Active AUM', 1_600_000],
			['Active AUM change (24h) %', 1.2658227848101267],
			['Onchain AUM', 2_000_000],
			['Onchain AUM change (24h) %', 1.0101010101010102],
			['Active / Onchain %', 80],
			['DeFi Active TVL', 200_000],
			['DeFi Active TVL change (24h) %', 1.0101010101010102],
			['Utilization %', 12.5],
			['Largest Protocol', 'Aave'],
			['Largest Protocol DeFi Active TVL', 200_000],
			['Net Flows 30d', null],
			['Net Flows 7d', null],
			['Live Assets', 2],
			['Issuers', 1],
			['Est. Annual Revenue', 4_200_000],
			['Revenue confidence', 'Issuer-Disclosed']
		]
		expect(rows).toEqual(expected)
	})
})
