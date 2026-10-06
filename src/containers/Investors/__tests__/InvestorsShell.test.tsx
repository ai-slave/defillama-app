// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { InvestorsSiteId } from '../config'
import InvestorsDashboard from '../index'
import { InvestorsSiteProvider } from '../SiteContext'

// Real dashboard modules from the registry. Their data is out of scope here: every request answers 503,
// so a tab that fetches shows its own error state.
const fetchFixtures = installFixtureFetch()

describe('standalone IR shell', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	async function render(siteId: InvestorsSiteId) {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<InvestorsSiteProvider siteId={siteId}>
						<InvestorsDashboard />
					</InvestorsSiteProvider>
				</QueryClientProvider>
			)
		)
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

	function navButtons() {
		return Array.from(container.querySelectorAll('nav button'), (button) => button.textContent)
	}

	async function click(label: string) {
		const button = Array.from(container.querySelectorAll('nav button')).find((node) => node.textContent === label)
		expect(button, `nav button ${label}`).toBeDefined()
		await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		await settle()
	}

	function selectedTab() {
		return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null
	}

	function panelText() {
		return container.querySelector('[role="tabpanel"]')?.textContent ?? null
	}

	beforeEach(() => {
		fetchFixtures.serve({ http: fixtureStatus(503) })
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
		vi.restoreAllMocks()
	})

	test('lists each site’s own projects and none of the other site’s', async () => {
		await render('investors')
		expect(navButtons()).toContain('Spark')
		expect(navButtons()).not.toContain('Odyssey Ecosystem')
		await render('enterprise')
		expect(navButtons()).toContain('Odyssey Ecosystem')
		expect(navButtons()).not.toContain('Spark')
		expect(selectedTab()).toBe('TVL')
	})

	test('a tab or project switch shows its content from the top of the page, and a project starts at its first tab', async () => {
		const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
		await render('investors')
		expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-orientation')).toBe('vertical')
		expect(selectedTab()).toBe('Financials')
		expect(panelText()).toBe("Couldn't load Spark financials.")

		await click('Distribution Rewards')
		expect(selectedTab()).toBe('Distribution Rewards')
		expect(scroll).toHaveBeenCalledTimes(1)
		// The open tab is already on screen, so it does not scroll.
		await click('Distribution Rewards')
		expect(scroll).toHaveBeenCalledTimes(1)

		// THORChain also has a Financials tab, so a kept selection would open it there.
		await click('Financials')
		await click('THORChain')
		expect(selectedTab()).toBe('Overview')
		expect(scroll).toHaveBeenCalledTimes(3)
	})

	test('the open project collapses and expands its tab list', async () => {
		await render('investors')
		const spark = () =>
			Array.from(container.querySelectorAll('nav button')).find((node) => node.textContent === 'Spark')!
		expect(spark().getAttribute('aria-expanded')).toBe('true')

		await click('Spark')
		expect(spark().getAttribute('aria-expanded')).toBe('false')
		expect(container.querySelector('[role="tab"]')).toBeNull()
		// Collapsing the list keeps the open tab on screen.
		expect(panelText()).toBe("Couldn't load Spark financials.")

		await click('Spark')
		expect(selectedTab()).toBe('Financials')
	})
})
