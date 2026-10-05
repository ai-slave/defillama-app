// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { InvestorsSiteId } from '../config'
import { InvestorsSiteProvider } from '../SiteContext'

// The registry is the dynamic-import seam: the real one loads every project's dashboard bundle.
// Each fixture module has an Overview and a Metrics tab that name their project.
// Projects named here fail to load, as a chunk does right after a deploy.
const { failing } = vi.hoisted(() => ({ failing: new Set<string>() }))
vi.mock('../registry', async () => {
	const { ALL_INVESTORS_PROJECTS } = await import('../config')
	const tab = (id: string, label: string, project: string) => ({
		id,
		label,
		component: () => <p>{`${project} ${label}`}</p>
	})
	return {
		getDashboardModule: async (dashboardId: string) => {
			const project = ALL_INVESTORS_PROJECTS.find((p) => p.dashboardId === dashboardId)!.name
			if (failing.has(project)) throw new Error('ChunkLoadError')
			return { tabs: [tab('overview', 'Overview', project), tab('metrics', 'Metrics', project)] }
		}
	}
})
// Heavy child: the chart grid renders only on a ProDashboard tab, which these fixture modules do not have.
vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({ ChartGrid: () => null }))

import InvestorsDashboard from '../index'

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
		// The shell hears about the loaded modules on a later task, so wait until nothing is loading.
		await waitForUi(() => expect(client.isFetching()).toBe(0))
	}

	function navButtons() {
		return Array.from(container.querySelectorAll('nav button'), (button) => button.textContent)
	}

	async function click(label: string) {
		const button = Array.from(container.querySelectorAll('nav button')).find((node) => node.textContent === label)
		expect(button, `nav button ${label}`).toBeDefined()
		await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	function shownContent() {
		return container.querySelector('p')?.textContent ?? null
	}

	function selectedTab() {
		return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null
	}

	beforeEach(() => {
		client = new QueryClient()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
		failing.clear()
		vi.restoreAllMocks()
	})

	test('lists each site’s own projects and none of the other site’s', async () => {
		await render('investors')
		expect(navButtons()).toContain('Spark')
		expect(navButtons()).not.toContain('Odyssey Ecosystem')
		await render('enterprise')
		expect(navButtons()).toContain('Odyssey Ecosystem')
		expect(navButtons()).not.toContain('Spark')
		expect(shownContent()).toBe('Odyssey Ecosystem Overview')
	})

	test('a tab or project switch shows its content from the top of the page, and a project starts at its first tab', async () => {
		const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
		await render('investors')
		expect(shownContent()).toBe('Spark Overview')
		expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-orientation')).toBe('vertical')
		expect(selectedTab()).toBe('Overview')

		await click('Metrics')
		expect(selectedTab()).toBe('Metrics')
		expect(container.querySelector('[role="tabpanel"] p')?.textContent).toBe('Spark Metrics')
		expect(scroll).toHaveBeenCalledTimes(1)
		// The open tab is already on screen, so it does not scroll.
		await click('Metrics')
		expect(scroll).toHaveBeenCalledTimes(1)

		await click('NEAR')
		expect(shownContent()).toBe('NEAR Overview')
		expect(selectedTab()).toBe('Overview')
		expect(scroll).toHaveBeenCalledTimes(2)
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
		expect(shownContent()).toBe('Spark Overview')

		await click('Spark')
		expect(selectedTab()).toBe('Overview')
	})

	test('a project whose dashboard fails to load says so instead of an empty page', async () => {
		client.setDefaultOptions({ queries: { retry: false } })
		failing.add('Spark')
		await render('investors')
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't load this dashboard. Reload the page to try again."
		)
		await click('NEAR')
		expect(shownContent()).toBe('NEAR Overview')
	})
})
