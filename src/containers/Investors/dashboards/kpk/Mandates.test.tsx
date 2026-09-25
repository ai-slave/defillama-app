// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import type { KpkMandates } from './api'
import Mandates from './Mandates'

// The chart draws nothing these tests read; its series are covered by buildComposition.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
const http = installFixtureFetch()

const MANDATES: KpkMandates = {
	asOf: '2026-09-02',
	yieldAsOf: '2026-08-31',
	yieldIsSample: true,
	dydxChain: { stakedDydx: 90_041_355, months: 13, usd: 10.61 },
	aum: 156.81,
	clientCount: 4,
	deployedOnchain: '$8.03bn',
	deployedOnchainUsd: 8_030_000_000,
	deployedOnchainTxns: 10_382,
	deployedOnchainTxnsLabel: '10,382',
	deployedOnchainTxnsRef: { label: 'KPK transaction count — Dune', url: 'https://dune.com/kpk/kpk-tx-count' },
	deploymentRef: { label: 'KPK Moved Funds — Dune', url: 'https://dune.com/kpk/kpk-moved-funds' },
	denominations: ['USD', 'EUR'],
	comp: {
		client: {
			title: 'By client',
			ranges: {
				'1m': {
					title: 'By client',
					total: 156.81,
					months: ['1 Sept 26', '2 Sept 26'],
					segments: [{ name: 'ENS DAO', value: 91.87, share: 58.6, series: [90, 91.87] }],
					window: { from: '2026-08-04', to: '2026-09-02', days: 30, points: 30, gaps: [], missingDays: 0 }
				},
				max: {
					title: 'By client',
					total: 156.81,
					months: ['Jan 22', '2 Sept 26'],
					segments: [
						{ name: 'ENS DAO', value: 91.87, share: 58.6, series: [0, 91.87] },
						{ name: 'Gnosis DAO', value: 0, share: 0, series: [12, 0] }
					],
					window: { from: '2022-01-01', to: '2026-09-02', days: 1713, points: 370, gaps: [], missingDays: 0 }
				}
			}
		}
	},
	perf: {
		USD: {
			denom: 'USD',
			usd: 61_996_702,
			bench: 3.52,
			benchLabel: 'sUSDS (Sky), 30d avg',
			excess: 0.138,
			excessRunRate: 0.5077,
			earned: 2.61,
			benchEarned: 2.472,
			avgBalance: 60.4,
			windows: [
				{
					label: '1 day',
					days: 1,
					apy: 4.47,
					bench: 3.11,
					spread: 1.36,
					spreadBps: 136,
					excessAnnualUsd: 590_717,
					realized: true,
					avgBalance: 60.1,
					spot: { apy: 4.51, bench: 3.11, spread: 1.4, spreadBps: 140 }
				},
				{
					label: '30 day',
					days: 30,
					apy: 4.34,
					bench: 3.52,
					spread: 0.82,
					spreadBps: 82,
					excessAnnualUsd: 507_713,
					realized: false
				}
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
			earned: 0.201,
			benchEarned: 0.2028,
			avgBalance: 3.1,
			windows: [
				{ label: '30 day', days: 30, apy: 2.62, bench: 2.68, spread: -0.057, spreadBps: -6, excessAnnualUsd: -1834 }
			],
			scope: { defiUsd: 3.21, unresolvedUsd: 0, coveragePct: 100, opsUsd: 0, opsBuckets: [] }
		}
	},
	excessWindow: {
		from: '2025-09-09',
		to: '2026-09-08',
		days: 365,
		snapshotDays: 361,
		carriedDays: 3,
		missingDays: 1,
		coveragePct: 98,
		excess: 0.329,
		earned: 6.42,
		benchEarned: 6.091,
		avgBalance: 149.5,
		fallback: [{ name: 'Stakewise osETH vaults', label: 'stakewise-v3/OSETH', usd: 12.1 }],
		stacked: [{ name: 'aave-v3/WSTETH', label: 'lido/STETH', usd: 31.4 }],
		unpriced: [{ name: 'kpk USDC v1', usd: 1.5, days: 365, reason: 'no pool in the yields DB' }]
	},
	excessDaily: [
		{ date: '2026-09-07', excess: 812.44, usd: 151.2 },
		{ date: '2026-09-08', excess: 903.11, usd: 151.9 }
	],
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
			since: 'Mar 2023',
			url: 'https://app.syncrone.fi/public/ens',
			alphaBps: 37,
			excess: 0.209,
			excessRunRate: 0.337,
			excessAvgBalance: 88.4,
			yieldAum: 91.15,
			defiUsd: 90.77,
			opsUsd: 0.372,
			deployedUsd: 90.77,
			idleUsd: 0.372,
			coveragePct: 100
		},
		{
			name: 'dYdX',
			aum: 15.63,
			share: 14.54,
			deployedPct: 39.4,
			usd: { mix: 100, alpha: -16 },
			eth: null,
			since: 'Nov 2024',
			alphaBps: -16,
			excess: -0.008,
			excessRunRate: -0.011,
			excessAvgBalance: 14.2,
			yieldAum: 15.63,
			defiUsd: 5.02,
			opsUsd: 10.61,
			deployedUsd: 6.16,
			idleUsd: 9.47,
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
			excessRunRate: null,
			excessAvgBalance: null,
			yieldAum: 4.2,
			defiUsd: null,
			opsUsd: null,
			deployedUsd: null,
			idleUsd: null,
			coveragePct: null
		},
		{
			name: 'Safe',
			aum: null,
			share: null,
			deployedPct: null,
			usd: null,
			eth: null,
			since: 'Sep 2022',
			alphaBps: null,
			excess: null,
			excessRunRate: null,
			excessAvgBalance: 2.4,
			yieldAum: null,
			defiUsd: null,
			opsUsd: null,
			deployedUsd: null,
			idleUsd: null,
			coveragePct: null
		}
	],
	inactive: { count: 1, names: ['Aave DAO'], excess: -0.012 },
	totals: { aum: 107.5, weightedDeployedPct: 82.7, excess: 0.329, excessRunRate: 0.532 },
	refs: [{ label: 'KPK on DefiLlama', url: 'https://defillama.com/protocol/kpk' }]
}

