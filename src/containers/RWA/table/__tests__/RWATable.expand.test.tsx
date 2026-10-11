import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { RWATableColumnSet } from '../columnSetQuery'
import { getRwaDefaultColumnVisibility, getRwaTableColumns } from '../columnSets'
import type { RWAGroupBy } from '../groupBy'
import { RWATable } from '../RWATable'
import { getRwaEffectiveColumnVisibility } from '../useRwaTable'
import { spotAsset } from './fixtures'

const router = vi.hoisted(() => ({
	query: {} as Record<string, string>,
	pathname: '/rwa',
	asPath: '/rwa',
	push: vi.fn((_url: { pathname: string; query: Record<string, string> }, _as?: string, _options?: object) =>
		Promise.resolve(true)
	)
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// The Assets table asks for the flow summary; the fixture answers with no windows, so the flow cells stay empty.
const http = installFixtureFetch()
const EMPTY_FLOW_WINDOW = { asset: {}, assetGroup: {}, platform: {}, category: {}, chain: {} }

function visibility(
	groupBy: RWAGroupBy,
	{
		columnSet = 'metrics',
		expanded = {},
		chosenByReader = false
	}: { columnSet?: RWATableColumnSet; expanded?: Record<string, boolean>; chosenByReader?: boolean } = {}
) {
	const columns = getRwaTableColumns('overview', 'ready', '7d', columnSet)
	const result = getRwaEffectiveColumnVisibility({
		columnVisibility: getRwaDefaultColumnVisibility('assets', columns, columnSet),
		columns,
		columnSet,
		groupBy,
		pageKind: 'overview',
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

	test('keeps the compliance column set free of the expand-only and money columns', () => {
		expect(visibility('none', { columnSet: 'compliance' })).toEqual({
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

function perpsVisibility(groupBy: RWAGroupBy, expanded: Record<string, boolean> = {}) {
	const columns = getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics')
	const result = getRwaEffectiveColumnVisibility({
		columnVisibility: getRwaDefaultColumnVisibility('perps', columns, 'metrics'),
		columns,
		columnSet: 'metrics',
		groupBy,
		pageKind: 'perpsOverview',
		expanded,
		expandedColumnsChosenByReader: false
	})
	const { pair, price, premium, fundingApr, maxLeverage, accessModel, assetGroup, openInterest } = result
	return { pair, price, premium, fundingApr, maxLeverage, accessModel, assetGroup, openInterest }
}

describe('RWA perps column visibility', () => {
	test('shows Pair, the Price and Funding columns only while a group is open, on every Group by; Access Model always', () => {
		const closed = {
			pair: false,
			price: false,
			premium: false,
			fundingApr: false,
			maxLeverage: false,
			accessModel: true
		}
		const open = {
			pair: true,
			price: true,
			premium: true,
			fundingApr: true,
			maxLeverage: true,
			accessModel: true
		}
		expect(perpsVisibility('platform')).toEqual({ ...closed, assetGroup: true, openInterest: true })
		expect(perpsVisibility('asset')).toMatchObject(closed)
		expect(perpsVisibility('platform', { 'platform:Hyperliquid': true })).toMatchObject(open)
		expect(perpsVisibility('none')).toMatchObject(open)
	})
})

describe('RWATable expansion', () => {
	let container: HTMLDivElement
	let root: Root
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	const assets = [spotAsset(), spotAsset({ id: 'ousg', canonicalMarketId: 'ondo/ousg', assetName: 'Ondo OUSG' })]

	beforeEach(() => {
		http.serve({
			'/api/public/rwa/flows/summary': {
				generatedAt: 0,
				windows: { '7d': EMPTY_FLOW_WINDOW, '30d': EMPTY_FLOW_WINDOW }
			}
		})
		router.query = {}
		router.push.mockClear()
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
						groupBy={groupBy}
						period={period}
						onPeriodChange={() => {}}
						pageKind="overview"
						pageSlug={null}
						includeBridgeTvl
						platformLogos={{}}
					/>
				</QueryClientProvider>
			)
		})
	const rows = () => container.querySelectorAll('tbody tr:not([aria-hidden="true"])')
	const chevron = () => container.querySelector<HTMLButtonElement>('tbody button[aria-expanded]')!
	const segment = (name: string) =>
		[...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
			(radio) => radio.labels?.[0].textContent === name
		)!

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

	test('opens Compliance from a shared view=compliance link and writes the table key when the reader switches', async () => {
		const headers = () => [...container.querySelectorAll('thead th')].map((header) => header.textContent?.trim())
		router.query = { view: 'compliance' }
		await render('7d', 'none')
		expect(segment('Compliance').checked).toBe(true)
		expect(headers()).toContain('Issuer')
		await act(async () => segment('Metrics').click())
		expect(router.push).toHaveBeenCalledWith(
			{ pathname: '/rwa', query: {} },
			undefined,
			expect.objectContaining({ shallow: true })
		)
	})

	test('keeps the search and the open groups when the reader switches the column set', async () => {
		const periodSwitch = () => container.querySelector('[aria-label="Change period"]')
		await render('7d')
		await act(async () => chevron().click())
		const search = container.querySelector<HTMLInputElement>('input[placeholder="Search assets…"]')!
		await act(async () => {
			search.value = 'OUSG'
			search.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(rows()).toHaveLength(2)
		expect(periodSwitch()).not.toBeNull()
		await act(async () => segment('Compliance').click())
		// The router hands the pushed address back to the page, as a shallow navigation does.
		router.query = router.push.mock.calls[0][0].query
		await render('7d')
		expect(chevron().getAttribute('aria-expanded')).toBe('true')
		expect(rows()).toHaveLength(2)
		expect(periodSwitch()).toBeNull()
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
