// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DashboardDiscovery } from '../DashboardDiscovery'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn(),
	isReady: true
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// A heavy child; these tests read the pager around the cards.
vi.mock('../DashboardCard', () => ({ DashboardCard: () => null }))

const session = installSubscriberSession('reader', { account: 'signed-out' })
const dashboard = { id: 'one', data: { dashboardName: 'One', items: [] }, created: '', updated: '' }

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.query = {}
})

function render() {
	return act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardDiscovery initialCategories={{}} />
			</session.Wrapper>
		)
	)
}

test('Next page keeps the pager, and focus on it, while the next page loads', async () => {
	const secondPage = Promise.withResolvers<unknown>()
	session.serve({
		[`${FEATURES_SERVER}/dashboards/search`]: (url: URL) =>
			url.searchParams.get('page') === '2'
				? secondPage.promise
				: { items: [dashboard], page: 1, perPage: 20, totalItems: 21, totalPages: 2 }
	})
	router.query = { sortBy: 'popular' }
	await render()
	await waitForUi(() => expect(container.textContent).toContain('Showing 1 of 21 dashboards'))
	const next = container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!
	await act(async () => next.focus())

	router.query = { sortBy: 'popular', page: '2' }
	await render()
	expect(next.isConnected).toBe(true)
	expect(document.activeElement).toBe(next)

	await act(async () =>
		secondPage.resolve({ items: [{ ...dashboard, id: 'two' }], page: 2, perPage: 20, totalItems: 21, totalPages: 2 })
	)
	await waitForUi(() => expect(next.getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(next)
})
