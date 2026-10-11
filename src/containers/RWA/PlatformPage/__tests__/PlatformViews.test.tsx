// @vitest-environment happy-dom

/* Behavioral contracts only, nothing here asserts on layout or class names:
   - each view shows its own content: the table under Assets, the profile under Information
   - the profile stays in the served HTML under the table view, hidden, for crawlers
   - About and Compliance render on a bare meta; Fees, Entity, Regulation and Milestones only with content
   - a platform that also runs a perps venue links to the venue page from About
   - in a protocol's RWA tab, the view switch is a tab list whose panels are the views; a pick writes the view to the
     URL and keeps focus on the switch, and the tab opens on the view its URL names
   The Website link choice is covered by getRwaPlatformLinks in panels/__tests__/panelData.test.ts.
   The view's query encoding, old `?view=compliance` links included, is covered by view.test.ts; the view tabs of a
   platform page, links in the page's top row, by layout/__tests__/pageTabs.test.ts. */

import type { ParsedUrlQuery } from 'node:querystring'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWAOverview } from '~/containers/RWA'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { settleQueries } from '~/utils/testing/settleQueries'
import type { IRWAAssetsOverview } from '../../api.types'
import { foldRwaPerpsTotals } from '../../cards/cardData'
import { foldRwaPlatformKpi } from '../../kpi/platformKpi'
import { spotAsset } from '../../table/__tests__/fixtures'
import type { RWAPlatformMeta } from '../api.types'
import { RWAPlatformViews } from '../PlatformViews'
import { getRwaEntityViewQueryPatch, type RWAEntityView } from '../view'
import { meta as platformMeta } from './platformFixture'

