// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import type { Dashboard } from '../dashboardTypes'
import { SimilarDashboards } from './SimilarDashboards'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push, query: {} }) }))
const http = installSubscriberSession('reader', { account: 'signed-out' })
const searches = () =>
	http.requests.filter((request) => request.url.pathname === '/dashboards/search').map((request) => request.url.search)

function makeDashboard(id: string): Dashboard {
	return {
		id,
		tags: ['Yields'],
		data: { items: [], dashboardName: `Dashboard ${id}` },
		created: '2026-09-01 00:00:00.000Z',
		updated: '2026-09-02 00:00:00.000Z'
	} as Dashboard
}

function searchResponse(items: Array<Dashboard>) {
	return { items, page: 1, perPage: 9, totalItems: items.length, totalPages: 1, searchParams: {} }
}

describe('SimilarDashboards', () => {
	let container: HTMLDivElement
	let root: Root

	const render = async (props: { dashboardId: string; tags: ReadonlyArray<string> }) => {
		await act(async () =>
			root.render(
				<http.Wrapper>
					<SimilarDashboards {...props} />
				</http.Wrapper>
			)
		)
		if (props.tags.length === 0) return
		await vi.waitFor(() => {
			expect(searches()).toHaveLength(1)
			expect(http.client.isFetching()).toBe(0)
		})
		// TanStack notifies observers on a timer tick, after the cache already holds the result.
		await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
	}
	const serveSearch = (items: Array<Dashboard>) => http.serve({ '/dashboards/search': searchResponse(items) })

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.push.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('skips the request and renders nothing until the dashboard has a tag', async () => {
		serveSearch([makeDashboard('a')])
		await render({ dashboardId: 'current', tags: [] })
		expect(container.innerHTML).toBe('')
		expect(searches()).toEqual([])

		await render({ dashboardId: 'current', tags: ['Yields'] })
		expect(searches()).toEqual(['?tags=Yields&visibility=public&sortBy=popular&page=1&limit=9'])
		expect(container.querySelector('h2')?.textContent).toBe('Similar dashboards')
	})

	test('queries the first two tags, drops the current dashboard and shows at most four cards', async () => {
		serveSearch(['a', 'current', 'b', 'c', 'd', 'e', 'f'].map((id) => makeDashboard(id)))
		await render({ dashboardId: 'current', tags: ['Yields', 'Perps', 'Fees'] })

		expect(searches()).toEqual(['?tags=Yields%2CPerps&visibility=public&sortBy=popular&page=1&limit=9'])

		expect(container.querySelector('h2')?.textContent).toBe('Similar dashboards')
		const names = Array.from(container.querySelectorAll('[data-umami-event="dashboard-similar-click"] h2')).map(
			(node) => node.textContent
		)
		expect(names).toEqual(['Dashboard a', 'Dashboard b', 'Dashboard c', 'Dashboard d'])
		const wrappers = container.querySelectorAll('[data-umami-event="dashboard-similar-click"]')
		expect(wrappers).toHaveLength(4)
		expect(wrappers[0]?.getAttribute('data-umami-event-dashboard')).toBe('a')
	})

	test('renders nothing when the only match is the current dashboard', async () => {
		serveSearch([makeDashboard('current')])
		await render({ dashboardId: 'current', tags: ['Yields'] })
		expect(searches()).toHaveLength(1)
		expect(container.innerHTML).toBe('')
	})

	test('opens the discover tag filter when a card tag is clicked', async () => {
		serveSearch([makeDashboard('a')])
		await render({ dashboardId: 'current', tags: ['Yields'] })
		const tagChip = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Yields')!
		await act(async () => tagChip.click())
		expect(mocks.push).toHaveBeenCalledWith({ pathname: '/pro', query: { tab: 'discover', tag: 'Yields' } })
	})
})
