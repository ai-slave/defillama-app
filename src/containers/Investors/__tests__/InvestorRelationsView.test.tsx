// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { dashboardModuleQuery } from '../dashboardTabs'
import type { DashboardModule } from '../dashboardTypes'
import { InvestorRelationsView } from '../InvestorRelationsView'

// The registry is the dynamic-import seam: the real one loads whole dashboard bundles, and these
// tests need to decide when each module finishes loading to reproduce the dashboard-switch race.
const { modules } = vi.hoisted(() => ({
	modules: {} as Record<
		string,
		{ promise: Promise<DashboardModule>; resolve: (m: DashboardModule) => void; reject: (error: Error) => void }
	>
}))
vi.mock('../registry', () => ({
	getDashboardModule: (id: string) => modules[id]?.promise ?? null,
	isDashboardRegistered: (id: string) => id in modules
}))
// Heavy child: the chart grid renders only on a ProDashboard tab, which these tests never open.
vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({ ChartGrid: () => null }))

function registerModule(id: string) {
	let resolve!: (m: DashboardModule) => void
	let reject!: (error: Error) => void
	const promise = new Promise<DashboardModule>((onResolve, onReject) => {
		resolve = onResolve
		reject = onReject
	})
	modules[id] = { promise, resolve, reject }
}

function tab(id: string, label: string) {
	return { id, label, component: () => <p>{`${label} content`}</p> }
}

describe('InvestorRelationsView', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	function render(dashboardId: string, activeTab?: string) {
		return act(async () => {
			root.render(
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
		})
	}

	// The component hears about a settled module on a later task, so wait until that module stops loading.
	async function resolveModule(id: string, module: DashboardModule) {
		await act(async () => modules[id].resolve(module))
		await waitForUi(() => expect(client.isFetching({ queryKey: dashboardModuleQuery(id).queryKey })).toBe(0))
	}

	function tabButtons() {
		return Array.from(container.querySelectorAll('button'), (b) => b.textContent?.trim())
	}

	function shownContent() {
		return container.querySelector('p')?.textContent ?? null
	}

	async function clickTab(label: string) {
		const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
		expect(button, `tab ${label}`).toBeDefined()
		await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		client = new QueryClient()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		for (const key of Object.keys(modules)) delete modules[key]
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	})

	test('a dashboard switch hides the old tabs while the new module loads, then starts from its first tab', async () => {
		registerModule('a')
		registerModule('b')
		await render('a')
		expect(tabButtons()).toEqual([])

		// Both dashboards have a tab with the same id, so a kept selection would open B two.
		await resolveModule('a', { tabs: [tab('a-1', 'A one'), tab('shared', 'A two')] })
		expect(tabButtons()).toEqual(['A one', 'A two'])
		expect(shownContent()).toBe('A one content')
		await clickTab('A two')
		expect(shownContent()).toBe('A two content')

		// Switching dashboards must not show A's tabs under B's name while B loads.
		await render('b')
		expect(tabButtons()).toEqual([])
		expect(shownContent()).toBeNull()

		await resolveModule('b', { tabs: [tab('b-1', 'B one'), tab('shared', 'B two')] })
		expect(tabButtons()).toEqual(['B one', 'B two'])
		expect(shownContent()).toBe('B one content')
	})

	test('a controlled active tab hides the pill strip and drives the content', async () => {
		registerModule('a')
		await render('a', 'a-2')
		await resolveModule('a', { tabs: [tab('a-1', 'A one'), tab('a-2', 'A two')] })
		expect(tabButtons()).toEqual([])
		expect(shownContent()).toBe('A two content')

		await render('a', 'a-1')
		expect(shownContent()).toBe('A one content')
	})

	test('a module that resolves after the dashboard changed is ignored', async () => {
		registerModule('a')
		registerModule('b')
		await render('a')
		await render('b')
		expect(tabButtons()).toEqual([])
		expect(shownContent()).toBeNull()

		await resolveModule('b', { tabs: [tab('b-1', 'B one')] })
		expect(tabButtons()).toEqual(['B one'])
		expect(shownContent()).toBe('B one content')

		// A's module finishing last must not replace B's tabs.
		await resolveModule('a', { tabs: [tab('a-1', 'A one')] })
		expect(tabButtons()).toEqual(['B one'])
		expect(shownContent()).toBe('B one content')
	})

	test('a dashboard whose module fails to load says so instead of loading forever', async () => {
		client.setDefaultOptions({ queries: { retry: false } })
		registerModule('a')
		await render('a')
		await act(async () => modules.a.reject(new Error('ChunkLoadError')))
		await waitForUi(() =>
			expect(container.querySelector('[role="alert"]')?.textContent).toBe(
				"Couldn't load this dashboard. Reload the page to try again."
			)
		)
	})
})
