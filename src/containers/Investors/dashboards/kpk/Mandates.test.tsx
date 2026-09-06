// @vitest-environment happy-dom

import { act, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { KpkMandates } from './api'

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	useKpkMandates: () => ({ data: served, isError: false })
}))

const MANDATES: KpkMandates = {
	asOf: '2026-09-02',
	yieldAsOf: '2026-08-31',
	yieldIsSample: true,
	dydxChain: { stakedDydx: 90_041_355, months: 13, usd: 10.61 },
	aum: 156.81,
	clientCount: 3,
	deployedOnchain: '$8.03bn',
	deployedOnchainUsd: 8_030_000_000,
	denominations: ['USD', 'EUR'],
	comp: {
		client: {
			title: 'By client',
			total: 156.81,
			months: ['1 Sept 26', '2 Sept 26'],
			segments: [{ name: 'ENS DAO', value: 91.87, share: 58.6, series: [90, 91.87] }]
		}
	},
	perf: {
		USD: {
			denom: 'USD',
			usd: 61_996_702,
			bench: 3.52,
			benchLabel: 'sUSDS (Sky), 30d avg',
			excess: 0.5077,
			windows: [
				{ label: '1 day', apy: 4.47, bench: 3.11, spread: 1.36, spreadBps: 136, excessAnnualUsd: 590_717 },
				{ label: '30 day', apy: 4.34, bench: 3.52, spread: 0.82, spreadBps: 82, excessAnnualUsd: 507_713 }
			],
			scope: {
				defiUsd: 62,
				unresolvedUsd: 0.2557,
				coveragePct: 99.6,
				opsUsd: 1.23,
				opsBuckets: [
					{ name: 'ops:idle', usd: 0.7295 },
					{ name: 'ops:market-making', usd: 0.5007 }
				]
			}
		},
		EUR: {
			denom: 'EUR',
			usd: 3_205_942,
			bench: 2.68,
			benchLabel: 'Aave v3 EURC supply, 30d avg',
			excess: -0.0018,
			windows: [{ label: '30 day', apy: 2.62, bench: 2.68, spread: -0.057, spreadBps: -6, excessAnnualUsd: -1834 }],
			scope: { defiUsd: 3.21, unresolvedUsd: 0, coveragePct: 100, opsUsd: 0, opsBuckets: [] }
		}
	},
	ops: {
		usd: 27,
		pctOfTvl: 17.3,
		defiUsd: 129.22,
		buckets: [
			{ name: 'ops:strategic', usd: 18.49, positions: 7 },
			{ name: 'ops:market-making', usd: 1.18, positions: 7 }
		],
		coveragePct: 99.3,
		unresolvedUsd: 0.95,
		unbenchmarked: {
			usd: 24.95,
			denoms: [
				{ name: 'DYDX', usd: 9.89 },
				{ name: 'COW', usd: 5.89 }
			]
		}
	},
	clients: [
		{
			name: 'ENS DAO',
			aum: 91.87,
			share: 85.46,
			deployedPct: 99.58,
			usd: { mix: 35, alpha: 90 },
			eth: { mix: 65, alpha: 9 },
			since: 'Nov 2023',
			url: 'https://app.syncrone.fi/public/ens',
			alphaBps: 37,
			excess: 0.337,
			yieldAum: 91.15,
			defiUsd: 90.77,
			opsUsd: 0.372,
			coveragePct: 100
		},
		{
			name: 'dYdX',
			aum: 15.63,
			share: 14.54,
			deployedPct: 32.12,
			usd: { mix: 100, alpha: -16 },
			eth: null,
			since: 'Feb 2024',
			alphaBps: -16,
			excess: -0.008,
			yieldAum: 15.63,
			defiUsd: 5.02,
			opsUsd: 10.61,
			coveragePct: 100
		},
		{
			name: 'Arbitrum DAO',
			aum: null,
			share: null,
			deployedPct: null,
			usd: null,
			eth: null,
			since: null,
			alphaBps: null,
			excess: null,
			yieldAum: 4.2,
			defiUsd: null,
			opsUsd: null,
			coveragePct: null
		}
	],
	totals: { aum: 107.5, weightedDeployedPct: 82.7, excess: 0.329 },
	refs: [{ label: 'KPK on DefiLlama', url: 'https://defillama.com/protocol/kpk' }]
}

let served: KpkMandates = MANDATES

describe('kpk Treasury mandates tab', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		served = MANDATES
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function renderTab() {
		const { default: Mandates } = await import('./Mandates')
		await act(async () =>
			root.render(
				<Suspense fallback={null}>
					<Mandates />
				</Suspense>
			)
		)
	}

	const clickChip = async (label: string) => {
		const chip = [...container.querySelectorAll('button')].find((button) => button.textContent === label)!
		await act(async () => chip.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	test('dates the headline AUM and the performance section on their own sources', async () => {
		await renderTab()

		expect(container.textContent).toContain('as of Sep 2, 2026')
		expect(container.textContent).toContain('Positions report as of Aug 31, 2026')
		expect(container.textContent).not.toContain('2026-09-02')
		expect(container.textContent).toContain('sample data')
		expect(container.textContent).toContain('balance as of Aug 31, 2026')
		expect(container.textContent).not.toContain("today's")
	})

	test('renders each window against its own benchmark', async () => {
		await renderTab()

		expect(container.textContent).toContain('3.11%')
		expect(container.textContent).toContain('3.52%')
	})

	test('states what the rate covers and what it leaves out, per denomination', async () => {
		await renderTab()

		expect(container.textContent).toContain('Rates cover $62m of USD defi positions')
		expect(container.textContent).toContain('market making')
		expect(container.textContent).toContain('not counted as earning nothing')
		// Benchmark coverage is on the payload and deliberately off the page.
		expect(container.textContent).not.toContain('coverage')

		await clickChip('EUR')
		expect(container.textContent).toContain('No EUR is held in ops positions.')
	})

	test('dashes the AUM of a client the treasury snapshot has yet to carry', async () => {
		await renderTab()

		expect(container.textContent).toContain('Arbitrum DAO')
		expect(container.querySelector('[title*="treasury snapshot yet"]')).not.toBeNull()
	})

	test('dashes a sleeve the client does not hold rather than reading it as 0%', async () => {
		await renderTab()

		const dydxRow = [...container.querySelectorAll('tr')].find((row) =>
			row.querySelector('td')?.textContent?.startsWith('dYdX')
		)!
		const cells = [...dydxRow.querySelectorAll('td')].map((cell) => cell.textContent)

		expect(cells[4]).toBe('100%−16 bps')
		expect(cells[5]).toBe('—')
	})

	test('footers the share column with what it actually adds up to', async () => {
		served = {
			...MANDATES,
			clients: MANDATES.clients.map((client) =>
				client.name === 'dYdX' ? { ...client, aum: null, share: null } : client
			)
		}
		await renderTab()

		const totalRow = [...container.querySelectorAll('tfoot tr')].at(-1)!
		expect([...totalRow.children].map((cell) => cell.textContent)[2]).toBe('85.5%')
	})

	test('drops the performance section when the positions report is missing', async () => {
		served = { ...MANDATES, yieldAsOf: null, yieldIsSample: null, denominations: [], perf: {}, ops: null }
		await renderTab()

		expect(container.textContent).toContain('Composition of Mandate AUM')
		expect(container.textContent).toContain('Per-client breakdown')
		expect(container.textContent).not.toContain('Performance vs benchmark')
	})
})
