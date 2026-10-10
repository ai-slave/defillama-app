// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { dashboardModuleQuery } from '../dashboardTabs'
import { InvestorRelationsView } from '../InvestorRelationsView'
import { getDashboardModule } from '../registry'

// Real dashboard modules from the registry. Their data is out of scope here: every request answers 503,
// so a tab that fetches shows its own error state.
const fetchFixtures = installFixtureFetch()

const HYPERLIQUID = 'eobgdbgg0d0hake'
const SPARK = '9vn8xp43tdzo6gt'
const ODYSSEY = '0dyss3y3c0sys7m1'

describe('InvestorRelationsView', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	function element(dashboardId: string, activeTab?: string) {
		return (
			<QueryClientProvider client={client}>
				<InvestorRelationsView
					dashboardId={dashboardId}
					customOnly
					entityName="Entity"
					customServerData={{}}
					activeTab={activeTab}
				/>
			</QueryClientProvider>
		)
	}

	// A synchronous render commits before any dashboard module import can settle, so the test sees the loading state.
	function renderNow(dashboardId: string, activeTab?: string) {
		act(() => root.render(element(dashboardId, activeTab)))
	}

	async function render(dashboardId: string, activeTab?: string) {
		renderNow(dashboardId, activeTab)
		await settle()
	}

	// Headers and tab components load lazily, then fetch: wait until both are on screen and nothing is fetching,
	// so no lazy load lands outside act after the test.
	async function settle() {
		await waitForUi(() => {
			expect(client.isFetching()).toBe(0)
			expect(container.querySelector('header')).not.toBeNull()
			expect(container.querySelector('[role="tabpanel"]')?.childElementCount ?? 1).toBeGreaterThan(0)
		})
	}

	function tabButtons() {
		return Array.from(container.querySelectorAll('[role="tab"]'), (node) => node.textContent?.trim())
	}

	function selectedTab() {
		return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null
	}

	/** The name of the tab the open panel is labelled by. */
	function panelLabel() {
		const panel = container.querySelector('[role="tabpanel"]')!
		return container.querySelector(`#${CSS.escape(panel.getAttribute('aria-labelledby')!)}`)?.textContent?.trim()
	}

	/** The heading a dashboard without its own header shows for the open tab. */
	function openTabHeading() {
		return container.querySelector('h1')?.textContent ?? null
	}

	async function clickTab(label: string) {
		const button = Array.from(container.querySelectorAll('[role="tab"]')).find((b) => b.textContent?.trim() === label)
		expect(button, `tab ${label}`).toBeDefined()
		await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	beforeEach(() => {
		fetchFixtures.serve({ http: fixtureStatus(503) })
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	})

	test('a dashboard switch hides the old tabs while the new module loads, then starts from its first tab', async () => {
		// A Hyperliquid tab id that Spark has too, but not first: a selection kept across the switch would open it.
		const [hyperliquid, spark] = await Promise.all([getDashboardModule(HYPERLIQUID), getDashboardModule(SPARK)])
		const shared = hyperliquid.tabs.find((tab) => spark.tabs.findIndex((other) => other.id === tab.id) > 0)
		expect(shared, 'a tab id both dashboards have').toBeDefined()

		renderNow(HYPERLIQUID)
		expect(tabButtons()).toEqual([])
		await settle()
		expect(selectedTab()).toBe(tabButtons()[0])

		const other = tabButtons().find((label) => label !== shared.label)!
		await clickTab(other)
		expect(selectedTab()).toBe(other)
		expect(panelLabel()).toBe(other)
		await clickTab(shared.label)
		expect(selectedTab()).toBe(shared.label)

		// Switching dashboards must not show Hyperliquid's tabs under Spark's name while Spark loads.
		renderNow(SPARK)
		expect(tabButtons()).toEqual([])
		expect(container.querySelector('[role="tabpanel"]')).toBeNull()

		await settle()
		expect(tabButtons()).not.toEqual([])
		expect(selectedTab()).toBe(tabButtons()[0])
		expect(panelLabel()).toBe(tabButtons()[0])
	})

	test('an external tab is a link beside the tab list, not a tab', async () => {
		const odyssey = await getDashboardModule(ODYSSEY)
		const external = odyssey.tabs.find((tab) => tab.externalHref)
		expect(external, 'an external tab').toBeDefined()

		await render(ODYSSEY)
		expect(container.querySelector('[role="tablist"]')).not.toBeNull()
		expect(tabButtons()).not.toContain(external.label)
		const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === external.label)!
		expect(link.getAttribute('href')).toBe(external.externalHref)
		expect(link.closest('[role="tablist"]')).toBeNull()
	})

	test('a dashboard whose module fails to load says so instead of loading forever', async () => {
		// The registry's imports cannot fail in tests, so the cache starts with the failed load a rejected import
		// leaves behind. Without retryOnMount: false the mount would refetch and load the real module.
		const query = dashboardModuleQuery(SPARK)
		client.setQueryDefaults(query.queryKey, { retryOnMount: false })
		await client.prefetchQuery({ ...query, queryFn: () => Promise.reject(new Error('ChunkLoadError')) })

		renderNow(SPARK)
		expect(container.querySelector('[role="alert"]')?.textContent).toBe("Couldn't load this dashboard.")
		expect(Array.from(container.querySelectorAll('button'), accessibleName)).toContain('Try again')
		expect(tabButtons()).toEqual([])
	})

	test('a controlled active tab hides the tab strip and drives the content', async () => {
		await render(HYPERLIQUID, 'reports')
		expect(tabButtons()).toEqual([])
		// The route nav above picks the tab, so the content is not a tab panel.
		expect(container.querySelector('[role="tabpanel"]')).toBeNull()
		expect(openTabHeading()).toBe('Reports')

		await render(HYPERLIQUID, 'investor-calls')
		expect(openTabHeading()).toBe('Investor Calls')
	})
})
