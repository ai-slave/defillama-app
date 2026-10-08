// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { PeggedAssetInfo } from '../StablecoinOverview'
import type { PeggedAssetPageProps } from '../types'

const session = installSubscriberSession('subscriber', { resolved: true })

const router = vi.hoisted(() => ({
	isReady: false,
	pathname: '/stablecoin/[peggedasset]',
	asPath: '/stablecoin/tether',
	query: { peggedasset: 'tether' } as Record<string, string | Array<string>>,
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

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

const page = () => (
	<session.Wrapper>
		<PeggedAssetInfo {...props} />
	</session.Wrapper>
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
	session.serve({ '/api/public/stablecoins/chart-series': EMPTY_CHART, '/lite/dashboards': { items: [] } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
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
	const chartRequests = session.requests.filter(({ url }) => url.pathname === '/api/public/stablecoins/chart-series')
	expect(chartRequests.map(({ url }) => url.searchParams.get('unreleased'))).toEqual(['true'])

	await act(async () => unreleasedCheckbox().click())
	expect(router.query).toEqual({ peggedasset: 'tether' })
	expect(totalCirculating()).toBe('100m')
	expect(unreleasedCheckbox().checked).toBe(false)
})
