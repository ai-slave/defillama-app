// @vitest-environment happy-dom

import { useDialogStore } from '@ariakit/react'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import HomePage from '~/pages/pro'

const mocks = vi.hoisted(() => ({
	router: { pathname: '/pro', query: {} as Record<string, string | Array<string>>, replace: vi.fn(), isReady: true },
	authenticated: true,
	useMyDashboards: vi.fn(() => ({ dashboards: [], isLoading: false, totalPages: 0, totalItems: 0 }))
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: mocks.authenticated,
		hasActiveSubscription: true,
		loaders: { userLoading: false }
	})
}))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/AppMetadataContext', () => ({
	AppMetadataProvider: ({ children }: { children: ReactNode }) => children
}))
vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: ({ children }: { children: ReactNode }) => children,
	useProDashboardDashboard: () => ({}),
	useProDashboardUI: () => ({ createDashboardDialogStore: useDialogStore(), showGenerateDashboardModal: false })
}))
vi.mock('~/containers/ProDashboard/hooks/useFreeTierStatus', () => ({
	useFreeTierStatus: () => ({ canCreateDashboard: true })
}))
vi.mock('~/containers/ProDashboard/hooks/useMyDashboards', () => ({
	useMyDashboards: mocks.useMyDashboards
}))
vi.mock('~/containers/ProDashboard/components/DashboardDiscovery', () => ({
	DashboardDiscovery: () => <input aria-label="Discovery filter" />
}))
vi.mock('~/containers/ProDashboard/components/AuthorProfileStrip', () => ({
	AuthorProfileStrip: () => <div>Author</div>
}))
vi.mock('~/containers/ProDashboard/components/DashboardList', () => ({ DashboardList: () => null }))
vi.mock('~/containers/ProDashboard/components/FollowingShelves', () => ({
	FollowingShelves: () => <input aria-label="Following filter" />
}))
vi.mock('~/containers/ProDashboard/components/LikedDashboards', () => ({
	LikedDashboards: () => <input aria-label="Favorites filter" />
}))
vi.mock('~/containers/ProDashboard/components/MyProfileTab', () => ({
	MyProfileTab: () => <input aria-label="Profile draft" />
}))
vi.mock('~/containers/ProDashboard/components/CreateDashboardPicker', () => ({ CreateDashboardPicker: () => null }))
vi.mock('~/containers/ProDashboard/components/GenerateDashboardModal', () => ({ GenerateDashboardModal: () => null }))
vi.mock('~/containers/ProDashboard/components/DashboardPaywallModal', () => ({ DashboardPaywallModal: () => null }))
vi.mock('~/containers/ProDashboard/components/ProDashboardLoader', () => ({ ProDashboardLoader: () => null }))
vi.mock('~/containers/ProDashboard/services/DashboardAPI', () => ({ dashboardAPI: {} }))
vi.mock('~/utils/telemetry', () => ({ withServerSidePropsTelemetry: vi.fn() }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.authenticated = true
	mocks.router.query = {}
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render() {
	await act(async () => root.render(<HomePage initialDiscoveryCategories={{}} />))
}
function tabs() {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
}
function panel(tab: HTMLButtonElement) {
	return document.getElementById(tab.getAttribute('aria-controls')!)!
}
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

test('arrows only focus; activation replaces the URL once without mounting Profile early', async () => {
	mocks.router.query = { tab: 'discover', page: '3' }
	await render()
	const [discover, mine, , , profile] = tabs()
	expect(mocks.router.replace).not.toHaveBeenCalled()
	await press(discover, 'ArrowRight')
	expect(document.activeElement).toBe(mine)
	await press(mine, 'End')
	expect(document.activeElement).toBe(profile)
	expect(container.querySelector('[aria-label="Profile draft"]')).toBeNull()
	expect(mocks.router.replace).not.toHaveBeenCalled()
	await press(profile, 'Enter')
	expect(mocks.router.replace.mock.calls).toEqual([
		[{ pathname: '/pro', query: { tab: 'profile' } }, undefined, { shallow: true, scroll: false }]
	])
	mocks.router.query = { tab: 'profile' }
	await render()
	expect(panel(profile).getAttribute('aria-labelledby')).toBe(profile.id)
	expect(panel(profile).hidden).toBe(false)
	expect(panel(discover).hidden).toBe(true)
	expect(document.activeElement).toBe(profile)
	await press(profile, 'Home')
	expect(document.activeElement).toBe(discover)
	mocks.router.replace.mockClear()
	await press(discover, ' ')
	expect(mocks.router.replace).toHaveBeenCalledOnce()
})

test('URL changes retain dashboard panel state but unmount Profile when leaving it', async () => {
	await render()
	const discovery = container.querySelector<HTMLInputElement>('[aria-label="Discovery filter"]')!
	const favorites = container.querySelector<HTMLInputElement>('[aria-label="Favorites filter"]')!
	discovery.value = 'retained search'
	favorites.value = 'retained favorites'
	const visit = async (tab: string) => {
		mocks.router.query = { tab }
		await render()
		expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	}
	await visit('favorites')
	await visit('following')
	await visit('my-dashboards')
	await visit('profile')
	await visit('discover')
	expect(container.querySelector('[aria-label="Discovery filter"]')).toBe(discovery)
	expect(discovery.value).toBe('retained search')
	expect(container.querySelector('[aria-label="Favorites filter"]')).toBe(favorites)
	expect(favorites.value).toBe('retained favorites')
	expect(container.querySelector('[aria-label="Profile draft"]')).toBeNull()
	expect(mocks.router.replace).not.toHaveBeenCalled()
})

test('signed-out private links show Discover and restore the requested view after sign-in', async () => {
	mocks.authenticated = false
	mocks.router.query = { tab: 'favorites' }
	await render()
	expect(tabs()).toHaveLength(1)
	expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
	expect(panel(tabs()[0]).hidden).toBe(false)
	expect(container.querySelector('[aria-label="Favorites filter"]')).toBeNull()
	mocks.authenticated = true
	await render()
	expect(tabs()[2].getAttribute('aria-selected')).toBe('true')
	expect(panel(tabs()[2]).hidden).toBe(false)
	mocks.authenticated = false
	await render()
	expect(tabs()).toHaveLength(1)
	expect(tabs()[0].tabIndex).toBe(0)
	expect(panel(tabs()[0]).hidden).toBe(false)
	expect(mocks.router.replace).not.toHaveBeenCalled()
})

test.each(['unknown', ['favorites', 'profile']])(
	'invalid query %j shows Discover without rewriting history',
	async (tab) => {
		mocks.router.query = { tab }
		await render()
		expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
		expect(panel(tabs()[0]).hidden).toBe(false)
		expect(mocks.router.replace).not.toHaveBeenCalled()
	}
)

test('typing a query switches the hook to a single 100-item page', async () => {
	mocks.router.query = { tab: 'my-dashboards', page: '3' }
	await render()
	expect(mocks.useMyDashboards).toHaveBeenLastCalledWith({ page: 3, limit: 20, enabled: true })
	const search = container.querySelector<HTMLInputElement>('[aria-label="Search my dashboards"]')!
	await act(async () => {
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		setValue.call(search, 'audit')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(mocks.useMyDashboards).toHaveBeenLastCalledWith({ page: 3, limit: 20, enabled: true })
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 250))
	})
	expect(mocks.useMyDashboards).toHaveBeenLastCalledWith({ page: 1, limit: 100, enabled: true })
	expect(mocks.router.replace).not.toHaveBeenCalled()
})
