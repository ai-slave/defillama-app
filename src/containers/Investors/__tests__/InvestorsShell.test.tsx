// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { InvestorsSiteId } from '../config'
import { InvestorsSiteProvider } from '../SiteContext'

// The registry is the dynamic-import seam: the real one loads every project's dashboard bundle.
// Each fixture module has an Overview and a Metrics tab that name their project.
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

	function render(siteId: InvestorsSiteId) {
		return act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<InvestorsSiteProvider siteId={siteId}>
						<InvestorsDashboard />
					</InvestorsSiteProvider>
				</QueryClientProvider>
			)
		)
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

		await click('Metrics')
		expect(shownContent()).toBe('Spark Metrics')
		expect(scroll).toHaveBeenCalledTimes(1)
		// The open tab is already on screen, so it does not scroll.
		await click('Metrics')
		expect(scroll).toHaveBeenCalledTimes(1)

		await click('NEAR')
		expect(shownContent()).toBe('NEAR Overview')
		expect(scroll).toHaveBeenCalledTimes(2)
	})
})
