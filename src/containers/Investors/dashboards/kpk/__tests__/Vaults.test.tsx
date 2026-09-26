// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { settleQueries } from '~/utils/testing/settleQueries'
import type { KpkVaults } from '../api'
import Vaults from '../Vaults'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/investors', query: {} }) }))
const http = installFixtureFetch()
// The chart draws nothing these tests read; its series are covered by buildComposition.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const DOUBLE_COUNT_NOTE =
	'KPK USDC RWA Liquidity allocates into KPK’s own Morpho vaults, so this TVA is also counted inside those vaults.'

const VAULTS: KpkVaults = {
	tva: 31,
	tvaAdjusted: 30,
	count: 3,
	venues: ['Morpho', 'Gearbox', 'Symbiotic'],
	rebalancingVolume: '$9.9bn',
	rebalancingVolumeUsd: 9_900_000_000,
	rebalancingActions: 11_462,
	rebalancingActionsLabel: '11,462',
	rebalancingRef: { label: 'KPK Vaults Operations — Dune', url: 'https://dune.com/kpk/kpk-vaults-operations' },
	liquidityPct: 60.5,
	liquidityTarget: 15,
	comp: {
		venue: {
			title: 'By venue',
			ranges: {
				'1m': {
					title: 'By venue',
					total: 31,
					months: ['11 Aug 26', '12 Aug 26'],
					segments: [{ name: 'Morpho', value: 31, share: 100, series: [30, 31] }],
					window: { from: '2026-08-11', to: '2026-08-12', days: 2, points: 2, gaps: [], missingDays: 0 }
				},
				max: {
					title: 'By venue',
					total: 31,
					months: ['Jul 26', 'Aug 26'],
					segments: [
						{ name: 'Morpho', value: 30, share: 96.8, series: [25, 30] },
						{
							name: 'Symbiotic',
							value: 1,
							share: 3.2,
							series: [1, 1],
							duplicate: true,
							note: DOUBLE_COUNT_NOTE
						}
					],
					line: { name: 'Adjusted TVA', note: DOUBLE_COUNT_NOTE, value: 30, series: [25, 30] },
					window: {
						from: '2026-07-01',
						to: '2026-08-12',
						days: 30,
						points: 30,
						gaps: [{ from: '2026-07-06', to: '2026-07-19', days: 14 }],
						missingDays: 14
					}
				}
			}
		},
		chain: { title: 'By chain', ranges: { max: { title: 'By chain', total: 30, months: [], segments: [] } } },
		asset: {
			title: 'By supply asset',
			ranges: { max: { title: 'By supply asset', total: 30, months: [], segments: [] } }
		},
		collateral: {
			title: 'By collateral',
			ranges: { max: { title: 'By collateral', total: 30, months: [], segments: [] } }
		}
	},
	compAsOf: '2026-08-12',
	compTotal: 31,
	list: [
		{
			name: 'KPK USDC Prime Vault',
			venue: 'Morpho',
			chain: 'Ethereum',
			asset: 'USDC',
			tva: 20,
			interest: 0.5,
			liqTarget: 15,
			apy: 4.22,
			apy30: 3.9,
			exposure: 'wstETH, WBTC',
			rebalances30d: 12,
			deriskingAutomations: 1710,
			liq: 83.6,
			bench: 3.71,
			benchName: 'Gauntlet USDC Prime',
			spreadBps: 19,
			belowTarget: false,
			url: 'https://app.morpho.org/vault/kpk-usdc-prime'
		},
		{
			name: 'KPK wstETH Earn Pool',
			venue: 'Gearbox',
			chain: 'Ethereum',
			asset: 'wstETH',
			tva: 10,
			interest: 0.25,
			liqTarget: 15,
			apy: 3.32,
			apy30: 3.69,
			exposure: 'Leveraged LST credit accounts',
			rebalances30d: 'NA',
			liq: 12,
			spreadBps: 150,
			belowTarget: true
		},
		{
			name: 'KPK USDC RWA Liquidity',
			venue: 'Symbiotic',
			chain: 'Ethereum',
			asset: 'USDC',
			tva: 1,
			interest: 0.002,
			liqTarget: 15,
			apy: 5.78,
			apy30: 5.6,
			rebalances30d: 10,
			liq: 43.7,
			spreadBps: 136,
			belowTarget: false,
			doubleCounted: true
		}
	],
	doubleCountNote: DOUBLE_COUNT_NOTE,
	totals: { tva: 31, interest: 0.752, tvaAdjusted: 30, interestAdjusted: 0.75 },
	riskDisclaimer: 'Curated vaults carry risk of loss.',
	refs: [{ label: 'Morpho vaults', url: 'https://dune.com/kpk/kpk-morpho-vaults' }]
}

let served: KpkVaults = VAULTS

describe('kpk Vaults tab', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		http.serve({ '/api/public/kpk/vaults': () => served })
		served = VAULTS
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
						<Vaults />
					</Suspense>
				</QueryClientProvider>
			)
		)
		await settleQueries(client)
		expect(container.textContent).toContain('KPK USDC Prime Vault')
	}

	const clickChip = async (label: string) => {
		const chip = [...container.querySelectorAll('button')].find((button) => button.textContent === label)!
		await act(async () => chip.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	const rowOf = (name: string) =>
		[...container.querySelectorAll('tbody tr')].find((row) => row.textContent?.startsWith(name))!

	// "No rebalancing agent" must not collapse into the "no source" dash.
	test('marks a vault with no rebalancing agent n/a rather than a missing value', async () => {
		await renderTab()
		const row = rowOf('KPK wstETH Earn Pool')

		expect(row.querySelector('[aria-label*="no rebalancing agent"]')?.closest('td')?.textContent).toBe('n/a')
	})

	test('flags the double-counted vault on its own row', async () => {
		await renderTab()

		expect(rowOf('KPK USDC RWA Liquidity').querySelector(`[aria-label="${DOUBLE_COUNT_NOTE}"]`)).not.toBeNull()
		expect(rowOf('KPK USDC Prime Vault').querySelector(`[aria-label="${DOUBLE_COUNT_NOTE}"]`)).toBeNull()
	})

	test('links the rebalancing figures to the operations query when the adapter names no ref', async () => {
		served = { ...VAULTS, rebalancingRef: undefined }
		await renderTab()

		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-vaults-operations"]')).not.toBeNull()
	})

	test('filters the vaults by venue and switches the breakdown range', async () => {
		await renderTab()

		await clickChip('Gearbox')
		expect(container.textContent).not.toContain('KPK USDC Prime Vault')
		expect(container.textContent).toContain('$250k')
		expect(container.textContent).not.toContain('Adjusted, excl.')

		expect(container.textContent).toContain('the line joins straight across it')
		await clickChip('1M')
		expect(container.textContent).not.toContain('the line joins straight across it')
	})
})
