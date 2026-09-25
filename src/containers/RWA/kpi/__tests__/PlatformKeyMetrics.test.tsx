// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => <span data-logo /> }))

import type { RWAPlatformMeta } from '../../PlatformPage/api.types'
import { spotAsset } from '../../table/__tests__/fixtures'
import { buildRwaPlatformKeyMetricsCsv, RWAPlatformKeyMetrics } from '../PlatformKeyMetrics'
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
		expect(root.textContent).toContain('Active AUM$1.6m+1.27%24h')
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
		expect(between('Largest protocol', 'Net Flows 30d')).toContain('N/A')
	})

	test('shows the est. annual revenue with its confidence only when the index has it, and the suspicious badge with its reason', () => {
		const markup = renderToStaticMarkup(
			<RWAPlatformKeyMetrics
				meta={{
					...meta,
					estAnnualRevenueUsd: 4_200_000,
					revenueConfidence: 'Issuer-Disclosed',
					suspicious: true,
					suspiciousReason: 'Double counted'
				}}
				kpi={kpi}
			/>
		)
		expect(markup).toContain('Est. Annual Revenue')
		expect(markup).toContain('$4.2m')
		expect(markup).toContain('Issuer-Disclosed')
		expect(markup).toContain('Suspicious')
		expect(markup).toContain('Double counted')
	})

	test('writes the csv rows the way the panel reads', () => {
		const csv = buildRwaPlatformKeyMetricsCsv({ meta, kpi })
		expect(csv.filename).toBe('rwa-platform-ondo-key-metrics.csv')
		expect(csv.rows[0]).toEqual(['Metric', 'Value'])
		expect(csv.rows).toContainEqual(['Active AUM', 1_600_000])
		expect(csv.rows).toContainEqual(['Live Assets', 2])
		expect(csv.rows).toContainEqual(['Issuers', 1])
		expect(csv.rows.map((row) => row[0])).not.toContain('Attested')
	})
})