let served: KpkMandates = MANDATES

describe('kpk Treasury mandates tab', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		served = MANDATES
		client = new QueryClient()
		http.serve({ '/api/public/kpk/mandates': () => served })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	})

	async function renderTab() {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<Suspense fallback={null}>
						<Mandates />
					</Suspense>
				</QueryClientProvider>
			)
		)
		await vi.waitFor(() => expect(container.textContent).toContain('Per-client breakdown'), { timeout: 1000 })
		await vi.waitFor(() => expect(container.textContent).toContain('ENS DAO'), { timeout: 1000 })
	}

	const clickChip = async (label: string) => {
		const chip = [...container.querySelectorAll('button')].find((button) => button.textContent === label)!
		await act(async () => chip.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	test('dates the headline, the positions report and the excess window on their own sources', async () => {
		await renderTab()
		const text = container.textContent

		expect(text).toContain('as of Sep 2, 2026')
		expect(text).toContain('Positions report as of Aug 31, 2026 — sample data')
		expect(text).toContain('over the 365 days to Sep 8, 2026')
		expect(text).toContain('1 day had no snapshot and accrued nothing')
		expect(text).not.toContain('2026-09-02')
		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-moved-funds"]')).not.toBeNull()
		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-tx-count"]')).not.toBeNull()
		expect(text).toContain('10,382 onchain transactions')
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

	test('switches the rates, their scope and the excess return to the picked denomination', async () => {
		await renderTab()

		expect(container.textContent).toContain('Rates cover $62m of USD defi positions')
		expect(container.textContent).toContain('3.11%')
		expect(container.textContent).toContain('$138k')
		expect(container.querySelector('[aria-label*="USD earned $2.61m against $2.47m"]')).not.toBeNull()

		await clickChip('EUR')
		expect(container.textContent).toContain('No EUR is held in ops positions or idle.')
		expect(container.textContent).not.toContain('3.11%')
		expect(container.textContent).not.toContain('$138k')
		expect(container.textContent).toContain('−$1.8k')
		expect(container.querySelector('[aria-label*="EUR earned $201k against $202.8k"]')).not.toBeNull()
	})

	test('drops the performance section and the transaction row when their sources are missing', async () => {
		served = {
			...MANDATES,
			yieldAsOf: null,
			yieldIsSample: null,
			denominations: [],
			perf: {},
			ops: null,
			excessWindow: null,
			excessDaily: null,
			deployedOnchainTxnsLabel: undefined,
			deployedOnchainTxnsRef: undefined
		}
		await renderTab()

		expect(container.textContent).toContain('Composition of Mandate AUM')
		expect(container.textContent).not.toContain('Performance vs benchmark')
		expect(container.textContent).toContain('No per-position history available')
		expect(container.textContent).not.toContain('onchain transactions')
	})
})
