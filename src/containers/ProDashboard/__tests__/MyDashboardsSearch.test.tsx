// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import HomePage from '~/pages/pro'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	query: { tab: 'my-dashboards' } as Record<string, string | Array<string>>,
	replace: vi.fn(),
	isReady: true
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Page chrome, other tabs and the dashboard cards are heavy children; these tests read the search box, the list
// summary and the empty state around them.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/components/DashboardDiscovery', () => ({ DashboardDiscovery: () => null }))
vi.mock('~/containers/ProDashboard/components/AuthorProfileStrip', () => ({ AuthorProfileStrip: () => null }))
vi.mock('~/containers/ProDashboard/components/FollowingShelves', () => ({ FollowingShelves: () => null }))
vi.mock('~/containers/ProDashboard/components/LikedDashboards', () => ({ LikedDashboards: () => null }))
vi.mock('~/containers/ProDashboard/components/MyProfileTab', () => ({ MyProfileTab: () => null }))
vi.mock('~/containers/ProDashboard/components/DashboardCard', () => ({ DashboardCard: () => null }))

const session = installSubscriberSession('user-1')
const lending = {
	id: 'lending',
	user: 'user-1',
	visibility: 'private',
	created: '2026-09-01T00:00:00Z',
	updated: '2026-09-01T00:00:00Z',
	data: { dashboardName: 'Lending overview', items: [] }
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.serve({
		[`${FEATURES_SERVER}/dashboards`]: { items: [lending], page: 1, perPage: 20, totalItems: 1, totalPages: 1 },
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

const search = () => container.querySelector<HTMLInputElement>('[aria-label="Search my dashboards"]')!
async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search(), value)
		search().dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function click(name: string) {
	const button = [...container.querySelectorAll('button')].find((candidate) => accessibleName(candidate) === name)
	expect(button, `button ${name}`).not.toBeUndefined()
	await act(async () => {
		button!.focus()
		button!.click()
	})
}
/** Opens My Dashboards, types a search that matches nothing and waits for the list to say so. */
async function searchForNothing() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(container.textContent).toContain('Showing 1 of 1 dashboards'))
	await type('zzz')
	await waitForUi(() => expect(container.textContent).toContain('No dashboards match “zzz”'))
}
/** Holds the search debounce until `release` runs the next 1s of timers; the list's own requests stay on real timers. */
function holdDebounce() {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	onTestFinished(() => void vi.useRealTimers())
	return async () => {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000)
		})
		vi.useRealTimers()
	}
}

test('the clear button lists every dashboard at once, and the search typed before it never lands', async () => {
	await searchForNothing()
	const release = holdDebounce()
	await type('zzzq')
	await click('Clear search')
	expect(search().value).toBe('')
	expect(container.textContent).toContain('Showing 1 of 1 dashboards')

	await release()
	expect(container.textContent).toContain('Showing 1 of 1 dashboards')
	expect(container.textContent).not.toContain('No dashboards match')
})

test('Clear filters empties the box and hands it focus, and the search typed before it never lands', async () => {
	await searchForNothing()
	const release = holdDebounce()
	await type('zzzq')
	expect(search().value).toBe('zzzq')
	await click('Clear filters')
	// The empty state leaves with its button, so focus goes to the search box it emptied.
	expect(container.textContent).not.toContain('Clear filters')
	expect(search().value).toBe('')
	expect(document.activeElement).toBe(search())

	await release()
	await waitForUi(() => expect(container.textContent).toContain('Showing 1 of 1 dashboards'))
	expect(search().value).toBe('')
	expect(container.textContent).not.toContain('No dashboards match')
})

test('Next page keeps the pager, and focus on it, while the next page loads', async () => {
	const secondPage = Promise.withResolvers<unknown>()
	session.serve({
		[`${FEATURES_SERVER}/dashboards`]: (url: URL) =>
			url.searchParams.get('page') === '2'
				? secondPage.promise
				: { items: [lending], page: 1, perPage: 20, totalItems: 21, totalPages: 2 }
	})
	const renderPage = () =>
		act(async () =>
			root.render(
				<session.Wrapper>
					<HomePage initialDiscoveryCategories={{}} />
				</session.Wrapper>
			)
		)
	await renderPage()
	await waitForUi(() => expect(container.textContent).toContain('Showing 1 of 21 dashboards'))
	const next = container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!
	await act(async () => next.focus())
	router.query = { tab: 'my-dashboards', page: '2' }
	onTestFinished(() => void (router.query = { tab: 'my-dashboards' }))
	await renderPage()
	expect(next.isConnected).toBe(true)
	expect(document.activeElement).toBe(next)

	await act(async () =>
		secondPage.resolve({ items: [{ ...lending, id: 'fees' }], page: 2, perPage: 20, totalItems: 21, totalPages: 2 })
	)
	await waitForUi(() => expect(next.getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(next)
})
