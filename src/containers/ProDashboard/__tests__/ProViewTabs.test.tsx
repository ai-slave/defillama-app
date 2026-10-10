// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import HomePage from '~/pages/pro'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	query: {} as Record<string, string | Array<string>>,
	replace: vi.fn(),
	isReady: true
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Page chrome and panel bodies are heavy children. The panel stubs render one input each so the
// tests can see which panels stay mounted and whether their state survives a tab switch.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/components/DashboardDiscovery', () => ({
	DashboardDiscovery: () => <input aria-label="Discovery filter" />
}))
vi.mock('~/containers/ProDashboard/components/AuthorProfileStrip', () => ({ AuthorProfileStrip: () => null }))
vi.mock('~/containers/ProDashboard/components/DashboardList', () => ({ DashboardList: () => null }))
vi.mock('~/containers/ProDashboard/components/FollowingShelves', () => ({
	FollowingShelves: () => <input aria-label="Following filter" />
}))
vi.mock('~/containers/ProDashboard/components/LikedDashboards', () => ({
	LikedDashboards: () => <input aria-label="Starred filter" />
}))
vi.mock('~/containers/ProDashboard/components/MyProfileTab', () => ({
	MyProfileTab: () => <input aria-label="Profile draft" />
}))

const session = installSubscriberSession('user-1')
const emptyPage = { items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 }

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.replace.mockReset()
	router.query = {}
	session.serve({
		[`${FEATURES_SERVER}/dashboards`]: emptyPage,
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		'/team': { team: null }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
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
	})
}
/** Paginated dashboard lists requested so far, as `page/limit[/team]`. */
function listRequests() {
	return session.requests
		.filter((request) => request.url.pathname === '/dashboards' && request.url.searchParams.has('limit'))
		.map(({ url }) =>
			[url.searchParams.get('page'), url.searchParams.get('limit'), url.searchParams.get('scope')]
				.filter(Boolean)
				.join('/')
		)
}

test('arrows only focus; activation replaces the URL once without mounting Profile early', async () => {
	router.query = { tab: 'discover', page: '3' }
	await render()
	const [discover, mine, , , profile] = tabs()
	expect(router.replace).not.toHaveBeenCalled()
	await press(discover, 'ArrowRight')
	expect(document.activeElement).toBe(mine)
	await press(mine, 'End')
	expect(document.activeElement).toBe(profile)
	expect(container.querySelector('[aria-label="Profile draft"]')).toBeNull()
	expect(router.replace).not.toHaveBeenCalled()
	await press(profile, 'Enter')
	expect(router.replace.mock.calls).toEqual([
		[{ pathname: '/pro', query: { tab: 'profile' } }, undefined, { shallow: true, scroll: false }]
	])
	router.query = { tab: 'profile' }
	await render()
	expect(panel(profile).getAttribute('aria-labelledby')).toBe(profile.id)
	expect(panel(profile).hidden).toBe(false)
	expect(panel(discover).hidden).toBe(true)
	expect(document.activeElement).toBe(profile)
	await press(profile, 'Home')
	expect(document.activeElement).toBe(discover)
	router.replace.mockClear()
	await press(discover, ' ')
	expect(router.replace).toHaveBeenCalledOnce()
})

