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
	useKpkVaults: () => ({ data: served, isError: false })
}))

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
	liquidityPct: 60.5,
	liquidityTarget: 15,
	comp: {
		venue: {
			title: 'By venue',
			total: 31,
			months: ['Jul 26', 'Aug 26'],
			segments: [
				{ name: 'Morpho', value: 30, share: 96.8, series: [25, 30] },
				{ name: 'Symbiotic', value: 1, share: 3.2, series: [1, 1], duplicate: true }
			],
			line: { name: 'Adjusted TVA', note: DOUBLE_COUNT_NOTE, value: 30, series: [25, 30] }
		},
		chain: { title: 'By chain', total: 30, months: [], segments: [] },
		asset: { title: 'By supply asset', total: 30, months: [], segments: [] },
		collateral: { title: 'By collateral', total: 30, months: [], segments: [] }
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
			belowTarget: false
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

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		served = VAULTS
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	/** Breakdown chips, in the order the toggle group renders them. */
	const breakdownChips = () =>
		[...container.querySelectorAll('button')]
			.map((button) => button.textContent)
			.filter((text) => text?.startsWith('By '))

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

	const clickChip = async (label: string) => {
		const chip = [...container.querySelectorAll('button')].find((button) => button.textContent === label)!
		await act(async () => chip.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	it('renders the ledger, the vault rows and USD totals converted from $m', async () => {
		await renderTab()

		expect(container.textContent).toContain('KPK USDC Prime Vault')
		expect(container.textContent).toContain('KPK wstETH Earn Pool')
		// tva 20 + 10 + 1 ($m) and interest 0.5 + 0.25 + 0.002 ($m)
		expect(container.textContent).toContain('$31m')
		expect(container.textContent).toContain('$752k')
		expect(container.textContent).toContain('$9.9bn')
		expect(container.textContent).toContain('60.5%')
	})

	// "No rebalancing agent" and "no source" must not collapse into the same cell.
	it('marks a venue with no rebalancing agent as not applicable', async () => {
		await renderTab()

		expect(container.textContent).toContain('n/a')
		expect(container.querySelector('[title*="no rebalancing agent"]')).not.toBeNull()
	})

	it('shows a derisking count where the venue reports one and a dash where it does not', async () => {
		await renderTab()

		expect(container.textContent).toContain('1,710')
		expect(container.querySelector('th[title*="agent-executed derisking rebalances"]')).not.toBeNull()
	})

	it('states the gross TVA with the adjusted figure and the netting rule beneath it', async () => {
		await renderTab()

		expect(container.textContent).toContain('adjusted, excluding Symbiotic')
		expect(container.querySelector(`[title="${DOUBLE_COUNT_NOTE}"]`)).not.toBeNull()
	})

	it('marks the double-counted vault and nets it out of a second footer row', async () => {
		await renderTab()

		expect(container.textContent).toContain('†')
		expect(container.textContent).toContain('Adjusted, excl. Symbiotic')

		expect(container.textContent).toContain('$30m')
		expect(container.textContent).toContain('$750k')
	})

	it('drops the adjusted footer row for a filter that nets out nothing', async () => {
		await renderTab()
		await clickChip('Morpho')

		expect(container.textContent).not.toContain('Adjusted, excl.')
	})

	it('labels the breakdown chips with the payload titles, in payload order', async () => {
		await renderTab()

		expect(breakdownChips()).toEqual(['By venue', 'By chain', 'By supply asset', 'By collateral'])
	})

	it('drops a breakdown chip the payload did not send', async () => {
		served = { ...VAULTS, comp: { venue: VAULTS.comp.venue, chain: VAULTS.comp.chain, asset: VAULTS.comp.asset } }
		await renderTab()

		expect(breakdownChips()).toEqual(['By venue', 'By chain', 'By supply asset'])
	})

	it('filters the table by venue and recomputes the footer', async () => {
		await renderTab()
		await clickChip('Gearbox')

		expect(container.textContent).not.toContain('KPK USDC Prime Vault')
		expect(container.textContent).toContain('$10m')
		expect(container.textContent).toContain('$250k')
	})
})
