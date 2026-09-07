// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { LikeDashboardButton } from '../../components/LikeDashboardButton'
import type { Dashboard } from '../../dashboardTypes'
const api = vi.hoisted(() => ({ like: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch: vi.fn(), isAuthenticated: true }) }))
vi.mock('../../services/DashboardAPI', () => ({ dashboardAPI: { likeDashboard: api.like } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

test('keeps a late like response on its original dashboard and displays an unlike count of zero', async () => {
	const client = new QueryClient()
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	let finish!: (value: { liked: boolean; likeCount: number }) => void
	api.like.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	const first = { id: 'first', liked: true, likeCount: 1 } as Dashboard
	const second = { id: 'second', liked: false, likeCount: 7 } as Dashboard
	const firstKey = ['pro-dashboard', 'dashboard', 'first']
	const secondKey = ['pro-dashboard', 'dashboard', 'second']
	client.setQueryData(firstKey, first)
	client.setQueryData(secondKey, second)
	const render = (dashboard: Dashboard) =>
		act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<LikeDashboardButton currentDashboard={dashboard} dashboardId={dashboard.id} dashboardVisibility="public" />
				</QueryClientProvider>
			)
		)
	try {
		await render(first)
		expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true')
		await act(async () => container.querySelector('button')!.click())
		await render(second)
		await act(async () => {
			finish({ liked: false, likeCount: 0 })
			await new Promise((resolve) => setTimeout(resolve, 20))
		})
		expect(client.getQueryData(firstKey)).toMatchObject({ liked: false, likeCount: 0 })
		expect(client.getQueryData(secondKey)).toMatchObject({ liked: false, likeCount: 7 })
		expect(container.querySelector('button')!.textContent).toContain('7')
		await render(first)
		expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('false')
		expect(container.querySelector('button')!.textContent).toContain('0')
	} finally {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}
})