test('URL changes retain dashboard panel state but unmount Profile when leaving it', async () => {
	await render()
	const discovery = container.querySelector<HTMLInputElement>('[aria-label="Discovery filter"]')!
	const favorites = container.querySelector<HTMLInputElement>('[aria-label="Starred filter"]')!
	discovery.value = 'retained search'
	favorites.value = 'retained starred'
	const visit = async (tab: string) => {
		router.query = { tab }
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
	expect(container.querySelector('[aria-label="Starred filter"]')).toBe(favorites)
	expect(favorites.value).toBe('retained starred')
	expect(container.querySelector('[aria-label="Profile draft"]')).toBeNull()
	expect(router.replace).not.toHaveBeenCalled()
})

test('signed-out private links show Discover and restore the requested view after sign-in', async () => {
	const { token, record } = pb.authStore
	pb.authStore.clear()
	router.query = { tab: 'favorites' }
	await render()
	expect(tabs()).toHaveLength(1)
	expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
	expect(panel(tabs()[0]).hidden).toBe(false)
	expect(container.querySelector('[aria-label="Starred filter"]')).toBeNull()
	expect(listRequests()).toEqual([])

	await act(async () => pb.authStore.save(token, record))
	expect(tabs()[2].getAttribute('aria-selected')).toBe('true')
	expect(panel(tabs()[2]).hidden).toBe(false)

	await act(async () => pb.authStore.clear())
	expect(tabs()).toHaveLength(1)
	expect(tabs()[0].tabIndex).toBe(0)
	expect(panel(tabs()[0]).hidden).toBe(false)
	expect(router.replace).not.toHaveBeenCalled()
})

test.each(['unknown', ['favorites', 'profile']])(
	'invalid query %j shows Discover without rewriting history',
	async (tab) => {
		router.query = { tab }
		await render()
		expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
		expect(panel(tabs()[0]).hidden).toBe(false)
		expect(router.replace).not.toHaveBeenCalled()
	}
)

test('typing a search refetches My Dashboards once, after the debounce', async () => {
	router.query = { tab: 'my-dashboards', page: '3' }
	await render()
	await waitForUi(() => expect(listRequests()).toEqual(['3/20']))
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	onTestFinished(() => void vi.useRealTimers())
	const search = container.querySelector<HTMLInputElement>('[aria-label="Search my dashboards"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'audit')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	// The search debounces before it changes the request; getMyDashboardsRequest owns the page size.
	expect(listRequests()).toEqual(['3/20'])
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250)
	})
	vi.useRealTimers()
	await waitForUi(() => expect(listRequests()).toEqual(['3/20', '1/100']))
	expect(router.replace).not.toHaveBeenCalled()
})

test('a viewer without a team gets no Team tab and no team request', async () => {
	router.query = { tab: 'team' }
	await render()
	await waitForUi(() => expect(session.requests.some((request) => request.url.pathname === '/team')).toBe(true))
	expect(tabs().map((tab) => tab.textContent)).toEqual([
		'Discover',
		'My Dashboards',
		'Starred',
		'Following',
		'My Profile'
	])
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	expect(container.querySelector('[aria-label="Discovery filter"]')).not.toBeNull()
	expect(listRequests().filter((request) => request.endsWith('/team'))).toEqual([])
})

test('a team member opens the Team tab on the team scope', async () => {
	session.serve({ '/team': { team: { id: 'team-1', name: 'Growth' } } })
	router.query = { tab: 'team' }
	await render()
	const team = await waitForUi(() => {
		const tab = tabs().find((candidate) => candidate.textContent === 'Team')
		expect(tab && panel(tab).textContent).toContain('Shared with Growth')
		return tab!
	})
	expect(tabs().map((tab) => tab.textContent)).toEqual([
		'Discover',
		'My Dashboards',
		'Team',
		'Starred',
		'Following',
		'My Profile'
	])
	expect(panel(team).hidden).toBe(false)
	await waitForUi(() => expect(listRequests()).toContain('1/20/team'))
})

test('a failed My Dashboards load shows an error with a retry instead of an empty list', async () => {
	// The dashboards context also reads this endpoint and logs its own failure.
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
	onTestFinished(() => log.mockRestore())
	session.serve({ [`${FEATURES_SERVER}/dashboards`]: fixtureStatus(500, { message: 'Unavailable' }) })
	router.query = { tab: 'my-dashboards' }
	await render()
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load your dashboards")
	)
	expect(container.textContent).not.toContain('Showing 0 of 0 dashboards')

	session.serve({ [`${FEATURES_SERVER}/dashboards`]: emptyPage })
	await act(async () =>
		[...container.querySelectorAll('button')].find((button) => accessibleName(button) === 'Try again')!.click()
	)
	await waitForUi(() => expect(container.textContent).toContain('Showing 0 of 0 dashboards'))
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(listRequests()).toEqual(['1/20', '1/20'])
})
