// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { DashboardTabConfig } from '../dashboardTypes'
import { InvestorRelationsView } from '../InvestorRelationsView'

const { modules, registerModule } = vi.hoisted(() => {
	type Loaded = { tabs: Array<{ id: string; label: string }> }
	const modules: Record<string, { promise: Promise<Loaded>; resolve: (m: Loaded) => void }> = {}
	function registerModule(id: string) {
		let resolve!: (m: Loaded) => void
		const promise = new Promise<Loaded>((r) => {
			resolve = r
		})
		modules[id] = { promise, resolve }
	}
	return { modules, registerModule }
})

vi.mock('../registry', () => ({
	getDashboardModule: (id: string) => modules[id]?.promise ?? null,
	isDashboardRegistered: (id: string) => id in modules
}))
vi.mock('../DashboardTabsContent', () => ({
	DEFAULT_TABS: [{ id: 'dashboard', label: 'Overview' }],
	SkeletonTable: () => <div data-testid="skeleton" />,
	TabLabel: ({ tab }: { tab: DashboardTabConfig }) => <>{tab.label}</>,
	InvestorsContent: ({ activeTab }: { activeTab: string }) => <div data-testid="content">{activeTab}</div>,
	CustomOnlyContent: ({ activeTab }: { activeTab: string }) => <div data-testid="content">{activeTab}</div>
}))
vi.mock('~/containers/ProDashboard/AppMetadataContext', () => ({
	AppMetadataProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}))

describe('InvestorRelationsView', () => {
	let container: HTMLDivElement
	let root: Root

	function render(dashboardId: string) {
		return act(async () => {
			root.render(
				<InvestorRelationsView dashboardId={dashboardId} customOnly={false} entityName="Entity" customServerData={{}} />
			)
		})
	}

	function tabButtons() {
		return Array.from(container.querySelectorAll('button'), (b) => b.textContent?.trim())
	}

	function activeContent() {
		return container.querySelector('[data-testid="content"]')?.textContent
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		for (const key of Object.keys(modules)) delete modules[key]
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('an unregistered dashboard shows the default tabs immediately', async () => {
		await render('unknown')
		expect(container.querySelector('[data-testid="skeleton"]')).toBeNull()
		expect(activeContent()).toBe('dashboard')
	})

	test('a dashboard switch shows the skeleton, then the new tabs, and starts from their first tab', async () => {
		registerModule('a')
		registerModule('b')
		await render('a')
		expect(container.querySelector('[data-testid="skeleton"]')).not.toBeNull()

		await act(async () =>
			modules.a.resolve({
				tabs: [
					{ id: 'a-1', label: 'A one' },
					{ id: 'a-2', label: 'A two' }
				]
			})
		)
		expect(tabButtons()).toEqual(['A one', 'A two'])
		const second = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'A two')!
		await act(async () => second.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(activeContent()).toBe('a-2')

		// Switching dashboards must not show A's tabs under B's name while B loads.
		await render('b')
		expect(container.querySelector('[data-testid="skeleton"]')).not.toBeNull()
		expect(tabButtons()).toEqual([])

		await act(async () => modules.b.resolve({ tabs: [{ id: 'b-1', label: 'B one' }] }))
		expect(tabButtons()).toEqual(['B one'])
		expect(activeContent()).toBe('b-1')
	})

	test('a module that resolves after the dashboard changed is ignored', async () => {
		registerModule('a')
		registerModule('b')
		await render('a')
		await render('b')
		await act(async () => modules.a.resolve({ tabs: [{ id: 'a-1', label: 'A one' }] }))
		expect(container.querySelector('[data-testid="skeleton"]')).not.toBeNull()

		await act(async () => modules.b.resolve({ tabs: [{ id: 'b-1', label: 'B one' }] }))
		expect(tabButtons()).toEqual(['B one'])
	})
})
