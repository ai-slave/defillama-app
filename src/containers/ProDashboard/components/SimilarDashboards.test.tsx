// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { SimilarDashboards } from './SimilarDashboards'

const mocks = vi.hoisted(() => ({
	searchDashboards: vi.fn(),
	push: vi.fn(),
	authorizedFetch: vi.fn()
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: mocks.authorizedFetch, isAuthenticated: false })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push, query: {} }) }))
vi.mock('../services/DashboardAPI', () => ({ dashboardAPI: { searchDashboards: mocks.searchDashboards } }))
vi.mock('./DashboardCard', () => ({
	DashboardCard: ({ dashboard, onTagClick }: { dashboard: Dashboard; onTagClick?: (tag: string) => void }) => (
		<article>
			<span>{dashboard.data.dashboardName}</span>
			<button type="button" onClick={() => onTagClick?.('Yields')}>
				Yields
			</button>
		</article>
	)
}))

function makeDashboard(id: string): Dashboard {
	return { id, tags: ['Yields'], data: { items: [], dashboardName: `Dashboard ${id}` } } as unknown as Dashboard
}

function searchResponse(items: Array<Dashboard>) {
	return { items, page: 1, perPage: 9, totalItems: items.length, totalPages: 1, searchParams: {} }
}

describe('SimilarDashboards', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	const render = async (props: { dashboardId: string; tags: ReadonlyArray<string> }) => {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<SimilarDashboards {...props} />
				</QueryClientProvider>
			)
		)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20))
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.searchDashboards.mockReset()
		mocks.push.mockReset()
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	})

	test('renders nothing and skips the request when the dashboard has no tags', async () => {
		await render({ dashboardId: 'current', tags: [] })
		expect(container.innerHTML).toBe('')
		expect(mocks.searchDashboards).not.toHaveBeenCalled()
	})

	test('queries the first two tags, drops the current dashboard and shows at most four cards', async () => {
		mocks.searchDashboards.mockResolvedValue(
			searchResponse(['a', 'current', 'b', 'c', 'd', 'e', 'f'].map((id) => makeDashboard(id)))
		)
		await render({ dashboardId: 'current', tags: ['Yields', 'Perps', 'Fees'] })

		expect(mocks.searchDashboards).toHaveBeenCalledOnce()
		expect(mocks.searchDashboards.mock.calls[0]?.[0]).toEqual({
			tags: ['Yields', 'Perps'],
			visibility: 'public',
			sortBy: 'popular',
			page: 1,
			limit: 9
		})
		expect(mocks.searchDashboards.mock.calls[0]?.[1]).toBeUndefined()

		expect(container.querySelector('h2')?.textContent).toBe('Similar dashboards')
		const names = Array.from(container.querySelectorAll('article span')).map((node) => node.textContent)
		expect(names).toEqual(['Dashboard a', 'Dashboard b', 'Dashboard c', 'Dashboard d'])
		const wrappers = container.querySelectorAll('[data-umami-event="dashboard-similar-click"]')
		expect(wrappers).toHaveLength(4)
		expect(wrappers[0]?.getAttribute('data-umami-event-dashboard')).toBe('a')
		expect(wrappers[0]?.querySelector('article')).not.toBeNull()
	})

	test('renders nothing when the only match is the current dashboard', async () => {
		mocks.searchDashboards.mockResolvedValue(searchResponse([makeDashboard('current')]))
		await render({ dashboardId: 'current', tags: ['Yields'] })
		expect(mocks.searchDashboards).toHaveBeenCalledOnce()
		expect(container.innerHTML).toBe('')
	})

	test('opens the discover tag filter when a card tag is clicked', async () => {
		mocks.searchDashboards.mockResolvedValue(searchResponse([makeDashboard('a')]))
		await render({ dashboardId: 'current', tags: ['Yields'] })
		await act(async () => container.querySelector('button')!.click())
		expect(mocks.push).toHaveBeenCalledWith({ pathname: '/pro', query: { tab: 'discover', tag: 'Yields' } })
	})
})
