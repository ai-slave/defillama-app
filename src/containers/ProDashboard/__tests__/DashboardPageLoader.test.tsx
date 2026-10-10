// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { subscriptionStatusQueryKey } from '~/auth/subscriptionStatus'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import DashboardPage from '~/pages/pro/[dashboardId]/[[...mode]]'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	query: {} as Record<string, string>,
	asPath: '',
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('next/head', () => ({ default: () => null }))
// Page chrome and the dashboard body are heavy children; these tests read the loader and the states around them.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard', () => ({ default: () => <p>Dashboard body</p> }))
// The page module also exports its server loader, whose queries open a database client at import.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

const session = installSubscriberSession('owner', { resolved: true })
const privateDashboard = {
	id: 'dashboard-id',
	slug: 'private-dashboard',
	user: 'owner',
	visibility: 'private',
	data: { dashboardName: 'Private dashboard', items: [] },
	created: '2026-09-06T00:00:00Z',
	updated: '2026-09-06T00:00:00Z'
}

let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
	session.serve({
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards`]: { items: [] }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
})
afterEach(async () => {
	await act(async () => root?.unmount())
	root = undefined
	container.remove()
})

const heading = () => container.querySelector('h1')?.textContent ?? null

/** Server-renders a page without a server payload, as private and new dashboards arrive, then hydrates it. */
async function open(dashboardId: string) {
	router.query = { dashboardId }
	router.asPath = `/pro/${dashboardId}`
	const page = (
		<session.Wrapper>
			<DashboardPage
				dashboardId={dashboardId}
				mode="view"
				initialDashboard={null}
				seo={null}
				ogImage={null}
				noIndex
				status={200}
			/>
		</session.Wrapper>
	)
	container.innerHTML = renderToString(page)
	const serverHeading = heading()
	const onRecoverableError = vi.fn()
	await act(async () => {
		root = hydrateRoot(container, page, { onRecoverableError })
	})
	expect(onRecoverableError).not.toHaveBeenCalled()
	return serverHeading
}

test('a new dashboard holds the loader until the browser knows who is signed in', async () => {
	expect(await open('new')).toBe('New dashboard')
	await waitForUi(() => expect(container.textContent).toBe('Dashboard body'))
})

test('a private dashboard shows the loader while its stream is open, then the dashboard', async () => {
	const stream = Promise.withResolvers<Response>()
	session.serve({ '/api/dynamic/pro-dashboard/private-dashboard/stream': () => stream.promise })
	expect(await open('private-dashboard')).toBe('Loading dashboard')
	await waitForUi(() => expect(session.urls().some((url) => url.includes('/private-dashboard/stream'))).toBe(true))
	expect(heading()).toBe('Loading dashboard')

	await act(async () =>
		stream.resolve(new Response(`${JSON.stringify({ type: 'dashboard', data: privateDashboard })}\n{"type":"done"}\n`))
	)
	await waitForUi(() => expect(container.textContent).toBe('Dashboard body'))
})

test('a dashboard that fails to load leaves the loader for its failure', async () => {
	session.serve({
		'/api/dynamic/pro-dashboard/private-dashboard/stream': fixtureStatus(404, { message: 'Not found' }),
		[`${FEATURES_SERVER}/dashboards/private-dashboard`]: fixtureStatus(404, { message: 'Not found' })
	})
	await open('private-dashboard')
	await waitForUi(() => expect(heading()).toBe('Dashboard not found'))
})

test('a failed subscription read does not hold a public dashboard behind the loader', async () => {
	const publicDashboard = { ...privateDashboard, visibility: 'public' }
	session.client.removeQueries({ queryKey: subscriptionStatusQueryKey('owner') })
	session.serve({
		'/subscription/status': fixtureStatus(503, { message: 'Unavailable' }),
		'/api/dynamic/pro-dashboard/private-dashboard/stream': () =>
			new Response(`${JSON.stringify({ type: 'dashboard', data: publicDashboard })}\n{"type":"done"}\n`)
	})
	await open('private-dashboard')
	await waitForUi(() => expect(session.urls().some((url) => url.includes('/subscription/status'))).toBe(true))
	await waitForUi(() => expect(container.textContent).toBe('Dashboard body'))
})
