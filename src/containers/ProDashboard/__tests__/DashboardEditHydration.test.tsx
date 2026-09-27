// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import type { DashboardInitialRenderPayload } from '~/containers/ProDashboard/initialDashboard'
import DashboardPage from '~/pages/pro/[dashboardId]/[[...mode]]'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	query: { dashboardId: 'test-dashboard', mode: ['edit'] },
	asPath: '/pro/test-dashboard/edit',
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('next/head', () => ({ default: () => null }))
// Page chrome and the editor body are heavy children; these tests read the loader and redirect around them.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard', () => ({ default: () => null }))
// The page module also exports its server loader, whose queries open a database client at import.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

const session = installSubscriberSession('owner')

const initialDashboard: DashboardInitialRenderPayload = {
	id: 'dashboard-id',
	slug: 'test-dashboard',
	ownerId: 'owner',
	data: { dashboardName: 'Test dashboard', items: [] },
	visibility: 'private',
	created: '2026-09-06T00:00:00Z',
	updated: '2026-09-06T00:00:00Z'
}
const streamedDashboard = {
	id: 'dashboard-id',
	slug: 'test-dashboard',
	user: 'owner',
	visibility: 'private',
	data: { dashboardName: 'Test dashboard', items: [] },
	created: '2026-09-06T00:00:00Z',
	updated: '2026-09-06T00:00:00Z'
}

let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
	router.replace.mockReset()
	session.serve({
		'/api/dynamic/pro-dashboard/test-dashboard/stream': () =>
			new Response(`${JSON.stringify({ type: 'dashboard', data: streamedDashboard })}\n{"type":"done"}\n`),
		// The editor's catalogs and dashboard lists load behind the loader; this dashboard needs none of them.
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards/test-dashboard`]: streamedDashboard
	})
	container = document.createElement('div')
	document.body.appendChild(container)
})
afterEach(async () => {
	await act(async () => root?.unmount())
	root = undefined
	container.remove()
})

const showsEditorLoader = () => container.querySelector('h1')?.textContent === 'Edit dashboard'

async function hydrate() {
	const page = (
		<session.Wrapper>
			<DashboardPage
				dashboardId="test-dashboard"
				mode="edit"
				initialDashboard={initialDashboard}
				seo={null}
				ogImage={null}
				noIndex
				status={200}
			/>
		</session.Wrapper>
	)
	container.innerHTML = renderToString(page)
	expect(showsEditorLoader()).toBe(true)
	const onRecoverableError = vi.fn()
	await act(async () => {
		root = hydrateRoot(container, page, { onRecoverableError })
	})
	expect(onRecoverableError).not.toHaveBeenCalled()
}

test('hydrates a seeded owner dashboard without redirecting the restored session', async () => {
	await hydrate()
	await waitForUi(() => expect(showsEditorLoader()).toBe(false))
	expect(router.replace).not.toHaveBeenCalled()
})

test('keeps the loader while client authentication is pending, then opens the editor', async () => {
	// The session reads as loading until its subscription status answers.
	let answerSubscription: (response: Response) => void = () => {}
	session.serve({
		'/subscription/status': () =>
			new Promise<Response>((resolve) => {
				answerSubscription = resolve
			})
	})
	await hydrate()
	await waitForUi(() => expect(session.urls().some((url) => url.endsWith('/subscription/status'))).toBe(true))
	expect(showsEditorLoader()).toBe(true)
	expect(router.replace).not.toHaveBeenCalled()

	await act(async () =>
		answerSubscription(Response.json({ subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }))
	)
	await waitForUi(() => expect(showsEditorLoader()).toBe(false))
	expect(router.replace).not.toHaveBeenCalled()
})

test('redirects to the dashboard view when the owner signs out after hydration', async () => {
	await hydrate()
	await waitForUi(() => expect(showsEditorLoader()).toBe(false))
	await act(async () => pb.authStore.clear())
	expect(router.replace).toHaveBeenCalledWith('/pro/test-dashboard', undefined, { shallow: true })
})
