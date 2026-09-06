// @vitest-environment happy-dom

import { act, type ReactNode, useSyncExternalStore } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardInitialRenderPayload } from '~/containers/ProDashboard/initialDashboard'
import DashboardEditPage from '~/pages/pro/[dashboardId]/edit'

const mocks = vi.hoisted(() => {
	const signedOut = { isAuthenticated: false, user: null as { id: string } | null, loaders: { userLoading: false } }
	return {
		signedOut,
		session: { ...signedOut },
		listeners: new Set<() => void>(),
		router: { query: { dashboardId: 'test-dashboard' }, replace: vi.fn() }
	}
})
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('next/head', () => ({ default: () => null }))
vi.mock('~/auth', () => ({
	useAuthContext: () =>
		useSyncExternalStore(
			(listener) => {
				mocks.listeners.add(listener)
				return () => mocks.listeners.delete(listener)
			},
			() => mocks.session,
			() => mocks.signedOut
		)
}))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: ({ children }: { children: ReactNode }) => children,
	useProDashboardDashboard: () => ({
		isLoadingDashboard: false,
		streamHasResolved: true,
		currentDashboard: { user: 'owner', slug: 'test-dashboard' },
		dashboardName: 'Test dashboard'
	})
}))
vi.mock('~/containers/ProDashboard', () => ({ default: () => <input aria-label="Widget name" /> }))
vi.mock('~/containers/ProDashboard/components/ProDashboardLoader', () => ({
	ProDashboardLoader: () => <p role="status">Loading editor</p>
}))
vi.mock('~/containers/ProDashboard/queries.server', () => ({ fetchDashboardConfig: vi.fn() }))
vi.mock('~/containers/ProDashboard/server/auth', () => ({
	fetchAuthenticatedUserId: vi.fn(),
	getAuthTokenFromRequest: vi.fn()
}))
vi.mock('~/utils/telemetry', () => ({ withServerSidePropsTelemetry: vi.fn() }))

const initialDashboard: DashboardInitialRenderPayload = {
	id: 'dashboard-id',
	slug: 'test-dashboard',
	ownerId: 'owner',
	data: { dashboardName: 'Test dashboard', items: [] },
	visibility: 'private',
	created: '2026-09-06T00:00:00Z',
	updated: '2026-09-06T00:00:00Z'
}
let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.session = { isAuthenticated: true, user: { id: 'owner' }, loaders: { userLoading: false } }
	container = document.createElement('div')
	document.body.appendChild(container)
})
afterEach(async () => {
	await act(async () => root?.unmount())
	root = undefined
	container.remove()
})

async function hydrate() {
	const page = <DashboardEditPage dashboardId="test-dashboard" initialDashboard={initialDashboard} />
	container.innerHTML = renderToString(page)
	expect(container.textContent).toBe('Loading editor')
	const onRecoverableError = vi.fn()
	await act(async () => {
		root = hydrateRoot(container, page, { onRecoverableError })
	})
	expect(onRecoverableError).not.toHaveBeenCalled()
}

test('hydrates a seeded owner dashboard without redirecting the restored session', async () => {
	await hydrate()
	expect(container.querySelector('[aria-label="Widget name"]')).not.toBeNull()
	expect(mocks.router.replace).not.toHaveBeenCalled()
})

test('keeps the loader while client authentication is pending, then opens the editor', async () => {
	mocks.session = { ...mocks.session, loaders: { userLoading: true } }
	await hydrate()
	expect(container.textContent).toBe('Loading editor')
	expect(mocks.router.replace).not.toHaveBeenCalled()
	await act(async () => {
		mocks.session = { ...mocks.session, loaders: { userLoading: false } }
		for (const listener of mocks.listeners) listener()
	})
	expect(container.querySelector('[aria-label="Widget name"]')).not.toBeNull()
	expect(mocks.router.replace).not.toHaveBeenCalled()
})

test.each(['signed out', 'another account'])('redirects when the restored session is %s', async (session) => {
	mocks.session =
		session === 'signed out'
			? mocks.signedOut
			: { isAuthenticated: true, user: { id: 'other' }, loaders: { userLoading: false } }
	await hydrate()
	expect(mocks.router.replace).toHaveBeenCalledWith('/pro/test-dashboard')
})

test('still redirects when the owner signs out after hydration', async () => {
	await hydrate()
	await act(async () => {
		mocks.session = mocks.signedOut
		for (const listener of mocks.listeners) listener()
	})
	expect(mocks.router.replace).toHaveBeenCalledWith('/pro/test-dashboard')
})
