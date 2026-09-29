// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SmolStats } from '../SmolStats'
import type { IChainOverviewData } from '../types'

const props = {
	chain: 'All',
	metadata: { name: 'All' },
	unlocks: null,
	dexs: {
		total24h: null,
		total7d: null,
		change_7dover7d: null,
		dexsDominance: null,
		chart: null
	},
	etfs: [
		[1_700_000_000_000, 1_000_000],
		[1_700_086_400_000, 2_000_000]
	],
	totalRwaActiveMcap: {
		total: 3_000_000,
		chart: [
			[1_700_000_000_000, 2_500_000],
			[1_700_086_400_000, 3_000_000]
		]
	},
	chainFees: { total24h: null, feesGenerated24h: null, topProtocolsChart: null, totalREV24h: null },
	stablecoins: null
} as IChainOverviewData

describe('all-chains summary charts', () => {
	let container: HTMLDivElement
	let root: Root
	const track = vi.fn()

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		window.umami = { track, identify: vi.fn() }
		track.mockClear()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		delete window.umami
	})

	const cardTexts = () => Array.from(container.firstElementChild!.children, (card) => card.textContent)

	test('shows the latest ETF inflow and the total RWA active AUM', async () => {
		await act(async () => root.render(<SmolStats {...props} />))

		expect(cardTexts()).toEqual(['ETF Inflows$2m24h', 'Total RWA Active AUM$3m'])
	})

	test('hides the RWA card when its chart has no points', async () => {
		await act(async () => root.render(<SmolStats {...props} totalRwaActiveMcap={{ total: 3_000_000, chart: [] }} />))

		expect(cardTexts()).toEqual(['ETF Inflows$2m24h'])
	})

	test('reports chart clicks with their slot and metric', async () => {
		await act(async () => root.render(<SmolStats {...props} />))

		await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/etfs"]')!.click())
		await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/rwa"]')!.click())

		expect(track.mock.calls).toEqual([
			['home-chart-click', { slot: 'top-right', metric: 'etf-inflows' }],
			['home-chart-click', { slot: 'middle-left', metric: 'rwa-active-aum' }]
		])
	})
})
