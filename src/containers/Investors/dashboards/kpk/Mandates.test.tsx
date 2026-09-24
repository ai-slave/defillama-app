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
		// The excess return is dated on the legs store's own window, not the report's.
		expect(container.textContent).toContain('over the 365 days to Sep 8, 2026')
		expect(container.textContent).not.toContain("today's")
		expect(container.querySelector('[aria-label*="Window Sep 9, 2025 – Sep 8, 2026"]')).not.toBeNull()
		expect(container.querySelector('[aria-label*="2025-09-09"]')).toBeNull()
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
		expect(container.textContent).toContain('Excluded from the comparison above.')
		// Benchmark coverage is on the payload and deliberately off the page.
		expect(container.textContent).not.toContain('coverage')

		await clickChip('EUR')
		expect(container.textContent).toContain('No EUR is held in ops positions or idle.')
	})

	test('dashes the AUM of a client the treasury snapshot has yet to carry', async () => {
		await renderTab()

		expect(container.textContent).toContain('Arbitrum DAO')
		expect(container.querySelector('[aria-label*="treasury snapshot yet"]')).not.toBeNull()
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

	test('states the window the excess return was earned over', async () => {
		await renderTab()

		expect(container.textContent).toContain('over the trailing 365 days')
		expect(container.textContent).toContain('1 day had no snapshot and accrued nothing')
		expect(container.textContent).not.toContain('4 days had no snapshot and accrued nothing')
		expect(container.querySelector('[aria-label*="Rates found for 98.0% of balance-days"]')).not.toBeNull()
	})

	test('describes the excess return for the selected denomination', async () => {
		await renderTab()

		// The note's mark sits right after the figure it explains.
		const noted = (note: Element | null) => note?.parentElement?.previousElementSibling?.textContent

		const usdTitle = container.querySelector('[aria-label*="USD earned $2.61m against $2.47m"]')
		expect(noted(usdTitle)).toBe('$138k')
		expect(usdTitle?.getAttribute('aria-label')).not.toContain('$6.42m')

		await clickChip('EUR')
		const eurTitle = container.querySelector('[aria-label*="EUR earned $201k against $202.8k"]')
		expect(noted(eurTitle)).toBe('−$1.8k')
	})

	test('signs a negative excess return ahead of the magnitude', async () => {
		served = { ...MANDATES, totals: { ...MANDATES.totals, excess: -0.088 } }
		await renderTab()

		expect(container.textContent).toContain('−$88k')
		expect(container.textContent).not.toContain('$-88k')
	})

	test('drops the earned caption to a statement of absence when the legs store is unreadable', async () => {
		served = { ...MANDATES, excessWindow: null, excessDaily: null }
		await renderTab()

		expect(container.textContent).toContain('No per-position history available')
		expect(container.textContent).not.toContain('over the trailing 365 days')
	})

	// A mandate that wound down mid-window is off the table but still inside the
	// headline, so the column has to reconcile to the tile.
	test('states the excess earned by mandates with no current balance above the total', async () => {
		await renderTab()

		expect(container.textContent).toContain('Plus 1 mandate with no current balance')
		expect(container.querySelector('[aria-label*="Aave DAO"]')).not.toBeNull()
	})

	test('drops the inactive row when every mandate holds a balance', async () => {
		served = { ...MANDATES, inactive: null }
		await renderTab()

		expect(container.textContent).not.toContain('no current balance')
	})

	test('dashes a client that held a balance only inside the earned window', async () => {
		await renderTab()

		expect(container.textContent).toContain('Safe')
		expect(container.querySelector('[aria-label*="held a mean $2.4m"]')).not.toBeNull()
	})

	test('says whether a window rate was earned or read spot, and keeps the spot reading', async () => {
		await renderTab()

		expect(container.querySelector('[aria-label*="spot reading on the latest balances is 4.51%"]')).not.toBeNull()
		expect(container.querySelector('[aria-label^="Spot reading:"]')).not.toBeNull()
	})

	test('keeps the run-rate off the page, so only the earned figure is shown', async () => {
		await renderTab()

		expect(container.textContent).toContain('Earned above benchmark on the USD book')
		expect(container.textContent).not.toContain('annualised at the 30-day spread')
	})

	test('names what the deployed share leaves out', async () => {
		await renderTab()

		expect(container.querySelector('[aria-label*="with $9.47m sitting idle"]')).not.toBeNull()
	})

	const deployedTitles = () =>
		[...container.querySelectorAll('[aria-label*="deployed"]')].map((node) => node.getAttribute('aria-label'))

	/** $5.02m defi + $10.61m ops holds the $9.47m idle inside it, leaving $6.16m deployed. */
	test('breaks the deployed figure into legs that sum to it, idle taken out of ops', async () => {
		await renderTab()

		expect(deployedTitles()).toContain(
			'$6.16m of $15.63m deployed — $5.02m in defi positions and $1.14m in ops positions, with $9.47m sitting idle'
		)
	})

	test('drops the ops leg when every ops dollar is idle', async () => {
		await renderTab()

		expect(deployedTitles()).toContain(
			'$90.77m of $91.15m deployed — $90.77m in defi positions, with $372k sitting idle'
		)
	})

	test('links the Dune query behind the cumulative deployment', async () => {
		await renderTab()

		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-moved-funds"]')).not.toBeNull()
	})

	test('counts the transactions behind the deployment and links their query', async () => {
		await renderTab()

		const link = container.querySelector<HTMLAnchorElement>('a[href="https://dune.com/kpk/kpk-tx-count"]')
		expect(link).not.toBeNull()
		expect(link!.parentElement!.textContent).toContain('10,382 onchain transactions')
	})

	test('drops the transaction row rather than dashing it when Dune sends no count', async () => {
		served = { ...MANDATES, deployedOnchainTxnsLabel: undefined, deployedOnchainTxnsRef: undefined }
		await renderTab()

		expect(container.textContent).not.toContain('onchain transactions')
		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-tx-count"]')).toBeNull()
	})

	test('pins the client column of the per-client table, leaving the page to scroll it', async () => {
		await renderTab()

		const table = [...container.querySelectorAll('table')].find((element) =>
			element.querySelector('thead')?.textContent?.includes('Managed since')
		)!

		// Scrolls sideways only: no height cap, so no inner vertical scroll.
		expect(table.parentElement?.className).toContain('overflow-x-auto')
		expect(table.parentElement?.className).not.toContain('max-h-')

		const [clientHeader, aumHeader] = table.querySelectorAll('thead th')
		expect(clientHeader.textContent).toBe('Client')
		expect(clientHeader.className).toContain('sticky')
		expect(clientHeader.className).toContain('left-0')
		expect(clientHeader.className).not.toContain('top-0')
		expect(aumHeader.className).not.toContain('sticky')

		const [clientCell, aumCell] = table.querySelectorAll('tbody tr:first-child td')
		expect(clientCell.className).toContain('sticky')
		expect(clientCell.className).toContain('left-0')
		expect(aumCell.className).not.toContain('sticky')

		const [inactiveCell] = table.querySelector('tfoot tr')!.querySelectorAll('td')
		const [totalCell] = [...table.querySelectorAll('tfoot tr')].at(-1)!.querySelectorAll('td')
		expect(totalCell.textContent).toBe('Total')
		expect(totalCell.className).toContain('sticky')
		// The long inactive line wraps on a phone rather than widening the pinned column:
		// capped, free to break, and with its info icon held at full size beside it.
		// happy-dom has no layout; the wrap itself was measured in a browser.
		expect(inactiveCell.textContent).toContain('no current balance')
		const capped = inactiveCell.querySelector('.max-w-40')!
		const label = capped.querySelector('.inline-flex')!
		expect(label.textContent).toContain('no current balance')
		expect(inactiveCell.className).not.toContain('whitespace-nowrap')
		expect(capped.querySelector('.whitespace-nowrap, .text-nowrap')).toBeNull()
		// The icon's own box is the flex item the row squeezes, not the tooltip anchor inside it.
		const icon = label.lastElementChild!
		expect(icon.querySelector('[aria-label*="held nothing"]')).not.toBeNull()
		expect(icon.className).toContain('shrink-0')
	})

	test('gives the share table the same column as every other tab', async () => {
		await renderTab()

		const split = [...container.querySelectorAll('div.grid')].find((el) => el.className.includes('minmax('))!
		expect(split.className).toContain('minmax(0,420px)')
		expect(split.querySelector('table')?.className).toContain('w-full')
	})

	test('opens the composition on the widest span it was sent', async () => {
		await renderTab()

		const chips = [...container.querySelectorAll('button')].map((button) => button.textContent)
		expect(chips).toContain('1M')
		expect(chips).toContain('Max')

		const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')].map((button) => button.textContent)
		expect(pressed).toContain('Max')
		// `max` ranks Gnosis DAO, which the 1M composition has folded away entirely.
		expect(container.textContent).toContain('Gnosis DAO')

		await clickChip('1M')
		expect(container.textContent).not.toContain('Gnosis DAO')
	})
})
