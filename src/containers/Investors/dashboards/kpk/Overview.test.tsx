// @vitest-environment happy-dom

import { act, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { KpkOverview, KpkRangedComposition } from './api'
import Overview from './Overview'

// The renderer pulls in ECharts, which has no place in a ledger-strip assertion.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	useKpkOverview: () => ({ data: served, isError: false })
}))

const EMPTY_COMP: KpkRangedComposition = {
	title: 'By breakdown',
	ranges: { max: { title: 'By breakdown', total: 0, months: [], segments: [] } }
}

/** Line names read as sentences, which is what pushes `Share` out of a narrow table. */
const LINE_COMP: KpkRangedComposition = {
	title: 'By line',
	ranges: {
		max: {
			title: 'By line',
			total: 217,
			months: ['Jul 26', 'Aug 26'],
			segments: [
				{ name: 'Treasury mandates, discretionary execution', value: 157, share: 72.4, series: [150, 157] },
				{ name: 'Curated vaults', value: 60, share: 27.6, series: [55, 60] }
			]
		}
	}
}

const OVERVIEW: KpkOverview = {
	asOf: { mandates: '2026-08-12', vaults: '2026-08-12' },
	tva: 217,
	tvaAdjusted: null,
	tvaAdjustedLabel: null,
	doubleCountNote: null,
	deployedOnchain: { value: '$8.03bn', sub: 'Cumulative value deployed onchain' },
	rebalancing: {
		value: '$9.9bn',
		sub: "Executed by KPK's non-custodial rebalancing and exit agents on Vaults and Funds",
		metric: '11,462',
		metricLabel: 'cumulative rebalancing actions'
	},
	fundsLost: { value: 0, since: 2021, years: [2021, 2022] },
	comp: { line: LINE_COMP, denom: EMPTY_COMP, chain: EMPTY_COMP, protocol: EMPTY_COMP },
	refs: []
}

let served: KpkOverview = OVERVIEW

describe('kpk Overview tab', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		served = OVERVIEW
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const renderTab = async () => {
		await act(async () =>
			root.render(
				<Suspense fallback={null}>
					<Overview />
				</Suspense>
			)
		)
	}

	test('links the operations query beside the rebalancing caption', async () => {
		await renderTab()

		const link = container.querySelector<HTMLAnchorElement>('a[href="https://dune.com/kpk/kpk-vaults-operations"]')

		expect(link).not.toBeNull()
		expect(link?.parentElement?.parentElement?.textContent).toContain(
			"Executed by KPK's non-custodial rebalancing and exit agents on Vaults and Funds"
		)
	})

	test('keeps the ref the adapter sends over the pinned one', async () => {
		served = {
			...OVERVIEW,
			rebalancing: { ...OVERVIEW.rebalancing, ref: { label: 'Agent ops', url: 'https://dune.com/kpk/other' } }
		}
		await renderTab()

		expect(container.querySelector('a[href="https://dune.com/kpk/other"]')).not.toBeNull()
		expect(container.querySelector('a[href="https://dune.com/kpk/kpk-vaults-operations"]')).toBeNull()
	})

	test('gives the share table the room the line names need', async () => {
		await renderTab()

		const split = [...container.querySelectorAll('div.grid')].find((el) => el.className.includes('minmax('))
		const nameCell = [...container.querySelectorAll('td')].find((cell) =>
			cell.textContent?.includes('Treasury mandates, discretionary execution')
		)

		expect(split?.className).toContain('minmax(0,420px)')
		// Sized to the card, so the last column can't be pushed out of view.
		expect(container.querySelector('table')?.className).toContain('w-full')
		// A wrapping name stays inside the column rather than scrolling `Share` out of sight.
		expect(nameCell?.className).not.toContain('whitespace-nowrap')
		expect(container.textContent).toContain('Share')
	})
})
