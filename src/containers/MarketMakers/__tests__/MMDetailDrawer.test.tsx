import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/market-makers', push: () => {} }) }))
vi.mock('../Drawer', () => ({
	Drawer: ({ title, children }: { title: string; children: ReactNode }) => (
		<div>
			<span>title:{title}</span>
			{children}
		</div>
	)
}))
vi.mock('../RadarChart', () => ({ RadarChart: () => <div>radar</div> }))
vi.mock('~/components/Link', () => ({
	BasicLink: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>
}))
vi.mock('../client', () => ({
	requestLeadClickId: () => Promise.resolve(null),
	useSubmitLead: () => ({
		isPending: false,
		isSuccess: false,
		isError: false,
		reset: () => {},
		mutate: () => {}
	}),
	useMarketMakerDetail: () => ({
		isPending: false,
		data: {
			id: 'lhava',
			name: 'Lhava',
			description: 'A liquidity provider',
			countryCode: 'SG',
			website: 'https://lhava.io',
			imageUrl: 'https://img.example/lhava.png',
			activeEngagementsCount: 12,
			averageFDV: 250000000,
			engagementOptions: ['loan_call_option', 'retainer_working_capital'],
			services: ['Treasury Management', 'OTC Liquidation'],
			supportedCEX: [
				{ label: 'Binance', value: 'binance', url: 'https://img.example/binance.png', order: 1, type: 'CEX' }
			],
			supportedDEX: [
				{ label: 'Uniswap V3', value: 'uniswap-v3', url: 'https://img.example/uni.png', order: 2, type: 'DEX' }
			]
		}
	}),
	useMarketMakerBreakdown: () => ({
		isPending: false,
		data: {
			aggregatedRank: { value: 1, percentile: 99 },
			depthRank: { value: 2, percentile: 95 },
			volumeRank: { value: 3, percentile: 90 },
			spreadRank: { value: 4, percentile: 85 },
			kpiRank: { value: 5, percentile: 80 }
		}
	}),
	useMarketMakerPerformance: () => ({
		isPending: false,
		data: {
			composite: 9.5,
			tradingKpis: 8.25,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4,
			integrationStatus: 'full'
		}
	})
}))

import { MMDetailDrawer } from '../MMDetailDrawer'

describe('MMDetailDrawer', () => {
	it('renders the about section, a per-board card label and a score from the hook data', () => {
		const html = renderToStaticMarkup(
			<MMDetailDrawer open onClose={() => {}} marketMakerId="lhava" range={{}} badge="Last 30-day" />
		)

		expect(html).toContain('About Lhava')
		expect(html).toContain('A liquidity provider')
		expect(html).toContain('Fully Integrated')
		expect(html).toContain('Singapore')
		expect(html).toContain('KPI Adherence Leaderboard')
		expect(html).toContain('9.50/10.00')
		expect(html).toContain('Outperformed 99% of their peers across all major KPIs.')
		expect(html).toContain('Active Engagements in Forgd')
		expect(html).toContain('Loan + Call Option')
		expect(html).toContain('Retainer + Working Capital')
		expect(html).toContain('Major CEXs Supported')
		expect(html).toContain('Binance')
		expect(html).toContain('Uniswap V3')
		expect(html).toContain('Treasury Management')
	})

	it('labels the trustIntegration score row as Trust', () => {
		const html = renderToStaticMarkup(
			<MMDetailDrawer open onClose={() => {}} marketMakerId="lhava" range={{}} badge="Last 30-day" />
		)
		expect(html).toContain('>Trust<')
		expect(html).not.toContain('Trust &amp; Integration')
	})

	it('marks each breakdown table with a data-breakdown-section anchor for focus scrolling', () => {
		const html = renderToStaticMarkup(
			<MMDetailDrawer
				open
				onClose={() => {}}
				marketMakerId="lhava"
				range={{}}
				badge="Last 30-day"
				focusSection="volume"
			/>
		)
		expect(html).toContain('data-breakdown-section="depth"')
		expect(html).toContain('data-breakdown-section="volume"')
		expect(html).toContain('data-breakdown-section="spread"')
		expect(html).toContain('data-breakdown-section="kpi"')
	})
})
