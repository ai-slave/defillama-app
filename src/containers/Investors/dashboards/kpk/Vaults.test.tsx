// @vitest-environment happy-dom

import { act, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KpkVaults } from './api'

// The renderer pulls in ECharts, which has no place in a table assertion.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

// The query layer is a thin fetch wrapper; this exercises the payload → table path.
vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	useKpkVaults: () => ({ data: VAULTS, isError: false })
}))

const VAULTS: KpkVaults = {
	tva: 30,
	count: 2,
	venues: ['Morpho', 'Gearbox'],
	rebalancingVolume: '$9.9bn',
	rebalancingVolumeUsd: 9_900_000_000,
	rebalancingActions: 11_462,
	rebalancingActionsLabel: '11,462',
	liquidityPct: 60.5,
	liquidityTarget: 15,
	comp: {
		venue: {
			title: 'By venue',
			total: 30,
			months: ['Jul 26', 'Aug 26'],
			segments: [{ name: 'Morpho', value: 30, share: 100, series: [25, 30] }]
		},
		chain: { title: 'By chain', total: 30, months: [], segments: [] },
		asset: { title: 'By asset', total: 30, months: [], segments: [] }
	},
	compAsOf: '2026-08-12',
	compTotal: 30,
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
			liq: 83.6,
			bench: 3.71,
			benchName: 'Gauntlet USDC Prime',
			spreadBps: 19,
			belowTarget: false,
			health: 'ok'
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
			belowTarget: true,
			health: 'watch'
		}
	],
	totals: { tva: 30, interest: 0.75 },
	riskDisclaimer: 'Curated vaults carry risk of loss.',
	refs: [{ label: 'Morpho vaults', url: 'https://dune.com/kpk/kpk-morpho-vaults' }]
}

describe('kpk Vaults tab', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function renderTab() {
		const { default: Vaults } = await import('./Vaults')
		await act(async () =>
			root.render(
				<Suspense fallback={null}>
					<Vaults />
				</Suspense>
			)
		)
	}

	it('renders the ledger, the vault rows and USD totals converted from $m', async () => {
		await renderTab()

		expect(container.textContent).toContain('KPK USDC Prime Vault')
		expect(container.textContent).toContain('KPK wstETH Earn Pool')
		// tva 20 + 10 ($m) and interest 0.5 + 0.25 ($m)
		expect(container.textContent).toContain('$30m')
		expect(container.textContent).toContain('$750k')
		expect(container.textContent).toContain('$9.9bn')
		expect(container.textContent).toContain('60.5%')
	})

	// "No rebalancing agent" and "no source" must not collapse into the same cell.
	it('marks a venue with no rebalancing agent as not applicable', async () => {
		await renderTab()

		expect(container.textContent).toContain('n/a')
		expect(container.querySelector('[title*="no rebalancing agent"]')).not.toBeNull()
	})

	it('flags a vault below its withdrawal-liquidity target for monitoring', async () => {
		await renderTab()

		expect(container.textContent).toContain('Monitor')
		expect(container.textContent).toContain('Healthy')
	})

	it('filters the table by venue and recomputes the footer', async () => {
		await renderTab()

		const gearbox = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Gearbox')!
		await act(async () => gearbox.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(container.textContent).not.toContain('KPK USDC Prime Vault')
		expect(container.textContent).toContain('$10m')
		expect(container.textContent).toContain('$250k')
	})
})
