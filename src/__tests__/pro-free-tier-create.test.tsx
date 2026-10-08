// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import HomePage from '~/pages/pro'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	query: { tab: 'discover' },
	replace: vi.fn(async () => true),
	push: vi.fn(async () => true),
	isReady: true
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Page chrome and panel bodies are heavy children this test asserts nothing about.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/components/DashboardDiscovery', () => ({ DashboardDiscovery: () => null }))
vi.mock('~/containers/ProDashboard/components/AuthorProfileStrip', () => ({ AuthorProfileStrip: () => null }))
vi.mock('~/containers/ProDashboard/components/DashboardList', () => ({ DashboardList: () => null }))
vi.mock('~/containers/ProDashboard/components/FollowingShelves', () => ({ FollowingShelves: () => null }))
vi.mock('~/containers/ProDashboard/components/LikedDashboards', () => ({ LikedDashboards: () => null }))
vi.mock('~/containers/ProDashboard/components/MyProfileTab', () => ({ MyProfileTab: () => null }))

const session = installSubscriberSession('free-user', { account: 'free', resolved: true })
const emptyPage = { items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 }
const saved = {
	id: 'd1',
	slug: 'first-dashboard',
	data: { dashboardName: 'First', items: [] },
	created: '',
	updated: ''
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.push.mockClear()
	session.serve({
		[`${FEATURES_SERVER}/dashboards`]: emptyPage,
		'/team': { team: null },
		'/api/private/pro-dashboard/save': saved,
		// The picker's catalogs load behind it; this test needs none of them.
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		'https://api.llama.fi/chains2': { categories: [] },
		'http://localhost:3000/api/dynamic/adapter-metrics/': { protocols: [] }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const saveRequests = () => session.urls().filter((url) => url.includes('/api/private/pro-dashboard/save'))

async function click(scope: ParentNode, name: string) {
	const buttons = [...scope.querySelectorAll<HTMLButtonElement>('button')]
	const target =
		buttons.find((button) => accessibleName(button) === name) ??
		buttons.find((button) => accessibleName(button).startsWith(name))!
	await act(async () => target.click())
}

async function openBlankDashboardForm() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(session.urls().some((url) => url.includes('/lite/dashboards'))).toBe(true))
	await click(container, 'Create')
	await waitForUi(() => expect(dialog()?.textContent).toContain('How would you like to create your dashboard?'))
	await click(dialog()!, 'From scratch')
	await waitForUi(() => expect(dialog()!.querySelector('[name="dashboardName"]')).not.toBeNull())
	// The name is controlled state, so it changes through an input event, as typing does.
	const name = dialog()!.querySelector<HTMLInputElement>('[name="dashboardName"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'First')
		name.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('a free account whose dashboard count failed to load is not let through to create, and creates once the count loads', async () => {
	session.serve({ [`${FEATURES_SERVER}/lite/dashboards`]: fixtureStatus(500, { message: 'Server error' }) })
	await openBlankDashboardForm()

	await click(dialog()!, 'Create dashboard')
	await waitForUi(() =>
		expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't check how many dashboards you have. Try again.Your choices are still here."
		)
	)
	expect(saveRequests()).toEqual([])

	// A genuinely empty account may create its first dashboard.
	session.serve({ [`${FEATURES_SERVER}/lite/dashboards`]: { items: [] } })
	await click(dialog()!, 'Create dashboard')
	await waitForUi(() => expect(router.push).toHaveBeenCalledWith('/pro/first-dashboard/edit'))
	expect(saveRequests()).toHaveLength(1)
})

test('a free account at its dashboard limit is offered the upgrade instead of the create form', async () => {
	session.serve({ [`${FEATURES_SERVER}/lite/dashboards`]: { items: [{ id: 'first', name: 'First dashboard' }] } })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(localStorage.getItem('lite-dashboards')).toContain('first'))
	await click(container, 'Create')
	await waitForUi(() => expect(dialog()?.textContent).toContain('Free accounts can create up to 1 dashboard.'))
})
