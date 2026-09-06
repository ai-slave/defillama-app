// @vitest-environment happy-dom

import { act, type ReactNode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const events = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }))

vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({
	ChartGrid: () => <div data-testid="chart-grid" />
}))

vi.mock('~/containers/ProDashboard/components/EmptyState', () => ({
	EmptyState: () => <div data-testid="empty-state" />
}))

vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: ({ children }: { children: ReactNode }) => (
		<div data-testid="dashboard-provider">{children}</div>
	),
	useProDashboardCatalog: () => ({ protocolsLoading: false }),
	useProDashboardDashboard: () => ({ currentDashboard: { id: 'dashboard' }, isLoadingDashboard: false }),
	useProDashboardItemsState: () => ({ items: [{ id: 'chart' }] })
}))

import { CustomOnlyContent, InvestorsContent } from './DashboardTabsContent'
import type { DashboardTabConfig } from './dashboardTypes'

function CustomTab({ label }: { label: string }) {
	useEffect(() => {
		events.mount(label)
		return () => events.unmount(label)
	}, [label])
	return <div data-testid={`custom-${label}`}>{label}</div>
}

const FIRST_TAB = () => <CustomTab label="first" />
const SECOND_TAB = () => <CustomTab label="second" />

const INVESTOR_TABS: Array<DashboardTabConfig> = [
	{ id: 'dashboard', label: 'Overview' },
	{ id: 'first', label: 'First', component: FIRST_TAB },
	{ id: 'second', label: 'Second', component: SECOND_TAB }
]

describe('DashboardTabsContent', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('unmounts an inactive investor dashboard tab instead of keeping it hidden', async () => {
		await act(async () =>
			root.render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="dashboard"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		expect(container.querySelector('[data-testid="dashboard-provider"]')).not.toBeNull()

		await act(async () =>
			root.render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="first"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		expect(container.querySelector('[data-testid="dashboard-provider"]')).toBeNull()
		expect(container.querySelector('[data-testid="custom-first"]')).not.toBeNull()

		await act(async () =>
			root.render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="second"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		expect(container.querySelector('[data-testid="custom-first"]')).toBeNull()
		expect(container.querySelector('[data-testid="custom-second"]')).not.toBeNull()
		expect(events.unmount).toHaveBeenCalledWith('first')
	})

	test('unmounts custom-only Pro dashboard tabs when a component tab becomes active', async () => {
		const tabs: Array<DashboardTabConfig> = [
			{ id: 'pro', label: 'Pro', proDashboardId: 'pro-dashboard' },
			{ id: 'first', label: 'First', component: FIRST_TAB }
		]

		await act(async () =>
			root.render(<CustomOnlyContent tabs={tabs} activeTab="pro" displayName="Investor" hideDuplicateButton />)
		)
		expect(container.querySelector('[data-testid="dashboard-provider"]')).not.toBeNull()

		await act(async () =>
			root.render(<CustomOnlyContent tabs={tabs} activeTab="first" displayName="Investor" hideDuplicateButton />)
		)
		expect(container.querySelector('[data-testid="dashboard-provider"]')).toBeNull()
		expect(container.querySelector('[data-testid="custom-first"]')).not.toBeNull()
	})
})
