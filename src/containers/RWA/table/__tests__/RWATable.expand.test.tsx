// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getRwaDefaultColumnVisibility, getRwaTableColumns, type RWATablePreset } from '../columnSets'
import type { RWAGroupBy } from '../groupBy'
import { RWATable } from '../RWATable'
import { getRwaEffectiveColumnVisibility } from '../useRwaTable'
import { spotAsset } from './fixtures'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn() })
}))

function visibility(
	groupBy: RWAGroupBy,
	{
		preset = 'assets',
		expanded = {},
		chosenByReader = false
	}: { preset?: RWATablePreset; expanded?: Record<string, boolean>; chosenByReader?: boolean } = {}
) {
	const columns = getRwaTableColumns('assets', 'ready', '7d', { preset })
	const result = getRwaEffectiveColumnVisibility({
		columnVisibility: getRwaDefaultColumnVisibility('assets', columns, preset),
		columns,
		preset,
		groupBy,
		expanded,
		expandedColumnsChosenByReader: chosenByReader
	})
	return { assetGroup: result.assetGroup, price: result.price, chains: result.chains, activeMcap: result.activeMcap }
}

describe('RWA column visibility', () => {
	test('shows the asset-row columns only while a platform group is open', () => {
		expect(visibility('platform')).toEqual({ assetGroup: false, price: false, chains: true, activeMcap: true })
		expect(visibility('platform', { expanded: { 'platform:ondo': true } })).toEqual({
			assetGroup: true,
			price: true,
			chains: true,
			activeMcap: true
		})
	})

	test('always shows the asset-row columns under Group by None and hides Chains under Group by Chain', () => {
		expect(visibility('none')).toEqual({ assetGroup: true, price: true, chains: true, activeMcap: true })
		expect(visibility('chain').chains).toBe(false)
	})

	test('keeps the compliance preset free of the expand-only and money columns', () => {
		expect(visibility('none', { preset: 'compliance' })).toEqual({
			assetGroup: false,
			price: false,
			chains: false,
			activeMcap: false
		})
	})

	test('stops painting the asset-row columns once the reader picks columns', () => {
		expect(visibility('none', { chosenByReader: true })).toMatchObject({ assetGroup: true, price: false })
	})
})

describe('RWATable expansion', () => {
	let container: HTMLDivElement
	let root: Root
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	const assets = [spotAsset(), spotAsset({ id: 'ousg', canonicalMarketId: 'ondo/ousg', assetName: 'Ondo OUSG' })]

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const render = (period: '7d' | '1m', groupBy: RWAGroupBy = 'platform') =>
		act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<RWATable
						assets={assets}
						view="assets"
						groupBy={groupBy}
						includeCex={false}
						period={period}
						onPeriodChange={() => {}}
						selectedChain="All"
						includeBridgeTvl
						platformLogos={{}}
					/>
				</QueryClientProvider>
			)
		})
	const rows = () => container.querySelectorAll('tbody tr:not([aria-hidden="true"])')
	const chevron = () => container.querySelector<HTMLButtonElement>('tbody button[aria-expanded]')!

	test('opens a platform group from its chevron and keeps it open when the period switches', async () => {
		await render('7d')
		expect(rows()).toHaveLength(1)
		expect(chevron().getAttribute('aria-expanded')).toBe('false')
		await act(async () => chevron().click())
		expect(chevron().getAttribute('aria-expanded')).toBe('true')
		expect(rows()).toHaveLength(3)
		expect(rows()[1].textContent).toContain('+14.29%')

		await render('1m')
		expect(rows()).toHaveLength(3)
		expect(rows()[1].textContent).toContain('+60.00%')
	})

	test('stops painting the asset-row columns after a grouping switch collapses the groups', async () => {
		const headers = () => [...container.querySelectorAll('thead th')].map((header) => header.textContent?.trim())
		await render('7d', 'platform')
		await act(async () => chevron().click())
		expect(headers()).toContain('Price')
		await render('7d', 'assetGroup')
		expect(rows()).toHaveLength(1)
		expect(headers()).not.toContain('Price')
	})
})