const router = vi.hoisted(() => ({
	pathname: '/protocol/rwa/[protocol]',
	asPath: '/protocol/rwa/ondo-finance',
	isReady: true,
	query: {} as ParsedUrlQuery,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
// The charts sit beside the view switch and nothing here asserts on them; their datasets would need fixtures of their own.
vi.mock('../../OverviewChartPanel', () => ({ RWAOverviewChartPanel: () => null }))
vi.mock('../../platformChart/PlatformEntityChartPanel', () => ({ RWAPlatformEntityChartPanel: () => null }))
// The table and Key Metrics ask for the flow summary; the fixture answers with no windows, so the flow figures stay empty.
const http = installFixtureFetch()
const EMPTY_FLOW_WINDOW = { asset: {}, assetGroup: {}, platform: {}, category: {}, chain: {} }

const PROFILE_COPY = 'Ondo Finance is the largest pure-play RWA platform.'

const bare = {
	name: 'Ondo',
	slug: 'ondo',
	description: PROFILE_COPY,
	logo: null,
	platformType: null,
	category: null,
	accessModel: null,
	website: null,
	refLinks: null,
	docs: null,
	protocolSlug: null,
	foundersParsed: [],
	founders: null,
	milestones: [],
	keyMilestones: null,
	suspicious: false
} as unknown as RWAPlatformMeta

const platformAssets = [spotAsset(), spotAsset({ id: 'b', canonicalMarketId: 'b', issuer: 'Apollo' })]
const kpi = foldRwaPlatformKpi(platformAssets, { includeBridgeTvl: true })

function PlatformPage({
	initialView,
	meta = bare,
	perpsVenueHref = null
}: {
	initialView: RWAEntityView
	meta?: RWAPlatformMeta
	perpsVenueHref?: string | null
}) {
	return (
		<RWAPlatformViews
			meta={meta}
			kpi={kpi}
			view={initialView}
			tabs={false}
			perpsVenueHref={perpsVenueHref}
			renderTable={() => <div>the assets table</div>}
		/>
	)
}

/* The protocol's RWA tab as src/pages/protocol/rwa/[protocol].tsx renders it, for a platform with a profile. */
const ROUTE_QUERY: ParsedUrlQuery = { protocol: 'ondo-finance' }
const protocolOverview: IRWAAssetsOverview = {
	platformPage: { meta: platformMeta({ name: 'Ondo', slug: 'ondo', description: PROFILE_COPY }) },
	assets: platformAssets,
	perpsTotals: foldRwaPerpsTotals([]),
	typeOptions: [],
	assetClassOptions: [],
	rwaClassificationOptions: [],
	accessModelOptions: [],
	categoriesOptions: [],
	platforms: ['Ondo'],
	assetGroups: ['Bonds'],
	assetNames: ['Ondo USDY'],
	issuers: ['Ondo', 'Apollo'],
	selectedPlatform: 'Ondo',
	selectedAssetGroup: 'All',
	defaultInclusion: { includeStablecoins: false, includeGovernance: false, includeBridgeTvl: true },
	selectedChain: 'All',
	selectedCategory: 'All',
	nav: { heading: 'Platforms', links: [], active: 'Ondo' },
	initialChartDatasets: [],
	cards: null,
	chartMetricAvailability: { hasActiveMcapData: true },
	seriesLatestTimestamp: null,
	platformLogos: {},
	chainSlug: null,
	categorySlug: null,
	platformSlug: 'ondo',
	assetGroupSlug: null
}

describe('RWA platform views', () => {
	let container: HTMLDivElement
	let root: Root

	const render = (initialView: RWAEntityView, meta?: RWAPlatformMeta) =>
		act(async () => {
			root.render(<PlatformPage initialView={initialView} meta={meta} />)
		})
	let client: QueryClient
	const protocolTab = () => (
		<QueryClientProvider client={client}>
			<RWAOverview {...protocolOverview} pageKind="platform" hideEntityNav />
		</QueryClientProvider>
	)
	/** Opens the protocol's RWA tab at `query`. */
	const openProtocolTab = async (query: ParsedUrlQuery) => {
		router.query = query
		await act(async () => root.render(protocolTab()))
		await settleQueries(client)
	}
	const viewSwitch = () =>
		[...container.querySelectorAll('[role="tablist"]')].find((list) => accessibleName(list) === 'Platform view')!
	const viewTabs = () => [...viewSwitch().querySelectorAll<HTMLElement>('[role="tab"]')]
	const viewTab = (name: string) => viewTabs().find((tab) => accessibleName(tab) === name)!
	const panelOf = (tab: HTMLElement) =>
		[...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')].find(
			(panel) => panel.getAttribute('aria-labelledby') === tab.id
		) ?? null
	/** The query the last view pick pushed. */
	const pushedQuery = () => router.push.mock.lastCall![0].query as ParsedUrlQuery

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		http.serve({
			'/api/public/rwa/flows/summary': {
				generatedAt: 0,
				windows: { '7d': EMPTY_FLOW_WINDOW, '30d': EMPTY_FLOW_WINDOW }
			}
		})
		router.query = {}
		router.push.mockReset()
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('shows the table under Assets and the profile under Information', async () => {
		await render('list')
		expect(container.textContent).toContain('the assets table')
		expect(container.querySelector('[hidden]')!.textContent).toContain(PROFILE_COPY)

		await render('information')
		expect(container.textContent).not.toContain('the assets table')
		expect(container.querySelector('[hidden]')).toBeNull()
		expect(container.textContent).toContain(PROFILE_COPY)
	})

	test('serves the profile copy under the table view, hidden', () => {
		const html = renderToStaticMarkup(<PlatformPage initialView="list" />)
		const document = new DOMParser().parseFromString(html, 'text/html')
		expect(document.querySelector('[hidden]')!.textContent).toContain(PROFILE_COPY)
		expect(document.body.textContent).toContain('the assets table')
	})

	test('hides the panels a bare meta has nothing to say in', async () => {
		await render('information')
		const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
		expect(headings).toEqual(['About Ondo', 'Compliance'])
	})

	test('links a platform that also runs a perps venue to its venue page from About', () => {
		const venueLink = (perpsVenueHref: string | null) => {
			const html = renderToStaticMarkup(<PlatformPage initialView="information" perpsVenueHref={perpsVenueHref} />)
			const link = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a')].find(
				(anchor) => anchor.textContent === 'Perps on the venue page'
			)
			return link?.getAttribute('href') ?? null
		}
		expect(venueLink('/rwa/perps/venue/ondo')).toBe('/rwa/perps/venue/ondo')
		expect(venueLink(null)).toBeNull()
	})

	test('switches the views as tabs in a protocol tab, writes the pick to the URL and keeps focus on the switch', async () => {
		// Next re-renders the page with the pushed query after a shallow push; the switch stays mounted across it.
		router.push.mockImplementation(async (url: { query: ParsedUrlQuery }) => {
			router.query = { ...ROUTE_QUERY, ...url.query }
			root.render(protocolTab())
			return true
		})
		await openProtocolTab({ ...ROUTE_QUERY })
		expect(viewTabs().map((tab) => [accessibleName(tab), tab.getAttribute('aria-selected')])).toEqual([
			['Information', 'false'],
			['Assets', 'true']
		])
		expect(panelOf(viewTab('Assets'))!.hidden).toBe(false)
		expect(panelOf(viewTab('Information'))!.hidden).toBe(true)

		const information = viewTab('Information')
		await act(async () => {
			information.focus()
			information.click()
		})
		expect(router.push).toHaveBeenCalledTimes(1)
		expect(pushedQuery()).toEqual(getRwaEntityViewQueryPatch('information', ROUTE_QUERY))
		expect(information.isConnected).toBe(true)
		expect(document.activeElement).toBe(information)
		expect(information.getAttribute('aria-selected')).toBe('true')
		expect(panelOf(information)!.hidden).toBe(false)
		expect(panelOf(information)!.textContent).toContain(PROFILE_COPY)
		expect(panelOf(viewTab('Assets'))).toBeNull()
	})

	test('opens a protocol tab on the view its URL names', async () => {
		await openProtocolTab({ ...ROUTE_QUERY })
		await act(async () => viewTab('Information').click())
		const linked = { ...ROUTE_QUERY, ...pushedQuery() }

		await act(async () => root.unmount())
		root = createRoot(container)
		await openProtocolTab(linked)
		expect(viewTabs().map((tab) => [accessibleName(tab), tab.getAttribute('aria-selected')])).toEqual([
			['Information', 'true'],
			['Assets', 'false']
		])
		expect(panelOf(viewTab('Information'))!.hidden).toBe(false)
		expect(panelOf(viewTab('Information'))!.textContent).toContain(PROFILE_COPY)
		expect(panelOf(viewTab('Assets'))).toBeNull()
	})
})
