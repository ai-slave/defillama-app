// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { PeggedAssetInfo } from '../StablecoinOverview'
import type { PeggedAssetPageProps } from '../types'

const http = installFixtureFetch()

const router = vi.hoisted(() => ({
	isReady: false,
	pathname: '/stablecoin/[peggedasset]',
	asPath: '/stablecoin/tether',
	query: { peggedasset: 'tether' } as Record<string, string | Array<string>>,
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Needs the auth provider; nothing here reads it.
vi.mock('~/components/AddToDashboard/AddToDashboardButton', () => ({ AddToDashboardButton: () => null }))

const EMPTY_CHART = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: [],
	valueSymbol: '$',
	stacked: false,
	showTotalInTooltip: false
}

const props = {
	chainsUnique: [],
	chainCirculatings: [],
	peggedAssetData: {
		id: '1',
		name: 'Tether',
		address: null,
		symbol: 'USDT',
		url: '',
		description: '',
		mintRedeemDescription: '',
		onCoinGecko: true,
		gecko_id: 'tether',
		cmcId: null,
		pegType: 'peggedUSD',
		pegMechanism: 'fiat-backed',
		twitter: null,
		price: 1
	},
	defaultChartData: EMPTY_CHART,
	totalCirculating: 100_000_000,
	unreleased: 50_000_000,
	mcap: 100_000_000,
	bridgeInfo: {},
	blockExplorerUrl: null,
	blockExplorerName: null
} as unknown as PeggedAssetPageProps

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

const page = () => (
	<QueryClientProvider client={queryClient}>
		<PeggedAssetInfo {...props} />
	</QueryClientProvider>
)

// Shallow routing re-renders the page with the new query; the mock does the same.
router.replace.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	await act(async () => root.render(page()))
})

const totalCirculating = () =>
	[...container.querySelectorAll('p')].find((row) => row.textContent?.startsWith('Total Circulating'))?.lastChild
		?.textContent
const unreleasedCheckbox = () => container.querySelector<HTMLInputElement>('input[value="unreleased"]')!

beforeEach(() => {
	http.serve({ '/api/public/stablecoins/chart-series': EMPTY_CHART })
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	queryClient.clear()
	container.remove()
	router.isReady = false
	router.query = { peggedasset: 'tether' }
})

test('the unreleased flag in the URL adds unreleased supply once the router is ready, and the toggle removes it', async () => {
	// Before hydration a static page's query holds only the route param.
	await act(async () => root.render(page()))
	expect(totalCirculating()).toBe('100m')

	router.isReady = true
	router.query = { peggedasset: 'tether', unreleased: 'true' }
	await act(async () => root.render(page()))
	expect(totalCirculating()).toBe('150m')
	expect(unreleasedCheckbox().checked).toBe(true)
	expect(http.urls()).toEqual([
		'http://localhost:3000/api/public/stablecoins/chart-series?scope=asset&chart=totalCirc&limit=10&stablecoin=tether&unreleased=true'
	])

	await act(async () => unreleasedCheckbox().click())
	expect(router.query).toEqual({ peggedasset: 'tether' })
	expect(totalCirculating()).toBe('100m')
	expect(unreleasedCheckbox().checked).toBe(false)
})
