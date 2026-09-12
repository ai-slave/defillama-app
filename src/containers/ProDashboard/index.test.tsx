// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ProDashboard from '.'
import type { DashboardItemConfig } from './dashboardItemConfig'

const mocks = vi.hoisted(() => ({
	items: [] as Array<DashboardItemConfig>,
	mode: 'view' as 'view' | 'edit',
	authenticated: false,
	dashboardId: 'fixture',
	undo: vi.fn(),
	refresh: vi.fn(),
	progress: { active: 0, failed: 0, total: 0, bulk: false }
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: mocks.authenticated,
		hasActiveSubscription: false,
		authorizedFetch: vi.fn(),
		user: mocks.authenticated ? { id: 'owner' } : undefined
	})
}))
vi.mock('~/containers/Authors/api', () => ({ getMyDashboardAuthorProfile: async () => null }))
vi.mock('next/router', () => ({ useRouter: () => ({ events: { on: vi.fn(), off: vi.fn() } }) }))
vi.mock('./hooks/useFreeTierStatus', () => ({ useFreeTierStatus: () => ({ canCreateDashboard: true }) }))
vi.mock('./AppMetadataContext', () => ({ AppMetadataProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('./ProDashboardAPIContext', () => ({
	useDashboardMode: () => mocks.mode,
	useProDashboardItemsState: () => ({ items: mocks.items }),
	useProDashboardCatalog: () => ({ protocolsLoading: false }),
	useProDashboardPermissions: () => ({ isReadOnly: mocks.mode === 'view' }),
	useProDashboardSave: () => ({ queued: null, state: undefined, saving: false, retry: vi.fn() }),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardDashboard: () => ({
		dashboardName: 'Fixture',
		dashboardId: mocks.dashboardId,
		currentDashboard: mocks.authenticated ? { id: mocks.dashboardId, user: 'owner' } : undefined,
		dashboardVisibility: 'public',
		dashboardTags: [],
		getCurrentRatingSession: () => null,
		canUndo: true,
		undoAIGeneration: mocks.undo
	}),
	useProDashboardUI: () => ({})
}))
vi.mock('./components/SqlChart/sqlRefreshBus', () => ({
	getInitialSqlRefreshProgress: () => mocks.progress,
	getSqlRefreshProgress: () => mocks.progress,
	subscribeSqlRefreshProgress: () => () => {},
	refreshAllSqlCharts: mocks.refresh
}))
vi.mock('./components/ChartGrid', () => ({ ChartGrid: () => null }))
vi.mock('./components/CopyDashboardLinkButton', () => ({ CopyDashboardLinkButton: () => null }))
vi.mock('./components/LikeDashboardButton', () => ({ LikeDashboardButton: () => null }))
vi.mock('./components/CustomTimePeriodPicker', () => ({ CustomTimePeriodPicker: () => null }))
vi.mock('./components/DashboardSettingsModal', () => ({ DashboardSettingsModal: () => null }))
vi.mock('./components/CreateDashboardPicker', () => ({ CreateDashboardPicker: () => null }))
vi.mock('./components/GenerateDashboardModal', () => ({ GenerateDashboardModal: () => null }))
vi.mock('./components/AddChartModal/AddChartModal', () => ({ AddChartModal: () => null }))
vi.mock('./components/DashboardPaywallModal', () => ({ DashboardPaywallModal: () => null }))
vi.mock('./components/EmptyState', () => ({ EmptyState: () => null }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.mode = 'view'
	mocks.authenticated = false
	mocks.dashboardId = 'fixture'
	mocks.undo.mockClear()
	mocks.refresh.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function renderDashboard() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ProDashboard />
			</QueryClientProvider>
		)
	)
}
function button(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}

test.each(['income-statement', 'unlocks-pie'] as const)(
	'refreshes SQL alongside %s without an irrelevant period strip',
	async (kind) => {
		mocks.items = [{ kind: 'sql' }, { kind }] as Array<DashboardItemConfig>
		await renderDashboard()
		expect(button('30d')).toBeUndefined()
		expect(button('Actions')).toBeUndefined()
		expect(button('Refresh all SQL')).toBeDefined()
		await act(async () => button('Refresh all SQL')!.click())
		expect(mocks.refresh).toHaveBeenCalledOnce()
	}
)
test('a view without SQL or period charts has no toolbar', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	await renderDashboard()
	expect(button('Refresh all SQL')).toBeUndefined()
	expect(button('30d')).toBeUndefined()
	expect(button('Actions')).toBeUndefined()
})

test('owner view keeps edit and copy actions distinct across dashboard and mode changes', async () => {
	const errors = vi.spyOn(console, 'error')
	try {
		mocks.authenticated = true
		mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
		await renderDashboard()
		expect(button('Edit')?.textContent?.trim()).toBe('Edit')
		expect(button('Copy Dashboard')?.textContent?.trim()).toBe('Copy Dashboard')
		mocks.dashboardId = 'another-dashboard'
		await renderDashboard()
		expect(button('Edit')?.textContent?.trim()).toBe('Edit')
		expect(button('Copy Dashboard')?.textContent?.trim()).toBe('Copy Dashboard')
		mocks.mode = 'edit'
		await renderDashboard()
		expect(button('Done')?.textContent?.trim()).toBe('Done')
		expect(button('Edit')).toBeUndefined()
		expect(button('Copy Dashboard')).toBeUndefined()
		expect(errors.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([])
	} finally {
		errors.mockRestore()
	}
})
test('mobile editor actions close the sheet and run the selected action', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	await act(async () => button('Actions')!.click())
	const dialog = document.body.querySelector('[role="dialog"]')!
	expect(
		Array.from(dialog.querySelectorAll('button'))
			.map((node) => node.textContent?.trim())
			.filter(Boolean)
	).toEqual(['Add Item', 'Edit with LlamaAI', 'Undo', 'Settings'])
	await act(async () =>
		Array.from(dialog.querySelectorAll('button'))
			.find((node) => node.textContent?.trim() === 'Undo')!
			.click()
	)
	expect(mocks.undo).toHaveBeenCalledOnce()
	expect(document.body.querySelector('[role="dialog"]')).toBeNull()
})
